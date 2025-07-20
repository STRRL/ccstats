import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@duckdb/node-api', '@duckdb/node-bindings', 'duckdb']
};

export default nextConfig;
