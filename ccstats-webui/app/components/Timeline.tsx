'use client'

import { type Event, type Usage } from '@/lib/schemas'
import { useEffect, useState } from 'react'

interface TimelineEvent extends Event {
  parsedContent?: any
}

const parseEventContent = (event: Event): any => {
  // For assistant messages with tool use
  if (event.type === 'assistant' && event.message?.content) {
    try {
      const content = JSON.parse(event.message.content)
      if (Array.isArray(content) && content[0]?.type === 'tool_use') {
        return content[0]
      } else if (Array.isArray(content) && content[0]?.type === 'text') {
        return content[0]
      }
    } catch {
      // Not JSON, return as is
    }
  }

  // For user messages with tool results
  if (event.type === 'user' && event.message?.content) {
    try {
      const content = JSON.parse(event.message.content)
      if (Array.isArray(content) && content[0]?.type === 'tool_result') {
        return content[0]
      }
    } catch {
      // Not JSON, return as is
    }
  }

  return null
}

const getEventIcon = (event: Event) => {
  if (event.type === 'assistant') {
    const parsed = parseEventContent(event)
    if (parsed?.type === 'tool_use') {
      return '🔧'
    }
    return '🤖'
  } else if (event.type === 'user') {
    const parsed = parseEventContent(event)
    if (parsed?.type === 'tool_result') {
      return '📊'
    }
    return '👤'
  } else if (event.type === 'system') {
    if (event.level === 'error') return '❌'
    if (event.level === 'warning') return '⚠️'
    return '⚙️'
  }
  return '📝'
}

const getEventColor = (event: Event) => {
  if (event.type === 'assistant') {
    return 'bg-blue-500'
  } else if (event.type === 'user') {
    return 'bg-green-500'
  } else if (event.type === 'system') {
    if (event.level === 'error') return 'bg-red-500'
    if (event.level === 'warning') return 'bg-yellow-500'
    return 'bg-gray-500'
  }
  return 'bg-gray-400'
}

const getEventTitle = (event: Event) => {
  if (event.type === 'assistant') {
    const parsed = parseEventContent(event)
    if (parsed?.type === 'tool_use') {
      return `Tool Use: ${parsed.name}`
    }
    return 'Assistant Response'
  } else if (event.type === 'user') {
    const parsed = parseEventContent(event)
    if (parsed?.type === 'tool_result') {
      return 'Tool Result'
    }
    return 'User Message'
  } else if (event.type === 'system') {
    return event.content || 'System Event'
  }
  return event.type || 'Unknown Event'
}

const formatTokenNumber = (value: string | number | undefined): number => {
  if (value === undefined || value === null) return 0
  return typeof value === 'string' ? parseInt(value, 10) : value
}

const calculateTotalTokens = (usage: Usage | null | undefined): number => {
  if (!usage) return 0
  return formatTokenNumber(usage.input_tokens) +
    formatTokenNumber(usage.output_tokens) +
    formatTokenNumber(usage.cache_creation_input_tokens) +
    formatTokenNumber(usage.cache_read_input_tokens)
}

