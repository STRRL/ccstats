package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
	
	_ "github.com/marcboeker/go-duckdb"
)

func runCCStats() {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Printf("Error getting home directory: %v\n", err)
		return
	}

	db, err := sql.Open("duckdb", "")
	if err != nil {
		fmt.Printf("Error opening DuckDB: %v\n", err)
		return
	}
	defer db.Close()

	// Create table from all JSONL files
	globPattern := filepath.Join(homeDir, ".claude", "projects", "**", "*.jsonl")
	createTableQuery := fmt.Sprintf(`
		CREATE TABLE all_data AS
		SELECT * FROM read_json('%s',
			format = 'newline_delimited',
			union_by_name = true,
			filename = true
		)`, globPattern)
	
	_, err = db.Exec(createTableQuery)
	if err != nil {
		fmt.Printf("Error creating table: %v\n", err)
		return
	}

	// Get token statistics
	var inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, grandTotal sql.NullInt64
	
	tokenStatsQuery := `
		SELECT
			SUM((json_extract_string(message::JSON, '$.usage.input_tokens'))::INTEGER) AS total_input_tokens,
			SUM((json_extract_string(message::JSON, '$.usage.output_tokens'))::INTEGER) AS total_output_tokens,
			SUM((json_extract_string(message::JSON, '$.usage.cache_read_input_tokens'))::INTEGER) AS total_cache_read_input_tokens,
			SUM((json_extract_string(message::JSON, '$.usage.cache_creation_input_tokens'))::INTEGER) AS total_cache_creation_input_tokens,
			SUM(
				COALESCE((json_extract_string(message::JSON, '$.usage.input_tokens'))::INTEGER, 0) +
				COALESCE((json_extract_string(message::JSON, '$.usage.output_tokens'))::INTEGER, 0) +
				COALESCE((json_extract_string(message::JSON, '$.usage.cache_read_input_tokens'))::INTEGER, 0) +
				COALESCE((json_extract_string(message::JSON, '$.usage.cache_creation_input_tokens'))::INTEGER, 0)
			) AS grand_total_tokens
		FROM all_data`
	
	row := db.QueryRow(tokenStatsQuery)
	err = row.Scan(&inputTokens, &outputTokens, &cacheReadTokens, &cacheCreationTokens, &grandTotal)
	if err != nil {
		fmt.Printf("Error getting token statistics: %v\n", err)
		return
	}

	fmt.Println("\n=== Token Usage Statistics ===")
	fmt.Printf("Input tokens: %d\n", inputTokens.Int64)
	fmt.Printf("Output tokens: %d\n", outputTokens.Int64)
	fmt.Printf("Cache read tokens: %d\n", cacheReadTokens.Int64)
	fmt.Printf("Cache creation tokens: %d\n", cacheCreationTokens.Int64)
	fmt.Printf("Grand total tokens: %d\n", grandTotal.Int64)

	// Get cost statistics
	var totalCost sql.NullFloat64
	
	costQuery := `
		SELECT
			SUM(
				(
					COALESCE(json_extract_string(message::JSON, '$.usage.input_tokens')::INTEGER, 0) *
						CASE
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-opus%' THEN 15.0
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-haiku%' THEN 0.80
							ELSE 3.0
						END
					+
					COALESCE(json_extract_string(message::JSON, '$.usage.output_tokens')::INTEGER, 0) *
						CASE
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-opus%' THEN 75.0
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-haiku%' THEN 4.0
							ELSE 15.0
						END
					+
					COALESCE(json_extract_string(message::JSON, '$.usage.cache_creation_input_tokens')::INTEGER, 0) *
						CASE
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-opus%' THEN 18.75
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-haiku%' THEN 1.00
							ELSE 3.75
						END
					+
					COALESCE(json_extract_string(message::JSON, '$.usage.cache_read_input_tokens')::INTEGER, 0) *
						CASE
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-opus%' THEN 1.50
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-haiku%' THEN 0.08
							ELSE 0.30
						END
				) / 1e6
			) AS total_cost_usd
		FROM all_data`
	
	row = db.QueryRow(costQuery)
	err = row.Scan(&totalCost)
	if err != nil {
		fmt.Printf("Error getting cost statistics: %v\n", err)
		return
	}

	fmt.Printf("\n=== Cost Analysis ===\n")
	fmt.Printf("Total cost: $%.2f USD\n", totalCost.Float64)

	// Get cost by project (grouped by cwd)
	costByProjectQuery := `
		SELECT
			cwd,
			SUM(
				(
					COALESCE(json_extract_string(message::JSON, '$.usage.input_tokens')::INTEGER, 0) *
						CASE
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-opus%' THEN 15.0
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-haiku%' THEN 0.80
							ELSE 3.0
						END
					+
					COALESCE(json_extract_string(message::JSON, '$.usage.output_tokens')::INTEGER, 0) *
						CASE
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-opus%' THEN 75.0
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-haiku%' THEN 4.0
							ELSE 15.0
						END
					+
					COALESCE(json_extract_string(message::JSON, '$.usage.cache_creation_input_tokens')::INTEGER, 0) *
						CASE
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-opus%' THEN 18.75
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-haiku%' THEN 1.00
							ELSE 3.75
						END
					+
					COALESCE(json_extract_string(message::JSON, '$.usage.cache_read_input_tokens')::INTEGER, 0) *
						CASE
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-opus%' THEN 1.50
							WHEN json_extract_string(message::JSON, '$.model') LIKE 'claude-haiku%' THEN 0.08
							ELSE 0.30
						END
				) / 1e6
			) AS project_cost_usd
		FROM all_data
		WHERE cwd IS NOT NULL
		GROUP BY cwd
		ORDER BY project_cost_usd DESC
		LIMIT 10`
	
	rows, err := db.Query(costByProjectQuery)
	if err != nil {
		fmt.Printf("Error getting cost by project: %v\n", err)
		return
	}
	defer rows.Close()

	fmt.Printf("\n=== Cost by Project (Top 10) ===\n")
	for rows.Next() {
		var cwd string
		var projectCost float64
		err = rows.Scan(&cwd, &projectCost)
		if err != nil {
			fmt.Printf("Error scanning row: %v\n", err)
			continue
		}
		
		// Extract project name from the last segment of the path
		projectName := filepath.Base(cwd)
		fmt.Printf("%-30s: $%.2f USD\n", projectName, projectCost)
	}

	// Analyze hooks data if available
	analyzeHooksData(db, homeDir)
}

