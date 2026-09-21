export interface FileNode {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: number;
  children?: FileNode[];
}

export interface FileContent {
  path: string;
  relativePath: string;
  content: string;
  size?: number;
  lineCount?: number;
  isBinary?: boolean;
}

export interface WorkspaceInfo {
  path: string;
  name: string;
  lastOpened: number;
}

export type ToolName =
  | 'list_files'
  | 'read_file'
  | 'write_file'
  | 'edit_file'
  | 'create_directory'
  | 'search_files'
  | 'find_files'
  | 'get_file_info'
  | 'run_command'
  | 'git_status'
  | 'git_diff'
  | 'git_log';

export interface AgentToolParameterProperty {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
  items?: { type: string };
}

export interface AgentTool {
  name: ToolName;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AgentToolParameterProperty>;
    required: string[];
  };
}

export interface AgentToolCall {
  id: string;
  name: ToolName;
  args: Record<string, any>;
}

export interface AgentToolResult {
  toolCallId: string;
  name: ToolName;
  success: boolean;
  data?: any;
  error?: string;
}

export type CommandSecurityLevel = 'SAFE' | 'APPROVAL_REQUIRED' | 'BLOCKED_BY_DEFAULT';

export interface SearchMatch {
  filePath: string;
  lineNumber: number;
  lineContent: string;
}

export interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  lines: number;
  isDirectory: boolean;
  extension: string;
  modifiedAt: number;
}

export interface TerminalCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  killed?: boolean;
  error?: string;
}

export interface TerminalOutputLine {
  id: string;
  type: 'cmd' | 'stdout' | 'stderr' | 'system';
  text: string;
  timestamp: number;
}

export interface TaskPlanItem {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface FileBackupItem {
  id: string;
  originalPath: string;
  relativePath: string;
  backupPath: string;
  timestamp: number;
  toolName: string;
  reason?: string;
}

export interface FileChangeRecord {
  id: string;
  filePath: string;
  relativePath: string;
  type: 'create' | 'edit';
  timestamp: number;
  backupPath?: string;
  oldContent?: string;
  newContent?: string;
}

export interface PendingPermissionChangeItem {
  filePath: string;
  relativePath: string;
  type: 'create' | 'edit';
  originalContent?: string;
  newContent: string;
}

export interface PendingPermission {
  id: string;
  type: 'file_write' | 'file_edit' | 'multi_file' | 'command_run';
  toolName: ToolName;
  filePath?: string;
  relativePath?: string;
  description: string;
  content?: string;
  originalContent?: string;
  updatedContent?: string;
  command?: string;
  securityLevel?: CommandSecurityLevel;
  multiChanges?: PendingPermissionChangeItem[];
  timestamp: number;
}

export type ActivityStatus = 'pending' | 'running' | 'success' | 'error' | 'waiting_approval';

export interface ActivityLogItem {
  id: string;
  title: string;
  detail?: string;
  status: ActivityStatus;
  timestamp: number;
  toolName?: ToolName;
}

export type AgentState =
  | 'IDLE'
  | 'ANALYZING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'WAITING_PERMISSION'
  | 'VERIFYING'
  | 'ERROR'
  | 'ANALYZING_ERROR'
  | 'FIXING'
  | 'COMPLETED'
  | 'STOPPED'
  | 'REJECTED';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: AgentToolCall[];
  toolResults?: AgentToolResult[];
  activityItems?: ActivityLogItem[];
  status?: 'thinking' | 'waiting_permission' | 'done' | 'error';
  plan?: TaskPlanItem[];
}

export type AIProviderType = 'gemini' | 'openrouter' | 'custom';

export type TaskType =
  | 'General'
  | 'Coding'
  | 'Debugging'
  | 'Refactoring'
  | 'Planning'
  | 'Documentation';

export type AISafetyMode = 'Safe' | 'Balanced' | 'Auto';

export type ProviderHealthStatus = 'HEALTHY' | 'LIMITED' | 'ERROR' | 'NOT_CONFIGURED';

export type AIErrorType =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_ERROR';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProviderType | string;
  contextWindow?: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsStructuredOutput?: boolean;
  supportsLongContext?: boolean;
  costType?: 'Free' | 'Paid' | 'Unknown';
  estimatedCost?: string;
  status?: 'Available' | 'Limited' | 'Deprecated';
  description?: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  health: ProviderHealthStatus;
  priority: number;
  enabled: boolean;
  isConfigured: boolean;
}

