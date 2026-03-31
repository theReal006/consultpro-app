import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⊞' },
  { to: '/clients', label: 'Clients', icon: '👥' },
  { to: '/crm', label: 'CRM & Leads', icon: '📊' },
  { to: '/tasks', label: 'Tasks', icon: '✅' },
  { to: '/billing', label: 'Billing', icon: '💳' },
  { to: '/marketing', label: 'Marketing', icon: '📣' },
  { to: '/my-info', label: 'My Info', icon: '⚙️' },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()

  return (
    <aside
      className="fixed top-0 left-0 h-full w-64 flex flex-col z-30"
      style={{ background: '#0A1628' }}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-base"
            style={{ background: '#0042AA' }}
          >
            C
          </div>
          <span className="text-white font-bold text-lg tracking-tight">ConsultPro</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }
            style={({ isActive }) => isActive ? { background: '#0042AA' } : {}}
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
            {user?.email?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
