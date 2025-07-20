'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts'
import type { DailyStats, DailyStatsApiResponse } from '@/app/api/daily-stats/route'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function DailyStats() {
  const [data, setData] = useState<DailyStatsApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState(30)

  useEffect(() => {
    fetchDailyStats()
  }, [selectedDays])

  const fetchDailyStats = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/daily-stats?days=${selectedDays}`)
      if (!response.ok) {
        throw new Error('Failed to fetch daily stats')
      }
      const result = await response.json()
      console.log('Fetched daily stats:', result)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
    return tokens.toString()
  }

  const getWeekdayData = () => {
    if (!data?.dailyStats) return []
    
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekdayStats = Array(7).fill(0).map((_, i) => ({
      weekday: weekdays[i],
      sessions: 0,
      interactions: 0,
      count: 0
    }))

    data.dailyStats.forEach(day => {
      const date = new Date(day.date)
      const weekday = date.getDay()
      weekdayStats[weekday].sessions += day.sessions
      weekdayStats[weekday].interactions += day.totalInteractions
      weekdayStats[weekday].count += 1
    })

    return weekdayStats.map(stat => ({
      weekday: stat.weekday,
      avgSessions: stat.count > 0 ? Math.round((stat.sessions / stat.count) * 100) / 100 : 0,
      avgInteractions: stat.count > 0 ? Math.round((stat.interactions / stat.count) * 100) / 100 : 0
    }))
  }

  const getTokenDistribution = () => {
    if (!data?.dailyStats) return []
    
    const totalInputTokens = data.dailyStats.reduce((sum, day) => sum + day.inputTokens, 0)
    const totalOutputTokens = data.dailyStats.reduce((sum, day) => sum + day.outputTokens, 0)
    const totalCacheCreation = data.dailyStats.reduce((sum, day) => sum + day.cacheCreationTokens, 0)
    const totalCacheRead = data.dailyStats.reduce((sum, day) => sum + day.cacheReadTokens, 0)

    return [
      { name: '输入 Tokens', value: totalInputTokens, color: COLORS[0] },
      { name: '输出 Tokens', value: totalOutputTokens, color: COLORS[1] },
      { name: '缓存创建', value: totalCacheCreation, color: COLORS[2] },
      { name: '缓存读取', value: totalCacheRead, color: COLORS[3] }
    ].filter(item => item.value > 0)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Error: {error}
      </div>
    )
  }

  if (!data?.dailyStats || data.dailyStats.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        <div className="text-6xl mb-4">📊</div>
        <div className="text-xl">暂无数据</div>
        <div className="text-sm mt-2">请确保 Claude Code 日志文件存在于 ~/.claude/projects/</div>
      </div>
    )
  }

  const weekdayData = getWeekdayData()
  const tokenDistribution = getTokenDistribution()
  const chartData = data.dailyStats.slice().reverse() // Reverse to show chronological order

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">每日 AI 编程频率</h2>
        <div className="flex gap-2">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setSelectedDays(days)}
              className={`px-3 py-1 rounded text-sm ${
                selectedDays === days
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {days} 天
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">总天数</div>
          <div className="text-2xl font-bold text-blue-600">{data.summary.totalDays}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">平均每日会话</div>
          <div className="text-2xl font-bold text-green-600">{data.summary.avgSessionsPerDay}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">平均用户消息</div>
          <div className="text-2xl font-bold text-indigo-600">{data.summary.avgInteractionsPerDay}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">平均每日 Tokens</div>
          <div className="text-2xl font-bold text-purple-600">{formatTokens(data.summary.avgTokensPerDay)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">总会话数</div>
          <div className="text-2xl font-bold text-orange-600">{data.summary.totalSessions}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily Sessions Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">每日会话数趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatDate} />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => `日期: ${formatDate(value as string)}`}
                formatter={(value, name) => [value, name === 'sessions' ? '会话数' : name]}
              />
              <Bar dataKey="sessions" fill="#3B82F6" name="会话数" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily User Messages Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">每日用户消息数趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatDate} />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => `日期: ${formatDate(value as string)}`}
                formatter={(value, name) => [value, name === 'totalInteractions' ? '用户消息数' : name]}
              />
              <Bar dataKey="totalInteractions" fill="#6366F1" name="用户消息数" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Token Usage Trend */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Token 使用量趋势</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} />
            <YAxis tickFormatter={formatTokens} />
            <Tooltip 
              labelFormatter={(value) => `日期: ${formatDate(value as string)}`}
              formatter={(value, name) => [
                formatTokens(value as number), 
                name === 'totalTokens' ? '总 Tokens' : 
                name === 'inputTokens' ? '输入 Tokens' :
                name === 'outputTokens' ? '输出 Tokens' : name
              ]}
            />
            <Legend />
            <Line type="monotone" dataKey="totalTokens" stroke="#8B5CF6" name="总 Tokens" strokeWidth={2} />
            <Line type="monotone" dataKey="inputTokens" stroke="#06B6D4" name="输入 Tokens" strokeWidth={1} />
            <Line type="monotone" dataKey="outputTokens" stroke="#10B981" name="输出 Tokens" strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly Pattern */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">每周使用模式</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weekdayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="weekday" />
              <YAxis />
              <Tooltip formatter={(value, name) => [value, name === 'avgSessions' ? '平均会话数' : '平均交互数']} />
              <Bar dataKey="avgSessions" fill="#F59E0B" name="平均会话数" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Token Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Token 分布</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={tokenDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {tokenDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatTokens(value as number)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Activity Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">每日活动详情</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">日期</th>
                <th className="text-left p-3">会话数</th>
                <th className="text-left p-3">用户消息数</th>
                <th className="text-left p-3">总 Tokens</th>
                <th className="text-left p-3">活跃项目</th>
                <th className="text-left p-3">平均会话时长</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.dailyStats.slice(0, 14).map((day) => (
                <tr key={day.date} className="hover:bg-gray-50">
                  <td className="p-3 font-medium">{formatDate(day.date)}</td>
                  <td className="p-3">{day.sessions}</td>
                  <td className="p-3">{day.totalInteractions}</td>
                  <td className="p-3">{formatTokens(day.totalTokens)}</td>
                  <td className="p-3">{day.activeProjects}</td>
                  <td className="p-3">{Math.round(day.avgSessionDuration)} 分钟</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Most Active Day */}
      {data.summary.mostActiveDay && (
        <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>最活跃的一天:</strong> {formatDate(data.summary.mostActiveDay)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}