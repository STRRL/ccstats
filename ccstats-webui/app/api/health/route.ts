import { NextResponse } from 'next/server'
import { getDuckDBStatus, checkDuckDBHealth } from '@/lib/duckdb-manager'

export async function GET() {
  try {
    console.log('=== Health Check ===')
    
    // Get current status
    const status = getDuckDBStatus()
    console.log('DuckDB status:', status)
    
    // Perform health check
    const isHealthy = await checkDuckDBHealth()
    console.log('Health check result:', isHealthy)
    
    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      duckdb: {
        ...status,
        healthy: isHealthy
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Health check error:', error)
    
    return NextResponse.json({
      status: 'error',
      error: error?.message || String(error),
      duckdb: getDuckDBStatus(),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}