import { useState } from 'react'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen" style={{ background: '#F0F4F8' }}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main
        className="flex-1 overflow-y-auto min-h-screen"
        style={{ marginLeft: 0 }}
      >
        {/* Mobile top bar */}
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 z-10"
          style={{ background: '#0A1628' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-sm"
            style={{ background: '#0042AA' }}
          >C</div>
          <span className="text-white font-bold text-base tracking-tight">ConsultPro</span>
        </div>

        {/* Page content */}
        <div className="p-4 sm:p-6 lg:p-8 lg:ml-64">
          {children}
        </div>
      </main>
    </div>
  )
}
