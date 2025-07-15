# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ccstats is a Go-based command-line tool that analyzes Claude Code usage statistics and serves as a hooks integration system. It reads Claude Code logs to provide token usage analysis, cost calculations, and captures hook events for detailed usage patterns.

## Common Commands

### Build
```bash
go build -o ccstats main.go
```

### Run Statistics Analysis
```bash
./ccstats
```

### Run as Hook Handler
```bash
./ccstats hook
```

### Development Commands
```bash
go mod tidy          # Clean up dependencies
go run main.go       # Run without building binary
```

## Architecture

### Single-File Architecture
- **main.go**: Complete application logic with two main modes:
  - Statistics mode (default): Analyzes `~/.claude/projects/**/*.jsonl` files using DuckDB
  - Hook mode: Captures Claude Code hook events and logs to `~/.claude/hooks/hooks_YYYY-MM-DD.jsonl`

### Data Flow
1. **Statistics Mode**: Reads Claude logs → DuckDB analysis → Token/cost reports
2. **Hook Mode**: Receives hook events → Logs to JSONL → Pass-through to stdout (transparent)

### Key Dependencies
- `github.com/marcboeker/go-duckdb`: Analytical SQL queries on Claude logs
- Standard library for JSON processing and file operations

## Hook Integration Setup

To enable hook capture:
1. Build binary: `go build -o ccstats main.go`
2. Copy `claude-code-settings.json` to Claude config:
   - Global: `~/.config/claude/settings.json`
   - Project: `.claude/settings.json`
3. Update binary path in settings.json to match your build location

## Cost Calculation Logic

The tool calculates costs using model-specific pricing:
- **Opus**: $15/1M input, $75/1M output, $18.75/1M cache creation, $1.50/1M cache read
- **Haiku**: $0.80/1M input, $4/1M output, $1.00/1M cache creation, $0.08/1M cache read  
- **Sonnet** (default): $3/1M input, $15/1M output, $3.75/1M cache creation, $0.30/1M cache read

## File Structure

```
~/.claude/projects/**/*.jsonl    # Claude Code usage logs
~/.claude/hooks/hooks_*.jsonl    # Hook event logs (if hooks enabled)
claude-code-settings.json        # Hook configuration template
.claude/settings.local.json      # Local permissions for this project
```