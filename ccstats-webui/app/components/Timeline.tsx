'use client'

import { useEffect, useState } from 'react'

interface Event {
  timestamp: string
  event_type: string
  model: string
  input_tokens: number
  output_tokens: number
  cache_creation_tokens: number
  cache_read_tokens: number
  project_name: string
  message_content?: string
  content?: string
  tool_name?: string
  tool_input?: string
  diffs?: string
  files_edited?: string
  raw_data: string
}

const renderEventSpecificDetails = (event: Event) => {
  let eventData: any = {}
  
  console.log('Rendering event details for:', event.event_type)
  console.log('Event data:', event)
  console.log('Raw data:', event.raw_data)
  
  try {
    eventData = JSON.parse(event.raw_data)
    console.log('Parsed event data:', eventData)
  } catch (e) {
    console.log('Failed to parse raw_data as JSON:', e)
    eventData = {}
  }

  return (
    <div className="mt-4 bg-gray-50 rounded-lg p-4">
      <h4 className="text-lg font-semibold mb-3 text-gray-900">Event Details</h4>
      
      {/* Tool Use Details */}
      {event.event_type === 'tool_use' && renderToolUseDetails(eventData)}
      
      {/* Chat Message Details */}
      {event.event_type === 'chat_message' && renderChatMessageDetails(eventData)}
      
      {/* Completion Details */}
      {event.event_type === 'completion' && renderCompletionDetails(event, eventData)}
      
      {/* File Edit Details */}
      {(eventData.tool_name === 'edit' || eventData.tool_name === 'write') && renderFileEditDetails(eventData)}
      
      {/* Error Details */}
      {event.event_type === 'error' && renderErrorDetails(eventData)}
      
      {/* Raw Data Expandable */}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
          Raw Event Data
        </summary>
        <pre className="mt-2 text-xs bg-gray-800 text-green-400 p-3 rounded overflow-auto max-h-40">
          {JSON.stringify(eventData, null, 2)}
        </pre>
      </details>
    </div>
  )
}