const renderEventDetails = (event: Event) => {
  const parsedContent = parseEventContent(event)

  return (
    <div className="space-y-4">
      {/* Message Details */}
      {event.message && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Message Details</h4>

          {/* Role and Model */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <span className="text-xs text-gray-500">Role:</span>
              <span className="ml-2 text-sm font-medium">{event.message.role}</span>
            </div>
            {event.message.model && (
              <div>
                <span className="text-xs text-gray-500">Model:</span>
                <span className="ml-2 text-sm font-medium">{event.message.model}</span>
              </div>
            )}
          </div>

          {/* Content */}
          {event.message.content && (
            <div className="mb-3">
              <span className="text-xs text-gray-500">Content:</span>
              <div className="mt-1 bg-white rounded p-2 text-sm max-h-40 overflow-auto">
                {typeof event.message.content === 'string' && event.message.content.length < 200
                  ? event.message.content
                  : <pre className="text-xs">{JSON.stringify(parsedContent || event.message.content, null, 2)}</pre>}
              </div>
            </div>
          )}

          {/* Tool Use Details */}
          {parsedContent?.type === 'tool_use' && (
            <div className="bg-blue-50 rounded p-3">
              <h5 className="text-sm font-medium text-blue-900 mb-2">Tool: {parsedContent.name}</h5>
              {parsedContent.input && (
                <div>
                  <span className="text-xs text-blue-700">Input:</span>
                  <pre className="mt-1 text-xs bg-white rounded p-2 max-h-32 overflow-auto">
                    {JSON.stringify(parsedContent.input, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Usage Stats */}
          {event.message.usage && (
            <div className="bg-purple-50 rounded p-3 mt-3">
              <h5 className="text-sm font-medium text-purple-900 mb-2">Token Usage</h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-purple-700">Input:</span>
                  <span className="ml-1 font-medium">{formatTokenNumber(event.message.usage.input_tokens)}</span>
                </div>
                <div>
                  <span className="text-purple-700">Output:</span>
                  <span className="ml-1 font-medium">{formatTokenNumber(event.message.usage.output_tokens)}</span>
                </div>
                {event.message.usage.cache_creation_input_tokens && (
                  <div>
                    <span className="text-purple-700">Cache Creation:</span>
                    <span className="ml-1 font-medium">{formatTokenNumber(event.message.usage.cache_creation_input_tokens)}</span>
                  </div>
                )}
                {event.message.usage.cache_read_input_tokens && (
                  <div>
                    <span className="text-purple-700">Cache Read:</span>
                    <span className="ml-1 font-medium">{formatTokenNumber(event.message.usage.cache_read_input_tokens)}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-purple-200">
                <span className="text-xs text-purple-700">Total:</span>
                <span className="ml-1 text-sm font-bold text-purple-900">{calculateTotalTokens(event.message.usage)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* System Event Details */}
      {event.type === 'system' && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">System Event</h4>
          {event.content && (
            <div className="text-sm text-gray-600">{event.content}</div>
          )}
          {event.toolUseID && (
            <div className="mt-2">
              <span className="text-xs text-gray-500">Tool Use ID:</span>
              <span className="ml-2 text-xs font-mono">{event.toolUseID}</span>
            </div>
          )}
          {event.level && (
            <div className="mt-1">
              <span className="text-xs text-gray-500">Level:</span>
              <span className="ml-2 text-sm font-medium">{event.level}</span>
            </div>
          )}
        </div>
      )}

      {/* Tool Result */}
      {event.toolUseResult && (
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-green-700 mb-2">Tool Result</h4>
          <pre className="text-xs bg-white rounded p-2 max-h-40 overflow-auto">
            {typeof event.toolUseResult === 'string'
              ? event.toolUseResult
              : JSON.stringify(event.toolUseResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Metadata</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Session ID:</span>
            <span className="ml-1 font-mono text-gray-700">{event.sessionId.slice(0, 8)}...</span>
          </div>
          <div>
            <span className="text-gray-500">Version:</span>
            <span className="ml-1 text-gray-700">{event.version}</span>
          </div>
          {event.requestId && (
            <div>
              <span className="text-gray-500">Request ID:</span>
              <span className="ml-1 font-mono text-gray-700">{event.requestId.slice(0, 8)}...</span>
            </div>
          )}
          {event.gitBranch && (
            <div>
              <span className="text-gray-500">Git Branch:</span>
              <span className="ml-1 text-gray-700">{event.gitBranch}</span>
            </div>
          )}
        </div>
        <div className="mt-2">
          <span className="text-xs text-gray-500">Project:</span>
          <div className="text-xs font-mono text-gray-700 mt-1 break-all">{event.cwd}</div>
        </div>
      </div>
    </div>
  )
}

export default function Timeline() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events')
      if (!response.ok) {
        throw new Error('Failed to fetch events')
      }
      const data = await response.json()
      console.log('Fetched events:', data.events?.length || 0)

      const events = Array.isArray(data.events) ? data.events : []
      setEvents(events)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return '--:--:--'
      return date.toLocaleTimeString()
    } catch {
      return '--:--:--'
    }
  }

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return '--/--/----'
      return date.toLocaleDateString()
    } catch {
      return '--/--/----'
    }
  }

  const getTimeRange = () => {
    if (events.length === 0) {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000))
      return { start: oneHourAgo, end: now }
    }

    const timestamps = events
      .map(e => new Date(e.timestamp))
      .filter(t => !isNaN(t.getTime()))

    if (timestamps.length === 0) {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000))
      return { start: oneHourAgo, end: now }
    }

    return {
      start: new Date(Math.min(...timestamps.map(t => t.getTime()))),
      end: new Date(Math.max(...timestamps.map(t => t.getTime())))
    }
  }

  const getPositionOnTimeline = (timestamp: string) => {
    const { start, end } = getTimeRange()
    const eventTime = new Date(timestamp).getTime()
    const startTime = start.getTime()
    const endTime = end.getTime()

    if (endTime === startTime) return 50

    const totalDuration = endTime - startTime
    const eventOffset = eventTime - startTime
    const position = 5 + (eventOffset / totalDuration) * 90

    return Math.max(5, Math.min(95, position))
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

  const timeRange = getTimeRange()
  const totalTokens = events.reduce((sum, event) =>
    sum + calculateTotalTokens(event.message?.usage), 0
  )

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Claude Events Timeline</h2>

      {events.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Events</div>
              <div className="text-2xl font-bold">{events.length}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Time Span</div>
              <div className="text-2xl font-bold">
                {Math.round((timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60))}m
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Tokens</div>
              <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Sessions</div>
              <div className="text-2xl font-bold">
                {new Set(events.map(e => e.sessionId)).size}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
              <span>{formatDate(timeRange.start.toISOString())} {formatTime(timeRange.start.toISOString())}</span>
              <span className="font-medium">Event Timeline</span>
              <span>{formatDate(timeRange.end.toISOString())} {formatTime(timeRange.end.toISOString())}</span>
            </div>

            <div className="relative h-24 bg-gray-100 rounded-lg overflow-visible">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-300 transform -translate-y-1/2"></div>

              {events.map((event, index) => {
                const position = getPositionOnTimeline(event.timestamp)
                return (
                  <div
                    key={event.uuid}
                    className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 cursor-pointer group"
                    style={{ left: `${position}%` }}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg ${getEventColor(event)} border-2 border-white transition-transform hover:scale-110`}>
                      {getEventIcon(event)}
                    </div>

                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {formatTime(event.timestamp)} - {getEventTitle(event)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected Event Details */}
          {selectedEvent && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <span className="text-2xl">{getEventIcon(selectedEvent)}</span>
                    {getEventTitle(selectedEvent)}
                  </h3>
                  <div className="text-sm text-gray-500 mt-1">
                    UUID: {selectedEvent.uuid}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">{formatDate(selectedEvent.timestamp)}</div>
                  <div className="text-lg font-medium">{formatTime(selectedEvent.timestamp)}</div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {renderEventDetails(selectedEvent)}
            </div>
          )}

          {/* Events List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Recent Events</h3>
            </div>
            <div className="divide-y max-h-96 overflow-auto">
              {events.slice(0, 20).map((event) => (
                <div
                  key={event.uuid}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${getEventColor(event)}`}>
                        {getEventIcon(event)}
                      </div>
                      <div>
                        <div className="font-medium">{getEventTitle(event)}</div>
                        <div className="text-sm text-gray-500">{formatTime(event.timestamp)}</div>
                      </div>
                    </div>
                    {event.message?.usage && (
                      <div className="text-sm text-gray-600">
                        {calculateTotalTokens(event.message.usage)} tokens
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {events.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <div className="text-6xl mb-4">📭</div>
          <div className="text-xl">No events found</div>
          <div className="text-sm mt-2">Make sure Claude Code logs are available in ~/.claude/projects/</div>
        </div>
      )}
    </div>
  )
}