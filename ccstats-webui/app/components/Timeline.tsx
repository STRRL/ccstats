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

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
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

  const calculateTotalTokens = (event: Event) => {
    return (event.input_tokens || 0) + (event.output_tokens || 0) + 
           (event.cache_creation_tokens || 0) + (event.cache_read_tokens || 0)
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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Recent Claude Events Timeline</h2>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
        
        {events.map((event, index) => (
          <div key={index} className="relative flex items-start mb-8">
            {/* Timeline dot */}
            <div className="flex-shrink-0 w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl z-10">
              {getEventIcon(event.event_type)}
            </div>
            
            {/* Event content */}
            <div className="ml-6 bg-white rounded-lg shadow-md p-4 flex-grow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {event.event_type || 'Unknown Event'}
                </h3>
                <span className="text-sm text-gray-500">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Model:</span>
                  <p className="text-gray-900">{event.model || 'N/A'}</p>
                </div>
                
                <div>
                  <span className="font-medium text-gray-600">Project:</span>
                  <p className="text-gray-900">{event.project_name || 'N/A'}</p>
                </div>
                
                <div>
                  <span className="font-medium text-gray-600">Input Tokens:</span>
                  <p className="text-gray-900">{event.input_tokens || 0}</p>
                </div>
                
                <div>
                  <span className="font-medium text-gray-600">Output Tokens:</span>
                  <p className="text-gray-900">{event.output_tokens || 0}</p>
                </div>
              </div>
              
              {(event.cache_creation_tokens || event.cache_read_tokens) && (
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Cache Creation:</span>
                    <p className="text-gray-900">{event.cache_creation_tokens || 0}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Cache Read:</span>
                    <p className="text-gray-900">{event.cache_read_tokens || 0}</p>
                  </div>
                </div>
              )}
              
              <div className="mt-2 text-sm">
                <span className="font-medium text-gray-600">Total Tokens:</span>
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {calculateTotalTokens(event)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {events.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No events found. Make sure Claude Code logs are available.
        </div>
      )}
    </div>
  )
}