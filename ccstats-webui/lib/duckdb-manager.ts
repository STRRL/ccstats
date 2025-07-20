import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api'

interface QueryTask {
  id: string
  query: string
  resolve: (result: any) => void
  reject: (error: Error) => void
  timestamp: number
}

/**
 * DuckDB 管理器 - 实现单连接 + 查询队列模式
 * 
 * 基于 DuckDB Node.js 最佳实践：
 * 1. 重用单个连接以避免开销和保持缓存
 * 2. 串行化查询执行以避免阻塞问题
 * 3. 实现查询队列管理并发请求
 */
class DuckDBManager {
  private instance: DuckDBInstance | null = null
  private connection: DuckDBConnection | null = null
  private queryQueue: QueryTask[] = []
  private isProcessing = false
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null

  /**
   * 获取或创建 DuckDB 连接
   */
  private async ensureConnection(): Promise<DuckDBConnection> {
    if (this.connection) {
      return this.connection
    }

    if (!this.isInitialized) {
      if (!this.initializationPromise) {
        this.initializationPromise = this.initialize()
      }
      await this.initializationPromise
    }

    if (!this.connection) {
      throw new Error('Failed to initialize DuckDB connection')
    }

    return this.connection
  }

  /**
   * 初始化数据库连接
   */
  private async initialize(): Promise<void> {
    try {
      console.log('Initializing DuckDB instance and connection...')
      
      // 根据官方文档，先创建 instance，再创建 connection
      this.instance = await DuckDBInstance.create()
      console.log('DuckDB instance created')
      
      this.connection = await this.instance.connect()
      console.log('DuckDB connection created')
      
      this.isInitialized = true
      
      // 设置进程退出时的清理逻辑
      if (!process.listeners('SIGINT').some(listener => listener.name === 'duckdbCleanup')) {
        const cleanup = async () => {
          console.log('Cleaning up DuckDB connection...')
          await this.close()
          process.exit(0)
        }
        Object.defineProperty(cleanup, 'name', { value: 'duckdbCleanup' })
        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)
      }

      console.log('DuckDB connection initialized successfully')
    } catch (error) {
      console.error('Failed to initialize DuckDB:', error)
      this.isInitialized = false
      this.initializationPromise = null
      this.instance = null
      this.connection = null
      
      // 清空队列并拒绝所有待处理的查询
      while (this.queryQueue.length > 0) {
        const task = this.queryQueue.shift()!
        task.reject(new Error(`DuckDB initialization failed: ${error}`))
      }
      
      throw new Error(`Failed to initialize DuckDB: ${error}`)
    }
  }

  /**
   * 执行查询 - 添加到队列中串行执行
   */
  async query(sql: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const task: QueryTask = {
        id: Math.random().toString(36).substr(2, 9),
        query: sql,
        resolve,
        reject,
        timestamp: Date.now()
      }

      this.queryQueue.push(task)
      console.log(`Query ${task.id} added to queue. Queue length: ${this.queryQueue.length}`)
      
      // 开始处理队列
      this.processQueue()
    })
  }

  /**
   * 处理查询队列 - 串行执行
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queryQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      while (this.queryQueue.length > 0) {
        const task = this.queryQueue.shift()!
        
        try {
          console.log(`Processing query ${task.id}...`)
          console.log(`Query: ${task.query.substring(0, 100)}...`)
          
          const connection = await this.ensureConnection()
          const startTime = Date.now()
          
          // 使用 runAndReadAll 来获取结果
          const reader = await connection.runAndReadAll(task.query)
          
          const duration = Date.now() - startTime
          console.log(`Query ${task.id} completed in ${duration}ms`)
          
          // 获取行对象数组
          const rows = reader.getRowObjectsJson()
          console.log('Query returned', rows.length, 'rows')
          if (rows.length > 0) {
            console.log('Sample row:', rows[0])
          }
          
          task.resolve(rows)
        } catch (error) {
          console.error(`Query ${task.id} failed:`, error)
          task.reject(error instanceof Error ? error : new Error(String(error)))
        }
      }
    } finally {
      // 确保无论如何都要重置处理状态
      this.isProcessing = false
      console.log('Queue processing completed. isProcessing reset to false.')
      
      // 如果还有待处理的查询，继续处理
      if (this.queryQueue.length > 0) {
        console.log(`Still have ${this.queryQueue.length} queries in queue, processing...`)
        setTimeout(() => this.processQueue(), 0)
      }
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): { queueLength: number; isProcessing: boolean; isInitialized: boolean } {
    return {
      queueLength: this.queryQueue.length,
      isProcessing: this.isProcessing,
      isInitialized: this.isInitialized
    }
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    console.log(`Clearing ${this.queryQueue.length} pending queries`)
    while (this.queryQueue.length > 0) {
      const task = this.queryQueue.shift()!
      task.reject(new Error('Query cancelled - queue cleared'))
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    console.log('Closing DuckDB connection...')
    
    // 清空待处理的查询
    this.clearQueue()
    
    if (this.connection) {
      try {
        // 根据文档，使用 disconnectSync 或 closeSync
        if ('disconnectSync' in this.connection && typeof this.connection.disconnectSync === 'function') {
          this.connection.disconnectSync()
          console.log('DuckDB connection disconnected')
        } else if ('closeSync' in this.connection && typeof this.connection.closeSync === 'function') {
          this.connection.closeSync()
          console.log('DuckDB connection closed')
        }
        this.connection = null
      } catch (error) {
        console.warn('Error closing DuckDB connection:', error)
      }
    }
    
    if (this.instance) {
      try {
        // 关闭 instance
        if ('closeSync' in this.instance && typeof this.instance.closeSync === 'function') {
          this.instance.closeSync()
          console.log('DuckDB instance closed')
        }
        this.instance = null
      } catch (error) {
        console.warn('Error closing DuckDB instance:', error)
      }
    }
    
    this.isInitialized = false
    this.initializationPromise = null
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1 as health_check')
      return true
    } catch (error) {
      console.error('DuckDB health check failed:', error)
      return false
    }
  }
}

// 全局单例实例
const duckDBManager = new DuckDBManager()

/**
 * 执行 DuckDB 查询
 * @param sql SQL 查询语句
 * @returns 查询结果
 */
export async function executeDuckDBQuery(sql: string): Promise<any> {
  return duckDBManager.query(sql)
}

/**
 * 获取数据库管理器状态
 */
export function getDuckDBStatus() {
  return duckDBManager.getQueueStatus()
}

/**
 * 执行健康检查
 */
export async function checkDuckDBHealth(): Promise<boolean> {
  return duckDBManager.healthCheck()
}

/**
 * 关闭数据库连接（主要用于测试和开发）
 */
export async function closeDuckDB(): Promise<void> {
  return duckDBManager.close()
}

export default duckDBManager