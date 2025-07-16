import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'
import { getDuckDB } from '@/lib/duckdb'

export async function GET(request: NextRequest) {
  try {
    const { createConnection } = await getDuckDB()
    const db = await createConnection(':memory:')
    
    // Path to Claude logs directory
    const claudeDir = join(homedir(), '.claude', 'projects')
    
    // Check if the directory exists
    if (!existsSync(claudeDir)) {
      console.warn('Claude logs directory not found, returning mock data')
      await db.close()
      return NextResponse.json({ events: generateMockEvents() })
    }
    
    // Use glob pattern to match all .jsonl files recursively
    const logsPattern = join(claudeDir, '**', '*.jsonl').replace(/\\/g, '/')
    
    // Get current time and 1 hour ago for filtering
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000))
    
    // Query to get events from the last 1 hour using DuckDB
    const query = `
      SELECT 
        json_extract(line, '$.timestamp') as timestamp,
        json_extract(line, '$.event_type') as event_type,
        json_extract(line, '$.model') as model,
        json_extract(line, '$.usage.input_tokens') as input_tokens,
        json_extract(line, '$.usage.output_tokens') as output_tokens,
        json_extract(line, '$.usage.cache_creation_input_tokens') as cache_creation_tokens,
        json_extract(line, '$.usage.cache_read_input_tokens') as cache_read_tokens,
        json_extract(line, '$.project_name') as project_name,
        line as raw_data
      FROM read_text('${logsPattern}', format='auto') 
      WHERE line != '' 
        AND json_valid(line) 
        AND json_extract(line, '$.timestamp') IS NOT NULL
        AND strptime(json_extract(line, '$.timestamp'), '%Y-%m-%dT%H:%M:%S.%fZ') >= strptime('${oneHourAgo.toISOString()}', '%Y-%m-%dT%H:%M:%S.%fZ')
      ORDER BY timestamp DESC 
      LIMIT 200
    `
    
    try {
      const result = await db.prepare(query).all()
      await db.close()
      
      if (result.length === 0) {
        console.warn('No events found in Claude logs, returning mock data')
        return NextResponse.json({ events: generateMockEvents() })
      }
      
      return NextResponse.json({ events: result })
    } catch (queryError) {
      console.warn('Error executing DuckDB query, falling back to mock data:', queryError)
      await db.close()
      return NextResponse.json({ events: generateMockEvents() })
    }
    
  } catch (error) {
    console.error('Error with DuckDB connection:', error)
    return NextResponse.json({ events: generateMockEvents() })
  }
}

function generateMockEvents() {
  const mockEvents = []
  const eventTypes = ['chat_message', 'tool_use', 'completion', 'error']
  const models = ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229']
  const projects = ['ccstats', 'webui-project', 'demo-app']
  
  const now = Date.now()
  const oneHourAgo = now - (60 * 60 * 1000)
  
  // Generate events within the last hour with varying intervals
  for (let i = 0; i < 15; i++) {
    // Random time within the last hour
    const randomOffset = Math.random() * (60 * 60 * 1000) // Random within 1 hour
    const timestamp = new Date(oneHourAgo + randomOffset)
    
    mockEvents.push({
      timestamp: timestamp.toISOString(),
      event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      model: models[Math.floor(Math.random() * models.length)],
      input_tokens: Math.floor(Math.random() * 1000) + 100,
      output_tokens: Math.floor(Math.random() * 500) + 50,
      cache_creation_tokens: Math.floor(Math.random() * 200),
      cache_read_tokens: Math.floor(Math.random() * 100),
      project_name: projects[Math.floor(Math.random() * projects.length)],
      raw_data: JSON.stringify({
        timestamp: timestamp.toISOString(),
        event_type: 'mock_event',
        model: 'claude-3-5-sonnet-20241022'
      })
    })
  }
  
  // Sort by timestamp descending
  return mockEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}