import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const PRIORITY_COLORS = {
  low:    { dot: '#6B7280', bg: '#F3F4F6', text: '#6B7280' },
  normal: { dot: '#3B82F6', bg: '#EFF6FF', text: '#3B82F6' },
  high:   { dot: '#F59E0B', bg: '#FFFBEB', text: '#F59E0B' },
  urgent: { dot: '#EF4444', bg: '#FEF2F2', text: '#EF4444' },
}

function startOfMonth(year, month) {
  return new Date(year, month, 1)
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayYMD() {
  return toYMD(new Date())
}

export default function Calendar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const today = new Date()
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const [tasks,    setTasks]    = useState([])
  const [meetings, setMeetings] = useState([])
  const [gcalEvents, setGcalEvents] = useState([])
  const [gcalError,  setGcalError]  = useState(null)
  const [loading,  setLoading]  = useState(true)

  // selected day detail panel
  const [selectedDay, setSelectedDay] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // date range for the visible month (+ padding weeks)
    const firstDay = new Date(viewYear, viewMonth, 1)
    const lastDay  = new Date(viewYear, viewMonth + 1, 0)
    const rangeStart = new Date(firstDay)
    rangeStart.setDate(rangeStart.getDate() - firstDay.getDay()) // back to Sunday
    const rangeEnd = new Date(lastDay)
    rangeEnd.setDate(rangeEnd.getDate() + (6 - lastDay.getDay())) // forward to Saturday

    const startStr = toYMD(rangeStart)
    const endStr   = toYMD(rangeEnd)

    const [tasksRes, meetingsRes] = await Promise.all([
      supabase.from('tasks')
        .select('id, title, priority, status, due_date, company_id, company:clients(id,name)')
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .gte('due_date', startStr)
        .lte('due_date', endStr)
        .order('due_date', { ascending: true }),
      supabase.from('activity_logs')
        .select('id, activity_type, summary, activity_date, contact_id, company_id, company:clients(id,name)')
        .eq('user_id', user.id)
        .eq('activity_type', 'meeting')
        .gte('activity_date', startStr + 'T00:00:00')
        .lte('activity_date', endStr + 'T23:59:59')
        .order('activity_date', { ascending: true }),
    ])

    setTasks(tasksRes.data || [])
    setMeetings(meetingsRes.data || [])
    setLoading(false)

    // try Google Calendar via provider token
    fetchGoogleCalendar(rangeStart, rangeEnd)
  }, [user, viewYear, viewMonth])

  const fetchGoogleCalendar = async (rangeStart, rangeEnd) => {
    try {
      // Try session token first (available right after sign-in).
      // Fall back to the persisted token saved in user_google_tokens.
      const { data: { session } } = await supabase.auth.getSession()
      let token = session?.provider_token

      if (!token && user?.id) {
        const { data: stored } = await supabase
          .from('user_google_tokens')
          .select('access_token, expires_at')
          .eq('user_id', user.id)
          .single()
        if (stored?.access_token) {
          // If token is expired, tell user to re-sign-in
          if (stored.expires_at && new Date(stored.expires_at) < new Date()) {
            setGcalError('gcal_expired')
            return
          }
          token = stored.access_token
        }
      }

      if (!token) { setGcalError('gcal_no_token'); return }

      const tMin = rangeStart.toISOString()
      const tMax = rangeEnd.toISOString()
      const url  = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(tMin)}&timeMax=${encodeURIComponent(tMax)}&singleEvents=true&orderBy=startTime&maxResults=250`

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        if (res.status === 401) { setGcalError('gcal_unauthorized'); return }
        if (res.status === 403) { setGcalError('gcal_scope'); return }
        setGcalError('gcal_error')
        return
      }
      const data = await res.json()
      setGcalEvents(data.items || [])
      setGcalError(null)
    } catch {
      setGcalError('gcal_error')
    }
  }

  useEffect(() => { load() }, [load])

  // ── build day→items map ──────────────────────────────────────────────────────
  const itemsByDay = {}

  tasks.forEach(t => {
    if (!t.due_date) return
    const day = t.due_date.slice(0, 10)
    if (!itemsByDay[day]) itemsByDay[day] = []
    itemsByDay[day].push({ type: 'task', data: t })
  })

  meetings.forEach(m => {
    const day = m.activity_date?.slice(0, 10)
    if (!day) return
    if (!itemsByDay[day]) itemsByDay[day] = []
    itemsByDay[day].push({ type: 'meeting', data: m })
  })

  gcalEvents.forEach(ev => {
    const day = ev.start?.date || ev.start?.dateTime?.slice(0, 10)
    if (!day) return
    if (!itemsByDay[day]) itemsByDay[day] = []
    itemsByDay[day].push({ type: 'gcal', data: ev })
  })

  // ── build calendar grid ─────────────────────────────────────────────────────
  const firstDayOfMonth = startOfMonth(viewYear, viewMonth)
  const daysInMonth     = getDaysInMonth(viewYear, viewMonth)
  const startOffset     = firstDayOfMonth.getDay() // 0=Sun

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const cells = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push(null)
    } else {
      const ymd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      cells.push({ dayNum, ymd })
    }
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelectedDay(null)
  }
  const goToday = () => {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDay(todayYMD())
  }

  const selectedItems = selectedDay ? (itemsByDay[selectedDay] || []) : []
  const [showGcalHelp, setShowGcalHelp] = useState(false)
  const gcalHelpRef = useRef(null)

  // close help popover on outside click
  useEffect(() => {
    if (!showGcalHelp) return
    const handler = (e) => { if (gcalHelpRef.current && !gcalHelpRef.current.contains(e.target)) setShowGcalHelp(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showGcalHelp])

  const gcalConnected = gcalEvents.length > 0
  const gcalSetupNeeded = gcalError === 'gcal_scope' || gcalError === 'gcal_unauthorized'
  const gcalNoToken = gcalError === 'gcal_no_token' || gcalError === 'gcal_expired'

  return (
    <div className="flex gap-6 h-full">
      {/* ── Main calendar ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#0A1628' }}>Calendar</h1>
            <p className="text-sm text-gray-400 mt-0.5">Tasks, meetings & Google Calendar</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Google Calendar status pill */}
            <div className="relative" ref={gcalHelpRef}>
              {gcalConnected ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: '#ECFDF5', color: '#059669' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Google Calendar
                </span>
              ) : (gcalSetupNeeded || gcalNoToken) ? (
                <button onClick={() => setShowGcalHelp(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors hover:bg-gray-50"
                  style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>
                  🗓️ Connect Google Cal
                </button>
              ) : null}
              {showGcalHelp && (
                <div className="absolute right-0 top-10 z-50 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
                  <p className="text-sm font-bold mb-2" style={{ color: '#0A1628' }}>Connect Google Calendar</p>
                  {gcalSetupNeeded ? (
                    <>
                      <p className="text-xs text-gray-500 mb-3">The <code className="bg-gray-100 px-1 rounded text-xs">calendar.readonly</code> scope needs to be added to your Google OAuth setup. Follow these two steps:</p>
                      <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside mb-3">
                        <li>
                          Open{' '}
                          <a href="https://supabase.com/dashboard/project/nxgzgphocxhbqqpjvitr/auth/providers"
                            target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: '#0042AA' }}>
                            Supabase → Auth → Providers → Google
                          </a>
                          {' '}and add this to <strong>Additional OAuth Scopes</strong>:<br />
                          <code className="block mt-1 bg-gray-100 px-2 py-1 rounded text-xs break-all">https://www.googleapis.com/auth/calendar.readonly</code>
                        </li>
                        <li>Sign out of the app and sign back in with Google.</li>
                      </ol>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 mb-3">Sign out and sign back in with Google to connect your calendar.</p>
                  )}
                  <button onClick={() => setShowGcalHelp(false)}
                    className="w-full py-2 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50">Got it</button>
                </div>
              )}
            </div>
            <button onClick={goToday}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">
              Today
            </button>
            <button onClick={prevMonth}
              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50">
              ‹
            </button>
            <span className="text-base font-bold min-w-[160px] text-center" style={{ color: '#0A1628' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth}
              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50">
              ›
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#EFF6FF' }}></span> Task</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#F0FDF4' }}></span> Meeting</span>
          {gcalEvents.length > 0 && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#F5F3FF' }}></span> Google Calendar</span>}
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : (
          <div className="grid grid-cols-7 border-t border-l border-gray-100">
            {cells.map((cell, idx) => {
              if (!cell) return (
                <div key={`empty-${idx}`} className="border-r border-b border-gray-100 min-h-[100px] bg-gray-50/40" />
              )
              const { dayNum, ymd } = cell
              const items  = itemsByDay[ymd] || []
              const isToday   = ymd === todayYMD()
              const isSelected = ymd === selectedDay
              const MAX_VISIBLE = 3

              return (
                <div key={ymd}
                  onClick={() => setSelectedDay(ymd === selectedDay ? null : ymd)}
                  className="border-r border-b border-gray-100 min-h-[100px] p-1.5 cursor-pointer transition-colors hover:bg-blue-50/30"
                  style={isSelected ? { background: '#EFF6FF' } : {}}>
                  {/* Day number */}
                  <div className="flex justify-end mb-1">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? 'text-white' : 'text-gray-600'}`}
                      style={isToday ? { background: '#0042AA' } : {}}>
                      {dayNum}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="space-y-0.5">
                    {items.slice(0, MAX_VISIBLE).map((item, i) => (
                      <CalendarChip key={i} item={item} />
                    ))}
                    {items.length > MAX_VISIBLE && (
                      <div className="text-xs text-gray-400 pl-1 font-medium">+{items.length - MAX_VISIBLE} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Day detail panel ──────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0">
        {selectedDay ? (
          <DayPanel
            ymd={selectedDay}
            items={selectedItems}
            onNavigate={(path) => navigate(path)}
            onClose={() => setSelectedDay(null)}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-sm text-gray-400 mt-14">
            Click a day to see details
          </div>
        )}

        {/* Mini upcoming list */}
        <UpcomingList tasks={tasks} meetings={meetings} gcalEvents={gcalEvents} today={todayYMD()} navigate={navigate} />
      </div>
    </div>
  )
}

