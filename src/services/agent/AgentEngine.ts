import {
  AgentToolCall,
  AgentToolResult,
  FileNode,
  TerminalOutputLine,
} from '../../types/index.js';
import { desktopBridge } from '../api/desktopBridge.js';

function flattenTree(nodes: FileNode[], prefix = ''): string[] {
  let result: string[] = [];
  for (const node of nodes) {
    result.push(node.relativePath + (node.isDirectory ? '/' : ''));
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenTree(node.children, prefix));
    }
  }
  return result;
}

export interface ToolExecutionContext {
  onTerminalOutput?: (line: TerminalOutputLine) => void;
}

export class AgentEngine {
  constructor(private workspacePath: string) {}

  setWorkspace(path: string) {
    this.workspacePath = path;
  }

  async executeTool(
    toolCall: AgentToolCall,
    context?: ToolExecutionContext
  ): Promise<AgentToolResult> {
    const { id, name, args } = toolCall;

    try {
      if (!this.workspacePath) {
        throw new Error('Workspace belum dipilih.');
      }

      switch (name) {
        case 'list_files': {
          const files = await desktopBridge.listFiles(
            this.workspacePath,
            args.directory || ''
          );
          const flatList = flattenTree(files);
          return {
            toolCallId: id,
            name,
            success: true,
            data: {
              count: flatList.length,
              files: flatList.slice(0, 100),
            },
          };
        }

        case 'read_file': {
          if (!args.filePath) throw new Error('filePath parameter is required');
          const fileData = await desktopBridge.readFile(
            this.workspacePath,
            args.filePath,
            args.startLine,
            args.endLine
          );
          return {
            toolCallId: id,
            name,
            success: true,
            data: {
              path: fileData.relativePath,
              size: fileData.size,
              lineCount: fileData.lineCount,
              content: fileData.content,
            },
          };
        }

        case 'write_file': {
          if (!args.filePath) throw new Error('filePath parameter is required');
          if (args.content === undefined) throw new Error('content parameter is required');

          const writeRes = await desktopBridge.writeFile(
            this.workspacePath,
            args.filePath,
            args.content
          );

          return {
            toolCallId: id,
            name,
            success: true,
            data: {
              path: args.filePath,
              message: `File "${args.filePath}" berhasil dibuat/diperbarui di workspace.`,
              backupPath: writeRes.backupPath,
            },
          };
        }

        case 'create_directory': {
          if (!args.directoryPath) throw new Error('directoryPath parameter is required');
          const dirRes = await desktopBridge.createDirectory(
            this.workspacePath,
            args.directoryPath
          );
          return {
            toolCallId: id,
            name,
            success: true,
            data: {
              path: args.directoryPath,
              message: `Direktori "${args.directoryPath}" berhasil dibuat.`,
              result: dirRes,
            },
          };
        }

        case 'edit_file': {
          if (!args.filePath) throw new Error('filePath parameter is required');
          if (args.content === undefined) throw new Error('content parameter is required');

          const editRes = await desktopBridge.editFile(
            this.workspacePath,
            args.filePath,
            args.content,
            args.oldText,
            args.newText
          );

          return {
            toolCallId: id,
            name,
            success: true,
            data: {
              path: args.filePath,
              message: `File "${args.filePath}" berhasil diperbarui.`,
              backupPath: editRes.backupPath,
            },
          };
        }

        case 'search_files': {
          if (!args.query) throw new Error('query parameter is required');
          const matches = await desktopBridge.searchFiles(this.workspacePath, args.query);
          return {
            toolCallId: id,
            name,
            success: true,
            data: {
              query: args.query,
              matchCount: matches.length,
              matches: matches.slice(0, 30),
            },
          };
        }

        case 'find_files': {
          if (!args.pattern) throw new Error('pattern parameter is required');
          const files = await desktopBridge.findFiles(this.workspacePath, args.pattern);
          return {
            toolCallId: id,
            name,
            success: true,
            data: {
              pattern: args.pattern,
              fileCount: files.length,
              files: files.slice(0, 50),
            },
          };
        }

        case 'get_file_info': {
          if (!args.filePath) throw new Error('filePath parameter is required');
          const info = await desktopBridge.getFileInfo(this.workspacePath, args.filePath);
          return {
            toolCallId: id,
            name,
            success: true,
            data: info,
          };
        }

        case 'run_command': {
          if (!args.command) throw new Error('command parameter is required');

          context?.onTerminalOutput?.({
            id: `cmd_${Date.now()}`,
            type: 'cmd',
            text: `$ ${args.command}`,
            timestamp: Date.now(),
          });

          const result = await desktopBridge.runCommand(this.workspacePath, args.command);

          if (result.stdout) {
            context?.onTerminalOutput?.({
              id: `out_${Date.now()}`,
              type: 'stdout',
              text: result.stdout,
              timestamp: Date.now(),
            });
          }

          if (result.stderr) {
            context?.onTerminalOutput?.({
              id: `err_${Date.now()}`,
              type: 'stderr',
              text: result.stderr,
              timestamp: Date.now(),
            });
          }

          context?.onTerminalOutput?.({
            id: `sys_${Date.now()}`,
            type: 'system',
            text: `[Process completed with exit code ${result.exitCode} (${result.durationMs}ms)]`,
            timestamp: Date.now(),
          });

          return {
            toolCallId: id,
            name,
            success: result.exitCode === 0,
            data: {
              command: result.command,
              exitCode: result.exitCode,
              stdout: result.stdout,
              stderr: result.stderr,
              durationMs: result.durationMs,
              killed: result.killed,
            },
            error:
              result.exitCode !== 0
                ? `Command failed with exit code ${result.exitCode}:\n${result.stderr || result.stdout}`
                : undefined,
          };
        }

        case 'git_status': {
          const status = await desktopBridge.gitStatus(this.workspacePath);
          return {
            toolCallId: id,
            name,
            success: true,
            data: status,
          };
        }

        case 'git_diff': {
          const diff = await desktopBridge.gitDiff(this.workspacePath);
          return {
            toolCallId: id,
            name,
            success: true,
            data: { diff },
          };
        }

        case 'git_log': {
          const commits = await desktopBridge.gitLog(this.workspacePath, args.limit || 10);
          return {
            toolCallId: id,
            name,
            success: true,
            data: { count: commits.length, commits },
          };
        }

        default:
          throw new Error(`Tool "${name}" tidak dikenali.`);
      }
    } catch (err: any) {
      return {
        toolCallId: id,
        name,
        success: false,
        error: err.message || 'Gagal mengeksekusi tool.',
      };
    }
  }
}
