import { executeDuckDBQuery, getDuckDBStatus } from "@/lib/duckdb-manager";
import { EventsApiResponseSchema, type EventsApiResponse } from "@/lib/schemas";
import { existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { homedir } from "os";
import { join } from "path";


export async function GET(request: NextRequest) {
  const claudeDir = join(homedir(), ".claude", "projects");
  const logsPattern = join(claudeDir, "**", "*.jsonl").replace(/\\/g, "/");

  console.log(`[API] GET /api/events - Starting request`);
  console.log(`[API] Claude directory: ${claudeDir}`);
  console.log(`[API] Directory exists: ${existsSync(claudeDir)}`);

  if (!existsSync(claudeDir)) {
    console.error(`[API] Claude logs directory not found: ${claudeDir}`);
    return NextResponse.json(
      {
        events: [],
        error: `Claude logs directory not found: ${claudeDir}`,
      },
      { status: 404 }
    );
  }

  try {
    const dbStatus = getDuckDBStatus();
    console.log(`[API] DuckDB status: ${JSON.stringify(dbStatus)}`);

    const query = `
      SELECT 
        CAST(uuid AS VARCHAR) as uuid,
        CAST(parentUuid AS VARCHAR) as parentUuid,
        CAST(leafUuid AS VARCHAR) as leafUuid,
        isSidechain,
        userType,
        cwd,
        sessionId,
        version,
        type,
        message,
        timestamp,
        isMeta,
        requestId,
        toolUseResult,
        isApiErrorMessage,
        content,
        toolUseID,
        level,
        summary,
        isCompactSummary,
        filename,
        gitBranch
      FROM read_json('${logsPattern}',
        format = 'newline_delimited',
        union_by_name = true,
        filename = true
      )
      WHERE CAST(timestamp AS TIMESTAMP) >= (NOW() - INTERVAL 1 HOUR)
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    console.log(`[API] Executing query...`);
    const startTime = Date.now();
    const result = await executeDuckDBQuery(query);
    const queryDuration = Date.now() - startTime;

    console.log(
      `[API] Query completed in ${queryDuration}ms, returned ${
        result?.length || 0
      } records`
    );

    // Construct response object
    const response: EventsApiResponse = {
      events: result,
      meta: {
        count: result?.length || 0,
        queryDuration,
        source: claudeDir,
      },
    };

    // Validate response against schema
    try {
      console.log(`[API] Validating response schema...`);
      EventsApiResponseSchema.parse(response);
      console.log(`[API] Schema validation passed`);
    } catch (schemaError) {
      console.error(`[API] Schema validation failed:`, schemaError);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error(`[API] Query failed:`, error);
    const errorStatus = getDuckDBStatus();
    console.error(`[API] DuckDB status during error:`, errorStatus);

    return NextResponse.json(
      {
        events: [],
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
