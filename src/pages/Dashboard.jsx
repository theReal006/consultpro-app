import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-all"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,66,170,0.12)'; e.currentTarget.style.borderColor = '#BFDBFE' } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = '#F3F4F6' }}
    >
      <p className="text-sm text-gray-500 font-semibold mb-1">{label}</p>
      <p className="text-3xl font-bold mb-1" style={{ color: color || '#0A1628' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {onClick && <p className="text-xs font-semibold mt-2" style={{ color: '#0042AA' }}>View →</p>}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ openAR: 0, openInvoices: 0, overdue120: 0, clients: 0 })
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [invoicesRes, clientsRes] = await Promise.all([
        supabase.from('invoices').select('amount, status, due_date, created_at'),
        supabase.from('clients').select('id'),
      ])

      const invoices = invoicesRes.data || []
      const clients = clientsRes.data || []

      const now = new Date()
      const openAR = invoices
        .filter(i => ['sent', 'overdue'].includes(i.status))
        .reduce((s, i) => s + Number(i.amount), 0)

      const openInvoices = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).length

      const overdue120 = invoices
        .filter(i => {
          if (i.status !== 'overdue') return false
          const due = new Date(i.due_date)
          return (now - due) / (1000 * 60 * 60 * 24) >= 120
        })
        .reduce((s, i) => s + Number(i.amount), 0)

      const months = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push({
          month: d.toLocaleString('default', { month: 'short' }),
          year: d.getFullYear(),
          monthNum: d.getMonth(),
          hours: 0,
        })
      }

      setStats({
        openAR: openAR.toFixed(2),
        openInvoices,
        overdue120: overdue120.toFixed(2),
        clients: clients.length,
      })
      setChartData(months)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 font-semibold">Loading dashboard...</div>
    </div>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0A1628' }}>Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Clients"
          value={stats.clients}
          onClick={() => navigate('/clients')}
        />
        <StatCard
          label="Open Billing"
          value={`$${Number(stats.openAR).toLocaleString()}`}
          sub={`${stats.openInvoices} open invoices`}
          color="#0042AA"
          onClick={() => navigate('/billing')}
        />
        <StatCard
          label="Open Invoices"
          value={stats.openInvoices}
          color="#F59E0B"
          onClick={() => navigate('/billing')}
        />
        <StatCard
          label="120D+ Overdue"
          value={`$${Number(stats.overdue120).toLocaleString()}`}
          sub="Requires attention"
          color="#EF4444"
          onClick={() => navigate('/billing')}
        />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-base font-bold mb-4" style={{ color: '#0A1628' }}>Rolling 12 Months — Hours Billed</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              cursor={{ fill: '#F0F4F8' }}
            />
            <Bar dataKey="hours" fill="#0042AA" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
