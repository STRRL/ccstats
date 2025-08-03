import { executeDuckDBQuery, getDuckDBStatus } from "@/lib/duckdb-manager";
import { existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { homedir } from "os";
import { join } from "path";
import { z } from "zod";

// Schema for daily statistics response
const DailyStatsSchema = z.object({
  date: z.string(),
  sessions: z.number(),
  totalInteractions: z.number(),
  totalTokens: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheCreationTokens: z.number(),
  cacheReadTokens: z.number(),
  activeProjects: z.number(),
  avgSessionDuration: z.number(),
  firstActivity: z.string().nullable(),
  lastActivity: z.string().nullable(),
  acceptRate: z.number(),
  codeAcceptRate: z.number(),
  totalLinesSuggested: z.number(),
  totalLinesAccepted: z.number()
});

const DailyStatsApiResponseSchema = z.object({
  dailyStats: z.array(DailyStatsSchema),
  summary: z.object({
    totalDays: z.number(),
    avgSessionsPerDay: z.number(),
    avgInteractionsPerDay: z.number(),
    avgTokensPerDay: z.number(),
    totalSessions: z.number(),
    totalTokens: z.number(),
    avgAcceptRate: z.number(),
    avgCodeAcceptRate: z.number(),
    totalLinesSuggested: z.number(),
    totalLinesAccepted: z.number(),
    mostActiveDay: z.string().nullable(),
    queryDuration: z.number()
  }),
  meta: z.object({
    count: z.number(),
    queryDuration: z.number(),
    source: z.string(),
    dateRange: z.object({
      start: z.string(),
      end: z.string(),
      days: z.number()
    })
  })
});

export type DailyStats = z.infer<typeof DailyStatsSchema>;
export type DailyStatsApiResponse = z.infer<typeof DailyStatsApiResponseSchema>;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const maxDays = Math.min(Math.max(days, 1), 365); // Limit between 1-365 days

  const claudeDir = join(homedir(), ".claude", "projects");
  const logsPattern = join(claudeDir, "**", "*.jsonl").replace(/\\/g, "/");

  console.log(`[API] GET /api/daily-stats - Starting request for ${maxDays} days`);
  console.log(`[API] Claude directory: ${claudeDir}`);
  console.log(`[API] Directory exists: ${existsSync(claudeDir)}`);

  if (!existsSync(claudeDir)) {
    console.error(`[API] Claude logs directory not found: ${claudeDir}`);
    return NextResponse.json(
      {
        dailyStats: [],
        error: `Claude logs directory not found: ${claudeDir}`,
      },
      { status: 404 }
    );
  }

  try {
    const dbStatus = getDuckDBStatus();
    console.log(`[API] DuckDB status: ${JSON.stringify(dbStatus)}`);

    // Query with code-level accept rate calculation
    const query = `
      WITH code_tools AS (
        SELECT 
          DATE(CAST(timestamp AS TIMESTAMP)) as date,
          sessionId,
          uuid,
          parentUuid,
          type,
          timestamp,
          -- Extract Edit tool parameters
          CASE 
            WHEN type = 'assistant' AND message IS NOT NULL 
                 AND json_extract_string(message, '$.content[0].name') = 'Edit'
            THEN json_extract_string(message, '$.content[0].input.old_string')
            ELSE NULL
          END as edit_old_string,
          CASE 
            WHEN type = 'assistant' AND message IS NOT NULL 
                 AND json_extract_string(message, '$.content[0].name') = 'Edit'
            THEN json_extract_string(message, '$.content[0].input.new_string')
            ELSE NULL
          END as edit_new_string,
          -- Extract Write tool parameters
          CASE 
            WHEN type = 'assistant' AND message IS NOT NULL 
                 AND json_extract_string(message, '$.content[0].name') = 'Write'
            THEN json_extract_string(message, '$.content[0].input.content')
            ELSE NULL
          END as write_content,
          -- Extract MultiEdit tool parameters (simplified - count first edit for now)
          CASE 
            WHEN type = 'assistant' AND message IS NOT NULL 
                 AND json_extract_string(message, '$.content[0].name') = 'MultiEdit'
            THEN json_extract_string(message, '$.content[0].input.edits[0].new_string')
            ELSE NULL
          END as multiedit_content,
          -- General tool usage detection
          CASE 
            WHEN type = 'assistant' AND message IS NOT NULL AND 
                 (json_extract_string(message, '$.stop_reason') = 'tool_use' OR 
                  message.content LIKE '%tool_use%')
            THEN 1 ELSE 0
          END as is_tool_suggestion,
          message
        FROM read_json('${logsPattern}',
          format = 'newline_delimited',
          union_by_name = true,
          filename = true
        )
        WHERE CAST(timestamp AS TIMESTAMP) >= (NOW() - INTERVAL ${maxDays} DAYS)
          AND CAST(timestamp AS TIMESTAMP) IS NOT NULL
      ),
      code_metrics AS (
        SELECT 
          date,
          sessionId,
          uuid,
          -- Calculate lines suggested by Claude
          CASE 
            WHEN edit_new_string IS NOT NULL 
            THEN LENGTH(edit_new_string) - LENGTH(REPLACE(edit_new_string, CHR(10), '')) + 1
            WHEN write_content IS NOT NULL 
            THEN LENGTH(write_content) - LENGTH(REPLACE(write_content, CHR(10), '')) + 1
            WHEN multiedit_content IS NOT NULL 
            THEN LENGTH(multiedit_content) - LENGTH(REPLACE(multiedit_content, CHR(10), '')) + 1
            ELSE 0
          END as lines_suggested,
          is_tool_suggestion
        FROM code_tools
        WHERE edit_new_string IS NOT NULL OR write_content IS NOT NULL OR multiedit_content IS NOT NULL
      ),
      interruptions AS (
        SELECT 
          DATE(CAST(timestamp AS TIMESTAMP)) as date,
          parentUuid as interrupted_uuid
        FROM read_json('${logsPattern}',
          format = 'newline_delimited',
          union_by_name = true,
          filename = true
        )
        WHERE type = 'user' 
          AND message IS NOT NULL 
          AND message.content LIKE '%Request interrupted by user%'
          AND CAST(timestamp AS TIMESTAMP) >= (NOW() - INTERVAL ${maxDays} DAYS)
      ),
      daily_stats AS (
        SELECT 
          DATE(CAST(timestamp AS TIMESTAMP)) as date,
          COUNT(DISTINCT sessionId) as sessions,
          COUNT(CASE WHEN type = 'user' THEN 1 END) as totalInteractions,
          COUNT(DISTINCT cwd) as activeProjects,
          -- Token calculations
          COALESCE(SUM(
            CASE 
              WHEN message IS NOT NULL AND json_extract_string(message, '$.usage.input_tokens') != ''
              THEN TRY_CAST(json_extract_string(message, '$.usage.input_tokens') AS INTEGER)
              ELSE 0
            END
          ), 0) as inputTokens,
          COALESCE(SUM(
            CASE 
              WHEN message IS NOT NULL AND json_extract_string(message, '$.usage.output_tokens') != ''
              THEN TRY_CAST(json_extract_string(message, '$.usage.output_tokens') AS INTEGER)
              ELSE 0
            END
          ), 0) as outputTokens,
          COALESCE(SUM(
            CASE 
              WHEN message IS NOT NULL AND json_extract_string(message, '$.usage.cache_creation_input_tokens') != ''
              THEN TRY_CAST(json_extract_string(message, '$.usage.cache_creation_input_tokens') AS INTEGER)
              ELSE 0
            END
          ), 0) as cacheCreationTokens,
          COALESCE(SUM(
            CASE 
              WHEN message IS NOT NULL AND json_extract_string(message, '$.usage.cache_read_input_tokens') != ''
              THEN TRY_CAST(json_extract_string(message, '$.usage.cache_read_input_tokens') AS INTEGER)
              ELSE 0
            END
          ), 0) as cacheReadTokens,
          -- Tool-level accept rate calculation
          COUNT(CASE WHEN type = 'assistant' AND message IS NOT NULL AND 
                      (json_extract_string(message, '$.stop_reason') = 'tool_use' OR 
                       message.content LIKE '%tool_use%') THEN 1 END) as toolSuggestions,
          COUNT(CASE WHEN type = 'user' AND message IS NOT NULL AND 
                      message.content LIKE '%Request interrupted by user%' THEN 1 END) as userInterruptions,
          MIN(timestamp)::VARCHAR as firstActivity,
          MAX(timestamp)::VARCHAR as lastActivity
        FROM read_json('${logsPattern}',
          format = 'newline_delimited',
          union_by_name = true,
          filename = true
        )
        WHERE CAST(timestamp AS TIMESTAMP) >= (NOW() - INTERVAL ${maxDays} DAYS)
          AND CAST(timestamp AS TIMESTAMP) IS NOT NULL
        GROUP BY DATE(CAST(timestamp AS TIMESTAMP))
      ),
      code_daily_stats AS (
        SELECT 
          cm.date,
          SUM(cm.lines_suggested) as total_lines_suggested,
          SUM(CASE WHEN i.interrupted_uuid IS NULL THEN cm.lines_suggested ELSE 0 END) as total_lines_accepted
        FROM code_metrics cm
        LEFT JOIN interruptions i ON cm.uuid = i.interrupted_uuid AND cm.date = i.date
        GROUP BY cm.date
      )
      SELECT 
        ds.date,
        ds.sessions,
        ds.totalInteractions,
        ds.activeProjects,
        ds.inputTokens,
        ds.outputTokens,
        ds.cacheCreationTokens,
        ds.cacheReadTokens,
        -- Tool-level accept rate: (tool suggestions - interruptions) / tool suggestions
        CASE 
          WHEN ds.toolSuggestions > 0 
          THEN ROUND(((ds.toolSuggestions - ds.userInterruptions)::FLOAT / ds.toolSuggestions * 100), 2)
          ELSE 100.0
        END as acceptRate,
        -- Code-level accept rate: (accepted lines) / suggested lines
        CASE 
          WHEN COALESCE(cds.total_lines_suggested, 0) > 0 
          THEN ROUND((COALESCE(cds.total_lines_accepted, 0)::FLOAT / cds.total_lines_suggested * 100), 2)
          ELSE 100.0
        END as codeAcceptRate,
        COALESCE(cds.total_lines_suggested, 0) as totalLinesSuggested,
        COALESCE(cds.total_lines_accepted, 0) as totalLinesAccepted,
        0 as avgSessionDuration,  -- Simplified for now
        ds.firstActivity,
        ds.lastActivity
      FROM daily_stats ds
      LEFT JOIN code_daily_stats cds ON ds.date = cds.date
      ORDER BY ds.date DESC
    `;

    console.log(`[API] Executing daily stats query...`);
    const startTime = Date.now();
    const result = await executeDuckDBQuery(query);
    const queryDuration = Date.now() - startTime;

    console.log(
      `[API] Query completed in ${queryDuration}ms, returned ${
        result?.length || 0
      } daily records`
    );

    // Calculate summary statistics with proper number handling
    const dailyStats = result || [];
    console.log(`[API] Sample daily stat:`, dailyStats[0]);
    
    const totalDays = dailyStats.length;
    const totalSessions = dailyStats.reduce((sum: number, day: any) => {
      const sessions = parseInt(day.sessions) || 0;
      return sum + sessions;
    }, 0);
    
    // Calculate total tokens and interactions properly
    const totalTokens = dailyStats.reduce((sum: number, day: any) => {
      const inputTokens = parseInt(day.inputTokens) || 0;
      const outputTokens = parseInt(day.outputTokens) || 0;
      const cacheCreationTokens = parseInt(day.cacheCreationTokens) || 0;
      const cacheReadTokens = parseInt(day.cacheReadTokens) || 0;
      const dayTotal = inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;
      return sum + dayTotal;
    }, 0);
    
    const totalInteractions = dailyStats.reduce((sum: number, day: any) => {
      const interactions = parseInt(day.totalInteractions) || 0;
      return sum + interactions;
    }, 0);
    
    // Calculate average accept rates
    const avgAcceptRate = dailyStats.length > 0 
      ? Math.round((dailyStats.reduce((sum: number, day: any) => sum + (parseFloat(day.acceptRate) || 0), 0) / dailyStats.length) * 100) / 100
      : 0;
    
    const avgCodeAcceptRate = dailyStats.length > 0 
      ? Math.round((dailyStats.reduce((sum: number, day: any) => sum + (parseFloat(day.codeAcceptRate) || 0), 0) / dailyStats.length) * 100) / 100
      : 0;
    
    // Calculate total code metrics
    const totalLinesSuggested = dailyStats.reduce((sum: number, day: any) => {
      const lines = parseInt(day.totalLinesSuggested) || 0;
      return sum + lines;
    }, 0);
    
    const totalLinesAccepted = dailyStats.reduce((sum: number, day: any) => {
      const lines = parseInt(day.totalLinesAccepted) || 0;
      return sum + lines;
    }, 0);
    
    const avgSessionsPerDay = totalDays > 0 ? Math.round((totalSessions / totalDays) * 100) / 100 : 0;
    const avgInteractionsPerDay = totalDays > 0 ? Math.round((totalInteractions / totalDays) * 100) / 100 : 0;
    const avgTokensPerDay = totalDays > 0 ? Math.round(totalTokens / totalDays) : 0;
    
    // Find most active day
    const mostActiveDay = dailyStats.length > 0 
      ? dailyStats.reduce((prev: any, current: any) => 
          current.totalInteractions > prev.totalInteractions ? current : prev
        ).date
      : null;

    // Date range info
    const now = new Date();
    const startDate = new Date(now.getTime() - (maxDays * 24 * 60 * 60 * 1000));

    // Add totalTokens field and ensure proper type conversion for the frontend
    const processedDailyStats = dailyStats.map((day: any) => ({
      ...day,
      totalTokens: (parseInt(day.inputTokens) || 0) + 
                   (parseInt(day.outputTokens) || 0) + 
                   (parseInt(day.cacheCreationTokens) || 0) + 
                   (parseInt(day.cacheReadTokens) || 0),
      acceptRate: parseFloat(day.acceptRate) || 0,
      codeAcceptRate: parseFloat(day.codeAcceptRate) || 0,
      totalLinesSuggested: parseInt(day.totalLinesSuggested) || 0,
      totalLinesAccepted: parseInt(day.totalLinesAccepted) || 0
    }));

    const response: DailyStatsApiResponse = {
      dailyStats: processedDailyStats,
      summary: {
        totalDays,
        avgSessionsPerDay,
        avgInteractionsPerDay,
        avgTokensPerDay,
        totalSessions,
        totalTokens,
        avgAcceptRate,
        avgCodeAcceptRate,
        totalLinesSuggested,
        totalLinesAccepted,
        mostActiveDay,
        queryDuration
      },
      meta: {
        count: dailyStats.length,
        queryDuration,
        source: claudeDir,
        dateRange: {
          start: startDate.toISOString(),
          end: now.toISOString(),
          days: maxDays
        }
      }
    };

    // Validate response against schema
    try {
      console.log(`[API] Validating daily stats response schema...`);
      DailyStatsApiResponseSchema.parse(response);
      console.log(`[API] Schema validation passed`);
    } catch (schemaError) {
      console.error(`[API] Schema validation failed:`, schemaError);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error(`[API] Daily stats query failed:`, error);
    const errorStatus = getDuckDBStatus();
    console.error(`[API] DuckDB status during error:`, errorStatus);

    return NextResponse.json(
      {
        dailyStats: [],
        error: error instanceof Error ? error.message : String(error),
        meta: {
          count: 0,
          source: claudeDir,
          duckdbStatus: errorStatus,
        },
      },
      { status: 500 }
    );
  }
}