export interface FallbackDecision {
  previousProvider: string;
  currentProvider?: string;
  nextProvider: string;
  reason: string;
  model: string;
}

export type TaskMode = TaskType;

export interface AIProviderOptions {
  apiKey?: string;
  model?: string;
  workspacePath?: string;
  temperature?: number;
  maxTokens?: number;
  openRouterBaseUrl?: string;
  baseUrl?: string;
}

export interface AIRequest {
  messages: ChatMessage[];
  tools?: AgentTool[];
  options?: AIProviderOptions;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  workspacePath?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIStreamEvent {
  type: 'chunk' | 'text_chunk' | 'tool_call' | 'done' | 'error';
  delta?: string;
  text?: string;
  toolCall?: AgentToolCall;
  response?: AIResponse;
  error?: string;
}

export interface ProviderTestResult {
  success: boolean;
  message?: string;
  error?: string;
  latencyMs?: number;
  model?: string;
}

export interface AIProvider {
  readonly id: AIProviderType | string;
  readonly name: string;
  isConfigured?: boolean;
  listModels(): Promise<AIModel[]>;
  chat?(request: AIRequest): Promise<AIResponse>;
  stream?(request: AIRequest): AsyncIterable<AIStreamEvent>;
  generateResponse(
    messages: ChatMessage[],
    tools?: AgentTool[],
    options?: AIProviderOptions
  ): Promise<AIResponse>;
  testConnection(
    config?: { apiKey?: string; model?: string; baseUrl?: string }
  ): Promise<ProviderTestResult>;
}

export interface AIUsageSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  byProvider: Record<string, number>;
}

export interface AITelemetryLog extends AIUsageLogItem {}

export interface ProviderUsage {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  tokensUsed?: number | string;
}

export interface AIUsageLogItem {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  requestType: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  status: 'SUCCESS' | 'RATE_LIMIT' | 'ERROR';
  errorType?: AIErrorType;
  estimatedCost?: string;
}

export interface ProjectAIConfig {
  workspacePath: string;
  primaryProvider?: AIProviderType;
  modelName?: string;
  fallbackProvider?: AIProviderType;
  autoFallback?: boolean;
}

export interface AppSettings {
  aiProvider: 'gemini' | 'openrouter' | 'custom';
  geminiApiKey?: string;
  openRouterApiKey?: string;
  openRouterBaseUrl?: string;
  openRouterModel?: string;

  // Custom provider
  enableCustomProvider?: boolean;
  customProviderName?: string;
  customProviderBaseUrl?: string;
  customProviderApiKey?: string;
  customProviderModel?: string;

  // Smart Routing & Fallback
  primaryProvider?: 'gemini' | 'openrouter' | 'custom';
  fallbackProvider?: 'gemini' | 'openrouter' | 'custom';
  providerPriority?: ('gemini' | 'openrouter' | 'custom')[];
  autoFallback?: boolean;
  askBeforeFallback?: boolean;
  safetyMode?: AISafetyMode;
  aiSafetyMode?: AISafetyMode;
  taskMode?: TaskType;

  // Favorites & Recents
  favoriteModels?: string[];
  recentModels?: string[];

  // Per-project configs map
  projectConfigs?: Record<string, ProjectAIConfig>;

  lastWorkspacePath?: string;
  theme: 'light' | 'dark';
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  maxAgentIterations?: number;
  reviewMode?: 'ask' | 'auto';

  // Cloud Sync & Privacy Preferences (Fase 4)
  syncProjectMetadata?: boolean;
  syncConversationMetadata?: boolean;
  sendAnonymousDiagnostics?: boolean;
}

export interface ProjectHistoryItem {
  id: string;
  workspacePath: string;
  workspaceName: string;
  timestamp: number;
  title: string;
  messageCount: number;
}

