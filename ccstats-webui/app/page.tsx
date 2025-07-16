import Timeline from './components/Timeline'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">CCStats WebUI</h1>
          <p className="text-gray-600 mt-1">Claude Code Usage Statistics Dashboard</p>
        </div>
      </header>
      
      <main className="py-8">
        <Timeline />
      </main>
    </div>
  );
}
