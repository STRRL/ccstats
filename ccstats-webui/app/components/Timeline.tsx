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
  raw_data: string
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
      setEvents(data.events)
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
    if (events.length === 0) return { start: new Date(), end: new Date() }
    const timestamps = events.map(e => new Date(e.timestamp))
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
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString()
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