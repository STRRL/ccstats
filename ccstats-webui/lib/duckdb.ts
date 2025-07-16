// Persistent DuckDB instance
let duckdb: any = null

// Get or create consistent DuckDB instance
export async function getDuckDB() {
  if (!duckdb) {
    duckdb = await import('@duckdb/node-api')
  }
  return duckdb
}