func analyzeHooksData(db *sql.DB, homeDir string) {
	// Check if hooks directory exists
	hooksDir := filepath.Join(homeDir, ".claude", "hooks")
	if _, err := os.Stat(hooksDir); os.IsNotExist(err) {
		return // No hooks data to analyze
	}

	// Create table from hooks JSONL files
	hooksGlobPattern := filepath.Join(hooksDir, "*.jsonl")
	createHooksTableQuery := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS hooks_data AS
		SELECT * FROM read_json('%s',
			format = 'newline_delimited',
			union_by_name = true,
			filename = true
		)`, hooksGlobPattern)
	
	_, err := db.Exec(createHooksTableQuery)
	if err != nil {
		// No hooks data found or error reading
		return
	}

	// Get hooks statistics
	var totalHooks int64
	hookCountQuery := `SELECT COUNT(*) FROM hooks_data`
	row := db.QueryRow(hookCountQuery)
	if err := row.Scan(&totalHooks); err != nil || totalHooks == 0 {
		return
	}

	fmt.Printf("\n=== Hooks Statistics ===\n")
	fmt.Printf("Total hook events: %d\n", totalHooks)

	// Get hook events by type
	hooksByTypeQuery := `
		SELECT 
			event_type,
			COUNT(*) as count
		FROM hooks_data
		GROUP BY event_type
		ORDER BY count DESC`
	
	rows, err := db.Query(hooksByTypeQuery)
	if err == nil {
		defer rows.Close()
		fmt.Printf("\nHook events by type:\n")
		for rows.Next() {
			var eventType string
			var count int64
			if err := rows.Scan(&eventType, &count); err == nil {
				fmt.Printf("  %-20s: %d\n", eventType, count)
			}
		}
	}

	// Get tool usage from hooks (if PreToolUse/PostToolUse events exist)
	toolUsageQuery := `
		SELECT 
			json_extract_string(hook_data::JSON, '$.tool.tool') as tool_name,
			COUNT(*) as usage_count
		FROM hooks_data
		WHERE event_type IN ('PreToolUse', 'PostToolUse')
		AND json_extract_string(hook_data::JSON, '$.tool.tool') IS NOT NULL
		GROUP BY tool_name
		ORDER BY usage_count DESC
		LIMIT 10`
	
	rows, err = db.Query(toolUsageQuery)
	if err == nil {
		defer rows.Close()
		fmt.Printf("\nTop 10 tool usage from hooks:\n")
		hasTools := false
		for rows.Next() {
			var toolName string
			var count int64
			if err := rows.Scan(&toolName, &count); err == nil {
				fmt.Printf("  %-20s: %d\n", toolName, count)
				hasTools = true
			}
		}
		if !hasTools {
			fmt.Printf("  No tool usage data found\n")
		}
	}
}

type HookEvent struct {
	Timestamp   time.Time              `json:"timestamp"`
	EventType   string                 `json:"event_type"`
	HookData    map[string]interface{} `json:"hook_data"`
	ExitCode    int                    `json:"exit_code,omitempty"`
	StdoutData  string                 `json:"stdout_data,omitempty"`
	StderrData  string                 `json:"stderr_data,omitempty"`
}

func handleHook() error {
	// Read JSON input from stdin
	inputData, err := io.ReadAll(os.Stdin)
	if err != nil {
		return fmt.Errorf("error reading stdin: %w", err)
	}

	// Parse the input JSON
	var hookData map[string]interface{}
	if err := json.Unmarshal(inputData, &hookData); err != nil {
		return fmt.Errorf("error parsing JSON: %w", err)
	}

	// Determine event type from environment or hook data
	eventType := os.Getenv("CLAUDE_HOOK_EVENT")
	if eventType == "" {
		// Try to infer from hook data structure
		if _, ok := hookData["tool"]; ok {
			if _, ok := hookData["result"]; ok {
				eventType = "PostToolUse"
			} else {
				eventType = "PreToolUse"
			}
		} else if _, ok := hookData["notification"]; ok {
			eventType = "Notification"
		} else {
			eventType = "Unknown"
		}
	}

	// Create hook event
	event := HookEvent{
		Timestamp: time.Now(),
		EventType: eventType,
		HookData:  hookData,
		ExitCode:  0,
	}

	// Get hooks log file path
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("error getting home directory: %w", err)
	}

	hooksDir := filepath.Join(homeDir, ".claude", "hooks")
	if err := os.MkdirAll(hooksDir, 0755); err != nil {
		return fmt.Errorf("error creating hooks directory: %w", err)
	}

	// Create daily log file
	logFile := filepath.Join(hooksDir, fmt.Sprintf("hooks_%s.jsonl", time.Now().Format("2006-01-02")))
	
	// Open file in append mode
	file, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("error opening log file: %w", err)
	}
	defer file.Close()

	// Write event as JSONL
	encoder := json.NewEncoder(file)
	if err := encoder.Encode(event); err != nil {
		return fmt.Errorf("error writing to log file: %w", err)
	}

	// Output the original data back to stdout (pass-through behavior)
	fmt.Print(string(inputData))

	return nil
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "hook" {
		if err := handleHook(); err != nil {
			fmt.Fprintf(os.Stderr, "Hook handler error: %v\n", err)
			os.Exit(1)
		}
	} else {
		runCCStats()
	}
}