export interface AIResponse {
  content: string;
  toolCalls?: AgentToolCall[];
  plan?: TaskPlanItem[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface GitCommitItem {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitStatusResult {
  isGitRepo: boolean;
  branch?: string;
  modified: string[];
  untracked: string[];
  staged: string[];
  clean: boolean;
}

export interface SalamaAPIBridge {
  isElectron: boolean;
  chooseDirectory: () => Promise<string | null>;
  getWorkspaceInfo: (workspacePath: string) => Promise<WorkspaceInfo>;
  listFiles: (workspacePath: string, relativeDir?: string) => Promise<FileNode[]>;
  readFile: (
    workspacePath: string,
    relativeFilePath: string,
    startLine?: number,
    endLine?: number
  ) => Promise<FileContent>;
  writeFile: (
    workspacePath: string,
    relativeFilePath: string,
    content: string
  ) => Promise<{ success: boolean; path: string; backupPath?: string }>;
  createDirectory: (workspacePath: string, relativeDirPath: string) => Promise<{ success: boolean; path: string }>;
  editFile: (
    workspacePath: string,
    relativeFilePath: string,
    content: string,
    oldText?: string,
    newText?: string
  ) => Promise<{ success: boolean; path: string; backupPath?: string }>;
  searchFiles: (workspacePath: string, query: string) => Promise<SearchMatch[]>;
  findFiles: (workspacePath: string, pattern: string) => Promise<string[]>;
  getFileInfo: (workspacePath: string, relativeFilePath: string) => Promise<FileInfo>;
  runCommand: (
    workspacePath: string,
    command: string,
    options?: { timeoutMs?: number }
  ) => Promise<TerminalCommandResult>;
  killCommand: (processId?: string) => Promise<boolean>;
  getBackups: (workspacePath: string) => Promise<FileBackupItem[]>;
  rollbackFile: (workspacePath: string, backupId: string) => Promise<boolean>;
  gitStatus: (workspacePath: string) => Promise<GitStatusResult>;
  gitDiff: (workspacePath: string) => Promise<string>;
  gitLog: (workspacePath: string, limit?: number) => Promise<GitCommitItem[]>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  getHistory: () => Promise<ProjectHistoryItem[]>;
  saveHistory: (item: ProjectHistoryItem) => Promise<void>;
  listPresetWorkspaces?: () => Promise<WorkspaceInfo[]>;
  testAIConnection?: (
    provider: 'gemini' | 'openrouter' | 'custom',
    config: { apiKey?: string; model?: string; baseUrl?: string }
  ) => Promise<{ success: boolean; message?: string; error?: string; latencyMs?: number }>;
}

// ==============================================================================
// FASE 4: USER ACCOUNT, CLOUD SYNC, PROJECT MANAGEMENT & ADMIN TYPES
// ==============================================================================

export type UserRole = 'user' | 'admin' | 'super_admin';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  avatarUrl?: string;
  status: 'active' | 'suspended' | 'disabled';
  planId: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  role: UserRole;
}

export interface CloudProject {
  id: string;
  userId: string;
  name: string;
  description?: string;
  localProjectId?: string;
  localPath?: string; // Stored locally only or reference
  language?: string;
  framework?: string;
  gitRepository?: string;
  gitBranch?: string;
  isFavorite: boolean;
  archived: boolean;
  totalFiles?: number;
  totalLines?: number;
  lastOpenedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceItem {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  isCurrent: boolean;
  lastSeen: string;
  createdAt: string;
}

export type AuditEventType =
  | 'USER_REGISTERED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  | 'PROJECT_LINKED'
  | 'PROJECT_UNLINKED'
  | 'DEVICE_ADDED'
  | 'DEVICE_REMOVED'
  | 'PROVIDER_ENABLED'
  | 'SETTINGS_CHANGED'
  | 'ADMIN_ACTION';

export interface AuditLogItem {
  id: string;
  userId?: string;
  eventType: AuditEventType;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface PlanTier {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  description: string;
  maxProjects: number;
  dailyRequests: number;
  monthlyRequests: number;
  maxDevices: number;
  features: {
    byok: boolean;
    cloudSync: boolean;
    autoFallback: boolean;
    analytics?: boolean;
    prioritySupport?: boolean;
  };
}

export type AIExecutionMode = 'BYOK' | 'MANAGED';

export type CloudSyncStatus = 'synced' | 'syncing' | 'offline' | 'conflict' | 'error';

export interface OfflineSyncQueueItem {
  id: string;
  action: 'create_project' | 'update_project' | 'delete_project' | 'update_settings' | 'log_usage';
  payload: any;
  timestamp: number;
}

export interface AdminStatsOverview {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  requestsToday: number;
  errorsToday: number;
}

export interface AdminUserDetail {
  profile: UserProfile;
  projectsCount: number;
  requestsCount: number;
  devicesCount: number;
  lastActive: string;
}

export interface TechnologyDetectionResult {
  language: string;
  framework: string;
  totalFiles: number;
  totalLines: number;
  gitBranch?: string;
}
