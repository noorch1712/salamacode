import {
  ActivityLogItem,
  AgentState,
  AgentToolCall,
  AgentToolResult,
  AppSettings,
  ChatMessage,
  FallbackDecision,
  FileChangeRecord,
  PendingPermission,
  PendingPermissionChangeItem,
  TaskPlanItem,
  TerminalOutputLine,
} from '../../types/index.js';
import { AIProvider } from '../ai/AIProvider.js';
import { SmartRouter } from '../ai/SmartRouter.js';
import { AgentEngine } from './AgentEngine.js';
import { SALAMA_TOOLS, isToolRequiringPermission } from './AgentTool.js';
import { desktopBridge } from '../api/desktopBridge.js';
import { evaluateCommandSecurity } from '../../../electron/security/commandGuard.js';

export interface AgentLoopOptions {
  provider?: AIProvider;
  workspacePath: string;
  settings?: AppSettings;
  onStateChange: (state: AgentState) => void;
  onActivity: (item: ActivityLogItem) => void;
  onRequestPermission: (perm: PendingPermission) => Promise<boolean>;
  onFilesChanged?: () => void;
  onTerminalOutput?: (line: TerminalOutputLine) => void;
  onPlanUpdate?: (plan: TaskPlanItem[]) => void;
  onFileChangeRecord?: (record: FileChangeRecord) => void;
  onProviderFallbackPrompt?: (error: string) => Promise<boolean>;
  onFallbackNotice?: (decision: FallbackDecision) => void;
  onAskFallbackPermission?: (decision: FallbackDecision) => Promise<boolean>;
}

export class AgentLoop {
  private engine: AgentEngine;
  private router: SmartRouter;
  private isStopped = false;

  constructor(private options: AgentLoopOptions) {
    this.engine = new AgentEngine(options.workspacePath);
    this.router = new SmartRouter({
      settings: options.settings || {
        aiProvider: 'gemini',
        theme: 'light',
        modelName: 'gemini-3.8-flash',
      },
      onFallbackNotice: (decision) => {
        options.onActivity({
          id: `act_${Date.now()}_fallback`,
          title: `Smart Router: Fallback dialihkan ke ${decision.nextProvider} (${decision.model})`,
          detail: decision.reason,
          status: 'success',
          timestamp: Date.now(),
        });
        options.onFallbackNotice?.(decision);
      },
      onAskFallbackPermission: options.onAskFallbackPermission,
    });
  }

  stop() {
    this.isStopped = true;
    desktopBridge.killCommand(); // abort running terminal command
    this.options.onStateChange('STOPPED');
  }

  async run(
    history: ChatMessage[],
    userPrompt: string
  ): Promise<{ updatedHistory: ChatMessage[]; success: boolean; error?: string }> {
    this.isStopped = false;
    const {
      provider,
      workspacePath,
      settings,
      onStateChange,
      onActivity,
      onRequestPermission,
      onFilesChanged,
      onTerminalOutput,
      onPlanUpdate,
      onFileChangeRecord,
      onProviderFallbackPrompt,
    } = this.options;

    onStateChange('ANALYZING');

    // 1. Add user message
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userPrompt,
      timestamp: Date.now(),
    };

    const messages: ChatMessage[] = [...history, userMsg];

    onActivity({
      id: `act_${Date.now()}_start`,
      title: 'Menganalisis workspace & merencanakan tugas...',
      detail: userPrompt.substring(0, 80),
      status: 'running',
      timestamp: Date.now(),
    });

    const maxIterations = settings?.maxAgentIterations || 30;
    let currentTurn = 0;
    let activePlan: TaskPlanItem[] = [
      { id: 'step_1', title: 'Analisis project & file relevan', status: 'running' },
      { id: 'step_2', title: 'Eksekusi instruksi & pembuatan/pengeditan kode', status: 'pending' },
      { id: 'step_3', title: 'Verifikasi & testing terminal', status: 'pending' },
      { id: 'step_4', title: 'Penyelesaian task', status: 'pending' },
    ];
    onPlanUpdate?.(activePlan);

