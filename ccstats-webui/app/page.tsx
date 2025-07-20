'use client'

import { useState } from 'react'
import Timeline from './components/Timeline'
import DailyStats from './components/DailyStats'

type TabType = 'timeline' | 'daily-stats'

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('timeline')

  const tabs = [
    { id: 'timeline' as TabType, name: '事件时间线', icon: '📅' },
    { id: 'daily-stats' as TabType, name: '每日使用频率', icon: '📊' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">CCStats WebUI</h1>
          <p className="text-gray-600 mt-1">Claude Code Usage Statistics Dashboard</p>
          
          {/* Navigation Tabs */}
          <div className="mt-6">
            <nav className="flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>
      
      <main className="py-8">
        {activeTab === 'timeline' && <Timeline />}
        {activeTab === 'daily-stats' && <DailyStats />}
      </main>
    </div>
  );
}
