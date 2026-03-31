import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import CRM from './pages/CRM'
import Billing from './pages/Billing'
import Marketing from './pages/Marketing'
import MyInfo from './pages/MyInfo'
import ClientDetail from './pages/ClientDetail'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import ContactDetail from './pages/ContactDetail'

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F4F8' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0042AA' }}>
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <p className="text-sm font-semibold" style={{ color: '#9CA3AF' }}>Loading ConsultPro...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/my-info" element={<MyInfo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

function PublicRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <Login />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