    try {
      while (currentTurn < maxIterations) {
        if (this.isStopped) {
          onStateChange('STOPPED');
          return { updatedHistory: messages, success: false, error: 'Agent dihentikan oleh pengguna.' };
        }

        currentTurn++;

        onStateChange('PLANNING');

        let response;
        try {
          response = await this.router.executeWithRouting(
            {
              messages,
              tools: SALAMA_TOOLS,
              workspacePath,
              temperature: settings?.temperature ?? 0.3,
              maxTokens: settings?.maxTokens ?? 8192,
            },
            (progressText) => {
              onActivity({
                id: `act_${Date.now()}_progress`,
                title: 'Smart Router Retry / Backoff',
                detail: progressText,
                status: 'running',
                timestamp: Date.now(),
              });
            }
          );
        } catch (genErr: any) {
          if (genErr.isQuota && onProviderFallbackPrompt) {
            const acceptFallback = await onProviderFallbackPrompt(genErr.message);
            if (acceptFallback) {
              // Retry with fallback
              continue;
            }
          }
          throw genErr;
        }

        const hasToolCalls = response.toolCalls && response.toolCalls.length > 0;

        // If no tool calls -> Assistant completed its explanation/task
        if (!hasToolCalls) {
          activePlan = activePlan.map((s) => ({ ...s, status: 'completed' as const }));
          onPlanUpdate?.(activePlan);

          const assistantMsg: ChatMessage = {
            id: `msg_${Date.now()}_assistant`,
            role: 'assistant',
            content: response.content || 'Semua task telah selesai dikerjakan.',
            timestamp: Date.now(),
            status: 'done',
            plan: activePlan,
          };
          messages.push(assistantMsg);

          onActivity({
            id: `act_${Date.now()}_done`,
            title: 'Task selesai',
            detail: 'AI telah menyelesaikan seluruh rangkaian tugas.',
            status: 'success',
            timestamp: Date.now(),
          });

          onStateChange('COMPLETED');
          return { updatedHistory: messages, success: true };
        }

        // Assistant requested tool calls
        const toolCalls: AgentToolCall[] = response.toolCalls!;
        onStateChange('EXECUTING');

        const assistantToolMsg: ChatMessage = {
          id: `msg_${Date.now()}_ast_call`,
          role: 'assistant',
          content: response.content || '',
          timestamp: Date.now(),
          toolCalls,
          status: 'thinking',
        };
        messages.push(assistantToolMsg);

        // Check if there are multiple file changes to group for preview
        const fileChangeCalls = toolCalls.filter(
          (tc) => tc.name === 'write_file' || tc.name === 'edit_file'
        );

        if (fileChangeCalls.length > 1 && settings?.reviewMode !== 'auto') {
          // Prepare multi-file change preview
          const multiChanges: PendingPermissionChangeItem[] = [];
          for (const fc of fileChangeCalls) {
            const relPath = fc.args.filePath || '';
            let originalContent = '';
            if (fc.name === 'edit_file') {
              try {
                const ex = await desktopBridge.readFile(workspacePath, relPath);
                originalContent = ex.content;
              } catch {}
            }
            multiChanges.push({
              filePath: relPath,
              relativePath: relPath,
              type: fc.name === 'write_file' ? 'create' : 'edit',
              originalContent,
              newContent: fc.args.content || '',
            });
          }

          onStateChange('WAITING_PERMISSION');
          const groupApproved = await onRequestPermission({
            id: `multi_${Date.now()}`,
            type: 'multi_file',
            toolName: 'write_file',
            description: `AI ingin melakukan perubahan pada ${multiChanges.length} file sekaligus:`,
            multiChanges,
            timestamp: Date.now(),
          });

          if (!groupApproved) {
            onStateChange('REJECTED');
            const toolResults: AgentToolResult[] = fileChangeCalls.map((fc) => ({
              toolCallId: fc.id,
              name: fc.name,
              success: false,
              error: `Pengguna menolak perubahan multi-file.`,
            }));
            assistantToolMsg.toolResults = toolResults;
            continue;
          }
        }

        // Execute each tool
        const toolResults: AgentToolResult[] = [];

        for (const toolCall of toolCalls) {
          if (this.isStopped) break;

          // Check security for commands
          let commandSecurityLevel;
          if (toolCall.name === 'run_command') {
            const sec = evaluateCommandSecurity(toolCall.args.command || '');
            commandSecurityLevel = sec.level;
            if (sec.level === 'BLOCKED_BY_DEFAULT') {
              toolResults.push({
                toolCallId: toolCall.id,
                name: toolCall.name,
                success: false,
                error: sec.reason || 'Command diblokir oleh sistem keamanan.',
              });
              continue;
            }
          }

          const requiresApproval =
            fileChangeCalls.length <= 1 &&
            isToolRequiringPermission(
              toolCall.name,
              settings?.reviewMode || 'ask',
              commandSecurityLevel
            );

          if (requiresApproval) {
            onStateChange('WAITING_PERMISSION');
            const targetPath = toolCall.args.filePath || '';
            let originalContent = '';

            if (toolCall.name === 'edit_file') {
              try {
                const existing = await desktopBridge.readFile(workspacePath, targetPath);
                originalContent = existing.content;
              } catch {}
            }

            const permItem: PendingPermission = {
              id: `perm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              type:
                toolCall.name === 'run_command'
                  ? 'command_run'
                  : toolCall.name === 'write_file'
                  ? 'file_write'
                  : 'file_edit',
              toolName: toolCall.name,
              filePath: targetPath,
              relativePath: targetPath,
              description:
                toolCall.name === 'run_command'
                  ? `AI ingin menjalankan perintah terminal: "${toolCall.args.command}"`
                  : toolCall.name === 'write_file'
                  ? `AI ingin membuat file "${targetPath}" di workspace.`
                  : `AI ingin mengubah file "${targetPath}" di workspace.`,
              content: toolCall.args.content,
              originalContent,
              updatedContent: toolCall.args.content,
              command: toolCall.args.command,
              securityLevel: commandSecurityLevel,
              timestamp: Date.now(),
            };

            onActivity({
              id: `act_${Date.now()}_wait`,
              title: `Menunggu persetujuan: ${toolCall.name}`,
              detail: targetPath || toolCall.args.command,
              status: 'waiting_approval',
              toolName: toolCall.name,
              timestamp: Date.now(),
            });

            const approved = await onRequestPermission(permItem);

            if (!approved) {
              onStateChange('REJECTED');
              onActivity({
                id: `act_${Date.now()}_reject`,
                title: `Persetujuan ditolak oleh user`,
                detail: targetPath || toolCall.args.command,
                status: 'error',
                toolName: toolCall.name,
                timestamp: Date.now(),
              });

              toolResults.push({
                toolCallId: toolCall.id,
                name: toolCall.name,
                success: false,
                error: `User menolak persetujuan untuk operasi "${toolCall.name}". Harap pilih alternatif lain.`,
              });
              continue;
            }
          }

          onStateChange('EXECUTING');

          onActivity({
            id: `act_${Date.now()}_exec`,
            title: `Menjalankan: ${toolCall.name}`,
            detail: toolCall.args.filePath || toolCall.args.command || toolCall.args.query || '',
            status: 'running',
            toolName: toolCall.name,
            timestamp: Date.now(),
          });

          // Record backup & change record before write/edit
          let prevContent: string | undefined;
          if (toolCall.name === 'edit_file' || toolCall.name === 'write_file') {
            try {
              const prev = await desktopBridge.readFile(workspacePath, toolCall.args.filePath);
              prevContent = prev.content;
            } catch {}
          }

          const result = await this.engine.executeTool(toolCall, {
            onTerminalOutput,
          });

          toolResults.push(result);

          if (result.success) {
            onActivity({
              id: `act_${Date.now()}_succ`,
              title: `✓ Selesai: ${toolCall.name}`,
              detail: toolCall.args.filePath || toolCall.args.command || 'Berhasil',
              status: 'success',
              toolName: toolCall.name,
              timestamp: Date.now(),
            });

            if (toolCall.name === 'write_file' || toolCall.name === 'edit_file') {
              onFilesChanged?.();
              onFileChangeRecord?.({
                id: `chg_${Date.now()}`,
                filePath: toolCall.args.filePath,
                relativePath: toolCall.args.filePath,
                type: toolCall.name === 'write_file' ? 'create' : 'edit',
                timestamp: Date.now(),
                backupPath: result.data?.backupPath,
                oldContent: prevContent,
                newContent: toolCall.args.content,
              });
            } else if (toolCall.name === 'create_directory') {
              onFilesChanged?.();
            }

            // Update plan progression
            if (toolCall.name === 'run_command') {
              activePlan = activePlan.map((s) =>
                s.id === 'step_3' ? { ...s, status: 'completed' } : s
              );
            } else {
              activePlan = activePlan.map((s) =>
                s.id === 'step_2' ? { ...s, status: 'running' } : s
              );
            }
            onPlanUpdate?.(activePlan);
          } else {
            onStateChange('ANALYZING_ERROR');
            onActivity({
              id: `act_${Date.now()}_err`,
              title: `✗ Terjadi error: ${toolCall.name}`,
              detail: result.error?.substring(0, 120),
              status: 'error',
              toolName: toolCall.name,
              timestamp: Date.now(),
            });
          }
        }

        assistantToolMsg.toolResults = toolResults;
        assistantToolMsg.status = 'done';
      }

      onActivity({
        id: `act_${Date.now()}_max`,
        title: 'Batas langkah maksimum (30) tercapai',
        detail: 'Klik Lanjutkan jika ingin meneruskan proses.',
        status: 'error',
        timestamp: Date.now(),
      });

      onStateChange('COMPLETED');
      return { updatedHistory: messages, success: true };
    } catch (err: any) {
      console.error('AgentLoop execution error:', err);
      onStateChange('ERROR');

      onActivity({
        id: `act_${Date.now()}_fatal`,
        title: 'AI request failed',
        detail: err.message,
        status: 'error',
        timestamp: Date.now(),
      });

      const errorAssistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: `⚠ AI request failed:\n${err.message}\n\nKemungkinan penyebab:\n• API key belum disetel atau tidak valid\n• Batas kuota tercapai\n• Masalah jaringan lokal\n• Operasi berada di luar direktori workspace`,
        timestamp: Date.now(),
        status: 'error',
      };
      messages.push(errorAssistantMsg);

      return {
        updatedHistory: messages,
        success: false,
        error: err.message,
      };
    }
  }
}
