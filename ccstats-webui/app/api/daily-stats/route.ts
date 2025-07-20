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
  lastActivity: z.string().nullable()
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

    // First, let's use the same query structure as the working events API
    const query = `
      SELECT 
        DATE(CAST(timestamp AS TIMESTAMP)) as date,
        COUNT(DISTINCT sessionId) as sessions,
        COUNT(CASE WHEN type = 'user' THEN 1 END) as totalInteractions,
        COUNT(DISTINCT cwd) as activeProjects,
        -- Simple token extraction using the same approach as events API
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
        0 as avgSessionDuration,  -- Simplified for now
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
      ORDER BY date DESC
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

    // Add totalTokens field to each daily stat for the frontend
    const processedDailyStats = dailyStats.map((day: any) => ({
      ...day,
      totalTokens: (parseInt(day.inputTokens) || 0) + 
                   (parseInt(day.outputTokens) || 0) + 
                   (parseInt(day.cacheCreationTokens) || 0) + 
                   (parseInt(day.cacheReadTokens) || 0)
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