// ── CalendarChip ─────────────────────────────────────────────────────────────
function CalendarChip({ item }) {
  if (item.type === 'task') {
    const { data } = item
    const pri = PRIORITY_COLORS[data.priority] || PRIORITY_COLORS.normal
    const done = data.status === 'done'
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate"
        style={{ background: done ? '#F3F4F6' : pri.bg, color: done ? '#9CA3AF' : pri.text }}>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: done ? '#9CA3AF' : pri.dot }}></span>
        <span className={`truncate ${done ? 'line-through' : ''}`}>{data.title}</span>
      </div>
    )
  }
  if (item.type === 'meeting') {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate"
        style={{ background: '#F0FDF4', color: '#059669' }}>
        <span>📅</span>
        <span className="truncate">{item.data.summary || 'Meeting'}</span>
      </div>
    )
  }
  if (item.type === 'gcal') {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate"
        style={{ background: '#F5F3FF', color: '#7C3AED' }}>
        <span>🗓️</span>
        <span className="truncate">{item.data.summary || 'Event'}</span>
      </div>
    )
  }
  return null
}

// ── DayPanel ─────────────────────────────────────────────────────────────────
function DayPanel({ ymd, items, onNavigate, onClose }) {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const taskItems    = items.filter(i => i.type === 'task')
  const meetingItems = items.filter(i => i.type === 'meeting')
  const gcalItems    = items.filter(i => i.type === 'gcal')

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
        style={{ background: '#0042AA' }}>
        <p className="text-white text-sm font-bold">{label}</p>
        <button onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none">×</button>
      </div>

      <div className="p-4 max-h-[500px] overflow-y-auto space-y-4">
        {items.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Nothing scheduled</p>
        )}

        {taskItems.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Tasks</p>
            <div className="space-y-2">
              {taskItems.map((item, i) => {
                const t   = item.data
                const pri = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.normal
                const done = t.status === 'done'
                return (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl border"
                    style={{ borderColor: '#F3F4F6' }}>
                    <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: done ? '#9CA3AF' : pri.dot }}></span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${done ? 'line-through text-gray-400' : ''}`}
                        style={!done ? { color: '#0A1628' } : {}}>{t.title}</p>
                      {t.company && (
                        <button onClick={() => onNavigate(`/clients/${t.company.id}`)}
                          className="text-xs font-semibold hover:underline" style={{ color: '#0042AA' }}>
                          🏢 {t.company.name}
                        </button>
                      )}
                      <span className="text-xs px-1.5 py-0.5 rounded-md ml-1"
                        style={{ background: pri.bg, color: pri.text }}>{t.priority}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {meetingItems.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Meetings</p>
            <div className="space-y-2">
              {meetingItems.map((item, i) => {
                const m = item.data
                const time = m.activity_date
                  ? new Date(m.activity_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  : null
                return (
                  <div key={i} className="p-2.5 rounded-xl border" style={{ borderColor: '#D1FAE5', background: '#F0FDF4' }}>
                    <p className="text-sm font-semibold" style={{ color: '#065F46' }}>{m.summary || 'Meeting'}</p>
                    {time && <p className="text-xs text-emerald-600 mt-0.5">{time}</p>}
                    {m.company && (
                      <button onClick={() => onNavigate(`/clients/${m.company.id}`)}
                        className="text-xs font-semibold hover:underline mt-0.5" style={{ color: '#059669' }}>
                        🏢 {m.company.name}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {gcalItems.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Google Calendar</p>
            <div className="space-y-2">
              {gcalItems.map((item, i) => {
                const ev   = item.data
                const start = ev.start?.dateTime
                  ? new Date(ev.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  : 'All day'
                const end = ev.end?.dateTime
                  ? new Date(ev.end.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  : null
                return (
                  <div key={i} className="p-2.5 rounded-xl border" style={{ borderColor: '#DDD6FE', background: '#F5F3FF' }}>
                    <p className="text-sm font-semibold" style={{ color: '#5B21B6' }}>{ev.summary || 'Event'}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#7C3AED' }}>
                      {start}{end ? ` – ${end}` : ''}
                    </p>
                    {ev.location && <p className="text-xs text-purple-500 mt-0.5 truncate">📍 {ev.location}</p>}
                    {ev.htmlLink && (
                      <a href={ev.htmlLink} target="_blank" rel="noreferrer"
                        className="text-xs underline mt-1 block" style={{ color: '#7C3AED' }}>
                        Open in Google Calendar
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── UpcomingList ─────────────────────────────────────────────────────────────
function UpcomingList({ tasks, meetings, gcalEvents, today, navigate }) {
  // next 7 days upcoming items
  const todayDate = new Date(today + 'T12:00:00')
  const nextWeek  = new Date(todayDate)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const upcoming = []

  tasks.forEach(t => {
    if (!t.due_date || t.status === 'done') return
    const d = new Date(t.due_date + 'T12:00:00')
    if (d >= todayDate && d <= nextWeek)
      upcoming.push({ sort: t.due_date, type: 'task', data: t })
  })

  meetings.forEach(m => {
    if (!m.activity_date) return
    const d = new Date(m.activity_date)
    if (d >= todayDate && d <= nextWeek)
      upcoming.push({ sort: m.activity_date.slice(0,10), type: 'meeting', data: m })
  })

  gcalEvents.forEach(ev => {
    const day = ev.start?.date || ev.start?.dateTime?.slice(0, 10)
    if (!day) return
    if (day >= today && day <= nextWeek.toISOString().slice(0,10))
      upcoming.push({ sort: day, type: 'gcal', data: ev })
  })

  upcoming.sort((a, b) => a.sort.localeCompare(b.sort))

  if (upcoming.length === 0) return null

  return (
    <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Next 7 Days</p>
      <div className="space-y-2">
        {upcoming.slice(0, 8).map((item, i) => {
          if (item.type === 'task') {
            const t = item.data
            const pri = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.normal
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pri.dot }}></span>
                <span className="flex-1 truncate font-medium" style={{ color: '#0A1628' }}>{t.title}</span>
                <span className="text-gray-400 flex-shrink-0">
                  {new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            )
          }
          if (item.type === 'meeting') {
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#10B981' }}></span>
                <span className="flex-1 truncate font-medium" style={{ color: '#065F46' }}>{item.data.summary || 'Meeting'}</span>
                <span className="text-gray-400 flex-shrink-0">
                  {new Date(item.data.activity_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            )
          }
          if (item.type === 'gcal') {
            const day = item.data.start?.date || item.data.start?.dateTime?.slice(0, 10)
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#7C3AED' }}></span>
                <span className="flex-1 truncate font-medium" style={{ color: '#5B21B6' }}>{item.data.summary || 'Event'}</span>
                <span className="text-gray-400 flex-shrink-0">
                  {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}
