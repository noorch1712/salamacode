import { AgentTool, CommandSecurityLevel, ToolName } from '../../types/index.js';

export const SALAMA_TOOLS: AgentTool[] = [
  {
    name: 'list_files',
    description: 'Lists files and folders inside the project workspace.',
    parameters: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Relative subfolder path (optional, leave blank for root).',
        },
      },
      required: [],
    },
  },
  {
    name: 'read_file',
    description: 'Reads content of a file within the workspace with optional line range.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Relative path to the file to read (e.g., package.json, src/App.tsx).',
        },
        startLine: {
          type: 'integer',
          description: 'Optional start line (1-indexed).',
        },
        endLine: {
          type: 'integer',
          description: 'Optional end line (inclusive).',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'write_file',
    description: 'Creates a new file or overwrites an existing file in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Relative path where file will be created/written.',
        },
        content: {
          type: 'string',
          description: 'The complete content to write into the file.',
        },
      },
      required: ['filePath', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Modifies or updates an existing file with complete content or targeted replacement.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Relative path of the file to edit.',
        },
        content: {
          type: 'string',
          description: 'New complete content or replacement.',
        },
        oldText: {
          type: 'string',
          description: 'Optional exact old text substring to replace.',
        },
        newText: {
          type: 'string',
          description: 'Optional replacement text for oldText.',
        },
      },
      required: ['filePath', 'content'],
    },
  },
  {
    name: 'create_directory',
    description: 'Creates a new directory inside the project workspace.',
    parameters: {
      type: 'object',
      properties: {
        directoryPath: {
          type: 'string',
          description: 'Relative directory path to create (e.g., src/components).',
        },
      },
      required: ['directoryPath'],
    },
  },
  {
    name: 'search_files',
    description: 'Searches for a specific keyword or code symbol across all files in the project.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Code symbol, function name, or text to search for.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_files',
    description: 'Finds files matching pattern (e.g. *.tsx, *.php, *.blade.php, *.py, *.json).',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Wildcard pattern like *.tsx, *.php, *.py.',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'get_file_info',
    description: 'Retrieves metadata about a file (size, lines, modified time, extension).',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Relative path to the file.',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'run_command',
    description: 'Executes a command inside the workspace directory in the local terminal.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Terminal command to run (e.g., npm install, npm run build, node server.js).',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'git_status',
    description: 'Retrieves current git status (branch, modified, untracked, staged).',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_diff',
    description: 'Retrieves current uncommitted git diff of workspace.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'git_log',
    description: 'Retrieves recent git commits (read-only).',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Max commits to fetch (default 10).',
        },
      },
      required: [],
    },
  },
];

export function isToolRequiringPermission(
  name: ToolName,
  reviewMode: 'ask' | 'auto' = 'ask',
  commandSecurityLevel?: CommandSecurityLevel
): boolean {
  // If user chose Auto Approve mode:
  if (reviewMode === 'auto') {
    // Only command that is APPROVAL_REQUIRED needs permission
    if (name === 'run_command' && commandSecurityLevel === 'APPROVAL_REQUIRED') {
      return true;
    }
    return false;
  }

  // Default "Ask Before Changes" mode:
  if (name === 'write_file' || name === 'edit_file') {
    return true;
  }

  if (name === 'run_command') {
    // APPROVAL_REQUIRED commands always require permission
    if (commandSecurityLevel === 'APPROVAL_REQUIRED') {
      return true;
    }
    // Safe build/install commands can run automatically in the terminal,
    // but if commandSecurityLevel is explicitly APPROVAL_REQUIRED it asks.
    return false;
  }

  // Read-only tools never require approval
  return false;
}
