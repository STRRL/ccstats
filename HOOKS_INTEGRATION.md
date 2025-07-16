# Claude Code Hooks Integration for ccstats

This integration allows ccstats to capture and analyze Claude Code hook events.

## Setup

1. **Build ccstats**:
   ```bash
   go build -o ccstats main.go
   ```

2. **Configure Claude Code to use ccstats hooks**:
   
   Copy the settings to your Claude Code configuration directory:
   ```bash
   # For global settings (affects all projects)
   cp claude-code-settings.example.json ~/.config/claude/settings.json
   
   # OR for project-specific settings
   cp claude-code-settings.example.json /path/to/your/project/.claude/settings.json
   ```

   Note: Update the paths in the settings.json file to point to your ccstats binary location.

3. **Verify hook setup**:
   
   Once configured, Claude Code will send all hook events to ccstats, which will:
   - Log all events to `~/.claude/hooks/hooks_YYYY-MM-DD.jsonl`
   - Pass through the data unchanged (transparent operation)

## Usage

### View hook statistics
Run ccstats normally to see both token usage AND hook statistics:
```bash
./ccstats
```

This will display:
- Token usage statistics
- Cost analysis
- Hook event statistics (if any hooks have been triggered)
- Tool usage patterns from hooks

## Hook Specification

Claude Code hooks follow a JSON-based specification that defines when and how shell commands execute during Claude Code's lifecycle.

### Event Types
- **PreToolUse**: Runs before tool calls
- **PostToolUse**: Runs after tool successfully completes  
- **Notification**: Triggered during permission requests or idle periods
- **Stop**: Runs when main agent finishes responding
- **SubagentStop**: Runs when subagent finishes
- **PreCompact**: Runs before context compaction

### Configuration Format
```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolPattern",
        "hooks": [
          {
            "type": "command",
            "command": "shell-command-here"
          }
        ]
      }
    ]
  }
}
```

### Hook Output Control
- **Exit Code 0**: Success, continue normally
- **Exit Code 2**: Blocking error, stop execution
- **Other Exit Codes**: Non-blocking error, log and continue
- **JSON Output**: Can control continuation and provide decision control

### Security Notes
- Hooks execute with full user permissions
- Users are responsible for safe hook implementation
- Matchers support exact tool names, regex patterns, and event-specific filtering

### Hook log files
Hook events are stored in daily JSONL files at:
```
~/.claude/hooks/hooks_YYYY-MM-DD.jsonl
```

Each event contains:
- `timestamp`: When the hook was triggered
- `event_type`: Type of hook (PreToolUse, PostToolUse, etc.)
- `hook_data`: The complete data received from Claude Code

### Example hook event
```json
{
  "timestamp": "2025-01-15T10:30:45Z",
  "event_type": "PreToolUse",
  "hook_data": {
    "tool": {
      "tool": "Bash",
      "args": {
        "command": "ls -la"
      }
    },
    "sessionId": "abc123",
    "cwd": "/home/user/project"
  }
}