const renderToolUseDetails = (eventData: any) => {
  const toolName = eventData.tool_name || eventData.name
  const toolInput = eventData.tool_input || eventData.input
  
  return (
    <div className="mb-4">
      <h5 className="font-medium text-gray-800 mb-2">🔧 Tool Usage</h5>
      <div className="bg-blue-50 p-3 rounded">
        <div className="text-sm">
          <span className="font-medium">Tool:</span> {toolName || 'Unknown'}
        </div>
        {toolInput && (
          <div className="mt-2">
            <span className="font-medium text-sm">Input:</span>
            <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-32">
              {typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

const renderChatMessageDetails = (eventData: any) => {
  const content = eventData.content || eventData.message
  
  return (
    <div className="mb-4">
      <h5 className="font-medium text-gray-800 mb-2">💬 Chat Message</h5>
      <div className="bg-blue-50 p-3 rounded">
        {content && (
          <div className="text-sm">
            <span className="font-medium">Content:</span>
            <div className="mt-1 p-2 bg-white rounded text-gray-700 max-h-32 overflow-auto">
              {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const renderFileEditDetails = (eventData: any) => {
  const toolInput = eventData.tool_input || eventData.input
  const filePath = toolInput?.file_path
  const oldString = toolInput?.old_string
  const newString = toolInput?.new_string
  const content = toolInput?.content
  
  return (
    <div className="mb-4">
      <h5 className="font-medium text-gray-800 mb-2">📝 File Edit</h5>
      <div className="bg-yellow-50 p-3 rounded">
        {filePath && (
          <div className="text-sm mb-2">
            <span className="font-medium">File:</span> 
            <code className="bg-gray-200 px-1 rounded text-xs ml-1">{filePath}</code>
          </div>
        )}
        
        {oldString && newString && (
          <div className="mt-3">
            <span className="font-medium text-sm">Changes:</span>
            <div className="mt-1 text-xs">
              <div className="bg-red-50 border-l-4 border-red-400 p-2 mb-1">
                <div className="font-medium text-red-800">- Removed:</div>
                <pre className="text-red-700 whitespace-pre-wrap">{oldString}</pre>
              </div>
              <div className="bg-green-50 border-l-4 border-green-400 p-2">
                <div className="font-medium text-green-800">+ Added:</div>
                <pre className="text-green-700 whitespace-pre-wrap">{newString}</pre>
              </div>
            </div>
          </div>
        )}
        
        {content && !oldString && (
          <div className="mt-2">
            <span className="font-medium text-sm">Content:</span>
            <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-32">
              {content}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

const renderCompletionDetails = (event: Event, eventData: any) => {
  const message = event.message_content || eventData.message
  const diffs = event.diffs || eventData.diffs
  const filesEdited = event.files_edited || eventData.files_edited
  
  return (
    <div className="mb-4">
      <h5 className="font-medium text-gray-800 mb-2">✅ Completion</h5>
      <div className="bg-green-50 p-3 rounded">
        
        {/* Message content */}
        {message && (
          <div className="mb-3">
            <span className="font-medium text-sm">Message:</span>
            <div className="mt-1 p-2 bg-white rounded text-gray-700 max-h-32 overflow-auto text-sm">
              {typeof message === 'string' ? message : JSON.stringify(message, null, 2)}
            </div>
          </div>
        )}
        
        {/* Files edited */}
        {filesEdited && (
          <div className="mb-3">
            <span className="font-medium text-sm">Files Edited:</span>
            <div className="mt-1">
              {Array.isArray(filesEdited) ? (
                <ul className="text-sm">
                  {filesEdited.map((file: string, index: number) => (
                    <li key={index} className="text-blue-600">
                      <code className="bg-gray-200 px-1 rounded text-xs">{file}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <code className="bg-gray-200 px-1 rounded text-xs">{filesEdited}</code>
              )}
            </div>
          </div>
        )}
        
        {/* Diffs */}
        {diffs && (
          <div className="mt-3">
            <span className="font-medium text-sm">Code Changes:</span>
            <div className="mt-1 text-xs">
              {Array.isArray(diffs) ? (
                diffs.map((diff: any, index: number) => (
                  <div key={index} className="mb-2 border rounded">
                    {diff.file && (
                      <div className="bg-gray-100 px-2 py-1 text-xs font-medium border-b">
                        📁 {diff.file}
                      </div>
                    )}
                    <div className="p-2">
                      {diff.added && (
                        <div className="bg-green-50 border-l-4 border-green-400 p-2 mb-1">
                          <div className="font-medium text-green-800 text-xs">+ Added:</div>
                          <pre className="text-green-700 whitespace-pre-wrap text-xs">{diff.added}</pre>
                        </div>
                      )}
                      {diff.removed && (
                        <div className="bg-red-50 border-l-4 border-red-400 p-2">
                          <div className="font-medium text-red-800 text-xs">- Removed:</div>
                          <pre className="text-red-700 whitespace-pre-wrap text-xs">{diff.removed}</pre>
                        </div>
                      )}
                      {diff.content && !diff.added && !diff.removed && (
                        <pre className="text-gray-700 whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded">{diff.content}</pre>
                      )}
                    </div>
                  </div>
                ))
              ) : typeof diffs === 'string' ? (
                <pre className="text-gray-700 whitespace-pre-wrap text-xs bg-white p-2 rounded border max-h-40 overflow-auto">{diffs}</pre>
              ) : (
                <pre className="text-gray-700 whitespace-pre-wrap text-xs bg-white p-2 rounded border max-h-40 overflow-auto">{JSON.stringify(diffs, null, 2)}</pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const renderErrorDetails = (eventData: any) => {
  const error = eventData.error || eventData.message
  
  return (
    <div className="mb-4">
      <h5 className="font-medium text-gray-800 mb-2">❌ Error</h5>
      <div className="bg-red-50 p-3 rounded">
        {error && (
          <div className="text-sm">
            <span className="font-medium text-red-800">Error Message:</span>
            <div className="mt-1 p-2 bg-white rounded text-red-700">
              {typeof error === 'string' ? error : JSON.stringify(error, null, 2)}
            </div>
          </div>
        )}
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
      console.log('=== API Response Debug Info ===')
      console.log('Full response:', data)
      console.log('Debug info:', data.debug)
      console.log('Number of events:', data.events?.length)
      console.log('Sample event:', data.events?.[0])
      console.log('=== End Debug Info ===')
      
      // Ensure events is always an array
      const events = Array.isArray(data.events) ? data.events : []
      setEvents(events)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'chat_message':
        return '💬'
      case 'tool_use':
        return '🔧'
      case 'error':
        return '❌'
      default:
        return '📝'
    }
  }

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'chat_message':
        return 'bg-blue-500'
      case 'tool_use':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const calculateTotalTokens = (event: Event) => {
    return (event.input_tokens || 0) + (event.output_tokens || 0) + 
           (event.cache_creation_tokens || 0) + (event.cache_read_tokens || 0)
  }

  const getTimeRange = () => {
    if (events.length === 0) {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000))
      return { start: oneHourAgo, end: now }
    }
    
    const timestamps = events
      .map(e => e.timestamp ? new Date(e.timestamp) : null)
      .filter(t => t && !isNaN(t.getTime()))
    
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
    
    if (endTime === startTime) return 50 // center if all events at same time
    
    // Calculate proportional position based on actual time difference
    const totalDuration = endTime - startTime
    const eventOffset = eventTime - startTime
    
    // Use 5% padding on each side to prevent events from being exactly at the edges
    const usableWidth = 90 // 100% - 5% - 5%
    const position = 5 + (eventOffset / totalDuration) * usableWidth
    
    return Math.max(5, Math.min(95, position)) // Clamp between 5% and 95%
  }

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) {
        return '--:--:--'
      }
      return date.toLocaleTimeString()
    } catch {
      return '--:--:--'
    }
  }

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) {
        return '--/--/----'
      }
      return date.toLocaleDateString()
    } catch {
      return '--/--/----'
    }
  }

  const generateTimeMarkers = () => {
    const { start, end } = getTimeRange()
    const totalDuration = end.getTime() - start.getTime()
    
    // For 1-hour timeline, generate markers every 10 minutes
    const markerInterval = 10 * 60 * 1000 // 10 minutes in milliseconds
    const markers = []
    
    // Start from the nearest 10-minute mark before the start time
    const startMinutes = start.getMinutes()
    const roundedStartMinutes = Math.floor(startMinutes / 10) * 10
    const firstMarkerTime = new Date(start)
    firstMarkerTime.setMinutes(roundedStartMinutes, 0, 0)
    
    let currentMarkerTime = new Date(firstMarkerTime)
    
    while (currentMarkerTime <= end) {
      if (currentMarkerTime >= start) {
        const eventOffset = currentMarkerTime.getTime() - start.getTime()
        const position = 5 + (eventOffset / totalDuration) * 90
        
        if (position >= 5 && position <= 95) {
          markers.push({
            time: currentMarkerTime,
            position: position,
            label: formatTime(currentMarkerTime.toISOString())
          })
        }
      }
      
      currentMarkerTime = new Date(currentMarkerTime.getTime() + markerInterval)
    }
    
    return markers
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Error: {error}
      </div>
    )
  }

  const timeRange = getTimeRange()

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Claude Events Timeline (Last Hour)</h2>
      
      {events.length > 0 && (
        <div className="mb-8">
          {/* Time range display */}
          <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
            <span>{formatDate(timeRange.start.toISOString())} {formatTime(timeRange.start.toISOString())}</span>
            <span>Events Timeline</span>
            <span>{formatDate(timeRange.end.toISOString())} {formatTime(timeRange.end.toISOString())}</span>
          </div>
          
          {/* Horizontal timeline */}
          <div className="relative h-32 bg-gray-100 rounded-lg overflow-hidden">
            {/* Timeline base line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-300 transform -translate-y-1/2"></div>
            
            {/* Time markers */}
            {generateTimeMarkers().map((marker, index) => (
              <div
                key={index}
                className="absolute top-1/2 transform -translate-x-1/2"
                style={{ left: `${marker.position}%` }}
              >
                <div className="w-0.5 h-4 bg-gray-400 transform -translate-y-1/2"></div>
                <div className="absolute top-full mt-1 text-xs text-gray-500 whitespace-nowrap transform -translate-x-1/2">
                  {marker.label}
                </div>
              </div>
            ))}
            
            {/* Start and end markers */}
            <div className="absolute top-0 left-0 w-1 h-full bg-gray-500"></div>
            <div className="absolute top-0 right-0 w-1 h-full bg-gray-500"></div>
            
            {/* Event bubbles */}
            {events.map((event, index) => {
              const position = getPositionOnTimeline(event.timestamp)
              return (
                <div
                  key={index}
                  className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 cursor-pointer transition-all duration-200 hover:scale-110"
                  style={{ left: `${position}%` }}
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm shadow-lg ${getEventColor(event.event_type)} border-2 border-white`}>
                    {getEventIcon(event.event_type)}
                  </div>
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded py-1 px-2 opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap">
                    {formatTime(event.timestamp)} - {event.event_type}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Event details panel */}
      {selectedEvent && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-l-4 border-blue-500">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">{getEventIcon(selectedEvent.event_type)}</span>
              {selectedEvent.event_type || 'Unknown Event'}
            </h3>
            <div className="text-right">
              <div className="text-sm text-gray-500">{formatDate(selectedEvent.timestamp)}</div>
              <div className="text-lg font-medium text-gray-900">{formatTime(selectedEvent.timestamp)}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-xs text-gray-600 uppercase tracking-wide">Model</div>
              <div className="text-sm font-medium text-gray-900">{selectedEvent.model || 'N/A'}</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-xs text-gray-600 uppercase tracking-wide">Project</div>
              <div className="text-sm font-medium text-gray-900">{selectedEvent.project_name || 'N/A'}</div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-xs text-blue-600 uppercase tracking-wide">Input Tokens</div>
              <div className="text-sm font-medium text-blue-900">{selectedEvent.input_tokens || 0}</div>
            </div>
            
            <div className="bg-green-50 p-3 rounded">
              <div className="text-xs text-green-600 uppercase tracking-wide">Output Tokens</div>
              <div className="text-sm font-medium text-green-900">{selectedEvent.output_tokens || 0}</div>
            </div>
          </div>
          
          {(selectedEvent.cache_creation_tokens || selectedEvent.cache_read_tokens) && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-purple-50 p-3 rounded">
                <div className="text-xs text-purple-600 uppercase tracking-wide">Cache Creation</div>
                <div className="text-sm font-medium text-purple-900">{selectedEvent.cache_creation_tokens || 0}</div>
              </div>
              <div className="bg-indigo-50 p-3 rounded">
                <div className="text-xs text-indigo-600 uppercase tracking-wide">Cache Read</div>
                <div className="text-sm font-medium text-indigo-900">{selectedEvent.cache_read_tokens || 0}</div>
              </div>
            </div>
          )}
          
          <div className="bg-gray-900 text-white p-3 rounded">
            <div className="text-xs text-gray-300 uppercase tracking-wide mb-1">Total Tokens</div>
            <div className="text-2xl font-bold">{calculateTotalTokens(selectedEvent)}</div>
          </div>
          
          {/* Event-specific details */}
          {renderEventSpecificDetails(selectedEvent)}
          
          <button 
            onClick={() => setSelectedEvent(null)}
            className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Close Details
          </button>
        </div>
      )}

      {/* Events summary */}
      {events.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-2">Timeline Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Events:</span>
              <span className="ml-2 font-medium">{events.length}</span>
            </div>
            <div>
              <span className="text-gray-600">Time Span:</span>
              <span className="ml-2 font-medium">
                {Math.round((timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60))}m
              </span>
            </div>
            <div>
              <span className="text-gray-600">Total Tokens:</span>
              <span className="ml-2 font-medium">
                {events.reduce((sum, event) => sum + calculateTotalTokens(event), 0)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Click events above for details</span>
            </div>
          </div>
        </div>
      )}
      
      {events.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No events found. Make sure Claude Code logs are available.
        </div>
      )}
    </div>
  )
}