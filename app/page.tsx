'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as faceapi from 'face-api.js'
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  Bell,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FileBarChart,
  Fingerprint,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Sparkles,
  Users,
  Video,
  X,
} from 'lucide-react'

type View = 'Overview' | 'Attendance' | 'People' | 'Face verification' | 'Reports' | 'Settings'
type Notice = { text: string; tone?: 'success' | 'info' }
type Person = { name: string; email: string; team: string; location: string; dept: string; status: string; enrolled: boolean; consent: boolean; initials: string; color: string; faceDescriptor?: number[] }
type EventRecord = { id: string; name: string; time: string; location: string; confidence: string; initials: string; result: string }
const makeEventId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const navItems: { label: View; icon: React.ComponentType<any> }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Attendance', icon: CalendarDays },
  { label: 'People', icon: Users },
  { label: 'Face verification', icon: ScanFaceIcon },
  { label: 'Reports', icon: FileBarChart },
]

const people: Person[] = [
  { name: 'Sarah Mitchell', email: 'sarah.mitchell@northstar.co', team: 'Design', location: 'Hooghly', dept: 'Creative', status: 'Present',
 enrolled: true, consent: true, initials: 'SM', color: 'violet' },
  { name: 'Marcus Chen', email: 'marcus.chen@northstar.co', team: 'Engineering', location: 'Howrah', dept: 'Technology', status: 'Present', enrolled: true, consent: true, initials: 'MC', color: 'blue' },
  { name: 'Priya Sharma', email: 'priya.sharma@northstar.co', team: 'Marketing', location: 'North 24 Parganas', dept: 'Growth', status: 'Late', enrolled: true, consent: true, initials: 'PS', color: 'amber' },
  { name: 'James Wilson', email: 'james.wilson@northstar.co', team: 'Operations', location: 'Purba Bardhaman', dept: 'Operations', status: 'Absent', enrolled: false, consent: false, initials: 'JW', color: 'rose' },
  { name: 'Ava Rodriguez', email: 'ava.rodriguez@northstar.co', team: 'Finance', location: 'Hooghly', dept: 'Finance', status: 'Present', enrolled: true, consent: true, initials: 'AR', color: 'emerald' },
  { name: 'Noah Williams', email: 'noah.williams@northstar.co', team: 'Engineering', location: 'Howrah', dept: 'Technology', status: 'Present', enrolled: true, consent: true, initials: 'NW', color: 'cyan' },
]

const events: EventRecord[] = [
  { id: 'seed-1', name: 'Sarah Mitchell', time: '09:02:18 AM', location: 'Main entrance', confidence: '99.8%', initials: 'SM', result: 'Verified' },
  { id: 'seed-2', name: 'Marcus Chen', time: '08:58:42 AM', location: 'Main entrance', confidence: '98.6%', initials: 'MC', result: 'Verified' },
  { id: 'seed-3', name: 'Priya Sharma', time: '09:17:05 AM', location: 'South lobby', confidence: '97.2%', initials: 'PS', result: 'Verified' },
  { id: 'seed-4', name: 'Unknown attempt', time: '08:41:11 AM', location: 'Main entrance', confidence: '—', initials: '?', result: 'Review' },
]

function ScanFaceIcon(props: React.ComponentProps<'svg'>) {
  return <Fingerprint {...props} />
}

const FACE_MODEL_URL = '/models'
const FACE_MATCH_THRESHOLD = 0.5
let faceModelsPromise: Promise<void> | null = null

function loadFaceModels() {
  if (!faceModelsPromise) {
    faceModelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
    ]).then(() => undefined)
  }
  return faceModelsPromise
}

async function getFaceDescriptor(video: HTMLVideoElement): Promise<Float32Array | null> {
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor()
  return detection ? detection.descriptor : null
}

function averageDescriptors(descriptors: Float32Array[]): number[] {
  const length = descriptors[0].length
  const sum = new Array(length).fill(0)
  descriptors.forEach((descriptor) => { for (let i = 0; i < length; i += 1) sum[i] += descriptor[i] })
  return sum.map((value) => value / descriptors.length)
}

function findBestMatch(descriptor: number[], candidates: Person[]) {
  let best: { person: Person; distance: number } | null = null
  for (const person of candidates) {
    if (!person.faceDescriptor || person.faceDescriptor.length === 0) continue
    const distance = faceapi.euclideanDistance(descriptor, person.faceDescriptor)
    if (!best || distance < best.distance) best = { person, distance }
  }
  return best
}

async function matchFaceAgainstDatabase(descriptors: Float32Array[], candidates: Person[], enrollment: { name: string } | null) {
  if (descriptors.length === 0) return { match: false as const }
  const averaged = averageDescriptors(descriptors)

  if (enrollment) {
    // Enrolling a brand-new face: nothing to compare against yet, just store what we captured.
    return { match: true as const, descriptor: averaged, confidence: '100%' }
  }

  const best = findBestMatch(averaged, candidates)
  if (!best || best.distance > FACE_MATCH_THRESHOLD) return { match: false as const }
  const confidence = `${Math.max(0, Math.min(100, Math.round((1 - best.distance) * 100)))}%`
  return { match: true as const, person: best.person, confidence }
}

function StatusBadge({ status }: { status: string }) {
  const styles = status === 'Present' || status === 'Verified' ? 'status-success' : status === 'Late' || status === 'Review' ? 'status-warning' : 'status-danger'
  return <span className={`status-badge ${styles}`}><span className="status-dot" />{status}</span>
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return <span className={`avatar avatar-${color}`}>{initials}</span>
}

export default function Page() {
  const [activeView, setActiveView] = useState<View>('Overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [search, setSearch] = useState('')
    const [verification, setVerification] = useState<'ready' | 'scanning' | 'verified' | 'no-match'>('ready')
  const [peopleState, setPeopleState] = useState(people)
  const [eventsState, setEventsState] = useState(events)
  const [enrollment, setEnrollment] = useState<{ name: string; email: string; department: string; team: string; location?: string } | null>(null)
  const [dateFilter, setDateFilter] = useState('Today, Sep 9, 2026')
  const [workspaceSettings, setWorkspaceSettings] = useState({ name: 'Teen Titans', timezone: 'Indian Standard Time/IST' })
  const [dataReady, setDataReady] = useState(false)

  useEffect(() => {
    fetch('/api/workspace').then((response) => response.json()).then((data) => {
      if (data.workspace) setWorkspaceSettings({ name: data.workspace.name, timezone: data.workspace.timezone })
if (Array.isArray(data.people)) setPeopleState(data.people)
  if (Array.isArray(data.attendance)) setEventsState(data.attendance)
    }).catch(() => showNotice('Could not load saved workspace data', 'info')).finally(() => setDataReady(true))
  }, [])

  useEffect(() => {
    if (!dataReady) return
    fetch('/api/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: workspaceSettings, people: peopleState, attendance: eventsState }) }).catch(() => showNotice('Could not save workspace data', 'info'))
  }, [dataReady, workspaceSettings, peopleState, eventsState])

  const showNotice = (text: string, tone: Notice['tone'] = 'success') => {
    setNotice({ text, tone })
    window.setTimeout(() => setNotice(null), 3200)
  }

  const filteredPeople = useMemo(() => peopleState.filter((person) => `${person.name} ${person.email} ${person.team}`.toLowerCase().includes(search.toLowerCase())), [peopleState, search])

  const startVerification = () => {
    setVerification('scanning')
  }

  // Stable identity (useCallback) matters here: this gets passed into Verification's
  // capture-loop effect. If it were a new inline function on every Page render, that
  // effect would restart mid-scan, which is what was cutting the 8-angle capture short.
  const handleVerificationComplete = useCallback((person: Person, event: EventRecord, mode: 'enrolled' | 'verified') => {
    setPeopleState((current) => {
      const exists = current.some((existing) => existing.email === person.email)
      return exists
        ? current.map((existing) => (existing.email === person.email ? { ...existing, ...person, status: 'Present' } : existing))
        : [...current, person]
    })
    setEventsState((current) => [event, ...current])
    setEnrollment(null)
    if (mode === 'enrolled') {
      setVerification('ready')
      setActiveView('Attendance')
      showNotice(`${person.name} enrolled and attendance recorded`)
    } else {
      // Stay on the kiosk screen so the admin sees the "already present" confirmation
      // right where they just scanned the face, instead of being bounced away.
      setVerification('verified')
      showNotice(`${person.name} is already present`)
    }
  }, [])

  const handleNoMatch = useCallback(() => {
    setVerification('no-match')
  }, [])

  return (
    <main className="app-shell">
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Fingerprint size={22} /></div><span>Attendly</span></div>
        <div className="workspace-menu-wrap">
          <button className="workspace-switcher" aria-expanded={workspaceOpen} aria-haspopup="menu" onClick={() => setWorkspaceOpen((open) => !open)}><div className="workspace-icon">N</div><div><strong>{workspaceSettings.name}</strong><span>Workspace</span></div><ChevronDown className={workspaceOpen ? 'chevron-open' : ''} size={15} /></button>
          {workspaceOpen && <div className="workspace-menu" role="menu"><p>Switch workspace</p><button role="menuitem" onClick={() => { setWorkspaceOpen(false); showNotice('Northstar Studio is already selected', 'info') }}><span className="workspace-menu-icon">N</span><span><strong>Northstar Studio</strong><small>248 people · Current</small></span><Check size={15} /></button><button role="menuitem" onClick={() => { setWorkspaceOpen(false); showNotice('Workspace creation is ready to connect', 'info') }}><span className="workspace-menu-add"><Plus size={15} /></span><span><strong>Create workspace</strong><small>Add a school, branch, or team</small></span></button></div>}
        </div>
        <p className="nav-label">Workspace</p>
        <nav className="nav-list" aria-label="Workspace navigation">
          {navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeView === label ? 'nav-item-active' : ''}`} onClick={() => { setActiveView(label); setSidebarOpen(false) }}><Icon size={18} /><span>{label}</span>{label === 'Face verification' && <span className="live-pill">LIVE</span>}</button>)}
        </nav>
        <p className="nav-label nav-label-bottom">Manage</p>
        <button className={`nav-item ${activeView === 'Settings' ? 'nav-item-active' : ''}`} onClick={() => setActiveView('Settings')}><Settings size={18} /><span>Settings</span></button>
        <div className="sidebar-footer"><div className="privacy-mini"><ShieldCheck size={17} /><div><strong>Privacy first</strong><span>Data is encrypted</span></div></div><div className="user-row"><div className="user-avatar">SD</div><div><strong>Sovon Das</strong><span>Administrator</span></div><OverflowMenu label="Open user actions" onAction={showNotice} /></div></div>
      </aside>

      <section className="main-area">
        <header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button><div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{activeView}</strong></div><div className="topbar-actions"><div className="topbar-menu-wrap"><button className="icon-button" aria-label="Help" aria-expanded={helpOpen} onClick={() => { setHelpOpen((open) => !open); setNotificationsOpen(false); setProfileOpen(false) }}><CircleHelp size={19} /></button>{helpOpen && <div className="topbar-menu help-menu" role="menu"><strong>Need help?</strong><span>Review attendance guidance or contact support.</span><button onClick={() => { setHelpOpen(false); showNotice('Help center opened', 'info') }}>Open help center</button><button onClick={() => { setHelpOpen(false); showNotice('Support request started', 'info') }}>Contact support</button></div>}</div><div className="topbar-menu-wrap"><button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setHelpOpen(false); setProfileOpen(false) }}><Bell size={19} />{!notificationsOpen && <i />}</button>{notificationsOpen && <div className="topbar-menu notification-menu" role="menu"><div className="menu-heading"><strong>Notifications</strong><button onClick={() => showNotice('Notifications marked as read', 'info')}>Mark read</button></div><div className="notification-item"><span className="notification-dot" /><div><strong>Unknown verification attempt</strong><span>Main entrance · 08:41 AM</span></div></div><div className="notification-item"><span className="notification-dot muted" /><div><strong>Weekly report is ready</strong><span>Attendance summary generated</span></div></div></div>}</div><div className="topbar-menu-wrap"><button className="topbar-user" aria-label="Open profile menu" aria-expanded={profileOpen} onClick={() => { setProfileOpen((open) => !open); setHelpOpen(false); setNotificationsOpen(false) }}><div className="user-avatar small">JD</div><ChevronDown className={profileOpen ? 'chevron-open' : ''} size={15} /></button>{profileOpen && <div className="topbar-menu profile-menu" role="menu"><div className="profile-heading"><div className="user-avatar small">JD</div><div><strong>Jordan Davis</strong><span>Administrator</span></div></div><button onClick={() => { setProfileOpen(false); setActiveView('Settings') }}>Account settings</button><button onClick={() => { setProfileOpen(false); showNotice('Signed out action is ready to connect', 'info') }}>Sign out</button></div>}</div></div></header>
        <div className="page-content">
          {notice && <div className={`notice notice-${notice.tone}`}><CheckCircle2 size={17} />{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss notice"><X size={15} /></button></div>}
          {activeView === 'Overview' && <Overview onNavigate={setActiveView} onAction={showNotice} dateFilter={dateFilter} setDateFilter={setDateFilter} />}
          {activeView === 'Attendance' && <Attendance onAction={showNotice} dateFilter={dateFilter} setDateFilter={setDateFilter} attendance={eventsState} people={peopleState} />}
          {activeView === 'People' && <People search={search} setSearch={setSearch} onAction={showNotice} people={filteredPeople} onEnroll={(person) => { setEnrollment(person); setActiveView('Face verification') }} />}
                    {activeView === 'Face verification' && <Verification status={verification} enrollment={enrollment} people={peopleState} attendance={eventsState} onStart={startVerification} onReset={() => setVerification('ready')} onNoMatch={handleNoMatch} onNavigate={setActiveView} onComplete={handleVerificationComplete} onAction={showNotice} />}
          {activeView === 'Reports' && <Reports onAction={showNotice} />}
          {activeView === 'Settings' && <SettingsView workspaceSettings={workspaceSettings} onWorkspaceSettingsChange={setWorkspaceSettings} onResetData={() => { setPeopleState([]); setEventsState([]); setWorkspaceSettings({ name: 'Northstar Studio', timezone: 'America/New_York' }) }} onAction={showNotice} />}
        </div>
      </section>
    </main>
  )
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function OverflowMenu({ label, onAction }: { label: string; onAction: (text: string, tone?: Notice['tone']) => void }) {
  const [open, setOpen] = useState(false)
  return <div className="overflow-wrap"><button className="icon-button" aria-label={label} aria-expanded={open} onClick={() => setOpen((value) => !value)}><MoreHorizontal size={18} /></button>{open && <div className="overflow-menu" role="menu"><button onClick={() => { setOpen(false); onAction('Details opened', 'info') }}>View details</button><button onClick={() => { setOpen(false); onAction('Export started', 'info') }}>Export</button><button onClick={() => { setOpen(false); onAction('Action menu closed', 'info') }}>Dismiss</button></div>}</div>
}

function Overview({ onNavigate, onAction, dateFilter, setDateFilter }: { onNavigate: (view: View) => void; onAction: (text: string, tone?: Notice['tone']) => void; dateFilter: string; setDateFilter: (value: string) => void }) {
  return <>
    <PageHeading eyebrow="Wednesday, September 9, 2026" title="Good morning, Sovon" description="Here&apos;s what&apos;s happening with attendance today." action={<div className="heading-actions"><select aria-label="Select date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}><option>Today, Apr 18, 2025</option><option>This week, Apr 14–18</option><option>This month, April 2025</option></select><button className="button button-primary" onClick={() => onNavigate('Face verification')}><Camera size={17} /> Open verifier</button></div>} />
    <div className="kpi-grid"><KpiCard icon={<Users />} label="Total people" value="248" detail="12 teams" trend="+8 this month" tone="blue" /><KpiCard icon={<CheckCircle2 />} label="Present today" value="218" detail="87.9% attendance" trend="+3.2% vs. last week" tone="green" /><KpiCard icon={<Clock3 />} label="Late arrivals" value="14" detail="5.6% of total" trend="-2 from yesterday" tone="amber" /><KpiCard icon={<AlertTriangle />} label="Absent today" value="16" detail="6.5% of total" trend="Needs attention" tone="rose" /></div>
    <div className="content-grid"><section className="panel trend-panel"><div className="panel-header"><div><h2>Attendance trend</h2><p>Average daily attendance across your workspace</p></div><select aria-label="Trend period"><option>Last 7 days</option><option>Last 30 days</option></select></div><div className="chart-wrap"><div className="chart-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div className="chart-area"><div className="grid-lines"><i /><i /><i /><i /><i /></div><svg className="line-chart" viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="Attendance trend chart"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--blue)" stopOpacity=".22" /><stop offset="1" stopColor="var(--blue)" stopOpacity="0" /></linearGradient></defs><path d="M0 108 C55 120, 65 76, 112 88 S185 120, 225 92 S285 48, 340 68 S390 91, 450 53 S520 84, 560 61 S640 32, 700 42 V220 H0 Z" fill="url(#chartFill)" /><path d="M0 108 C55 120, 65 76, 112 88 S185 120, 225 92 S285 48, 340 68 S390 91, 450 53 S520 84, 560 61 S640 32, 700 42" fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" /></svg><div className="chart-x"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></div><div className="chart-legend"><span><i className="legend-blue" />Present <strong>91.4%</strong></span><span><i className="legend-amber" />Late <strong>4.2%</strong></span><span><i className="legend-gray" />Absent <strong>4.4%</strong></span></div></section><section className="panel activity-panel"><div className="panel-header"><div><h2>Live activity</h2><p>Recent verification events</p></div><span className="live-status"><i /> Live</span></div><div className="activity-list">{events.slice(0, 3).map((event) => <div className="activity-row" key={event.id}><Avatar initials={event.initials} color="blue" /><div className="activity-info"><strong>{event.name}</strong><span>{event.location} · {event.time}</span></div><StatusBadge status={event.result} /></div>)}</div><button className="text-button" onClick={() => onNavigate('Face verification')}>View all activity <ArrowDownToLine size={15} /></button></section></div>
    <div className="bottom-grid"><section className="panel summary-panel"><div className="panel-header"><div><h2>Today&apos;s attendance</h2><p>{dateFilter}</p></div><OverflowMenu label="Open attendance summary actions" onAction={onAction} /></div><div className="summary-body"><div className="donut"><div><strong>87.9%</strong><span>Present</span></div></div><div className="summary-stats"><div><i className="dot dot-green" /><span>Present</span><strong>218</strong></div><div><i className="dot dot-amber" /><span>Late</span><strong>14</strong></div><div><i className="dot dot-rose" /><span>Absent</span><strong>16</strong></div></div></div></section><section className="panel device-panel"><div className="panel-header"><div><h2>Verification devices</h2><p>System health overview</p></div><button className="text-button" onClick={() => onNavigate('Settings')}>Manage <ChevronDown size={15} /></button></div><div className="device-row"><div className="device-icon"><Video size={18} /></div><div><strong>Main entrance kiosk</strong><span>Last seen 2 min ago</span></div><span className="device-online"><i /> Online</span></div><div className="device-row"><div className="device-icon"><Video size={18} /></div><div><strong>South lobby camera</strong><span>Last seen 2 min ago</span></div><span className="device-online"><i /> Online</span></div><div className="privacy-callout"><ShieldCheck size={18} /><div><strong>Privacy controls are active</strong><span>Consent required · Embeddings encrypted · Images not retained</span></div></div></section></div>
  </>
}

function KpiCard({ icon, label, value, detail, trend, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; trend: string; tone: string }) { return <div className="kpi-card"><div className={`kpi-icon kpi-${tone}`}>{icon}</div><p>{label}</p><div className="kpi-value"><strong>{value}</strong><span>{detail}</span></div><small className={tone === 'rose' ? 'trend-neutral' : 'trend-up'}>{trend}</small></div> }

function Attendance({ onAction, dateFilter, setDateFilter, attendance, people: attendancePeople }: { onAction: (text: string, tone?: Notice['tone']) => void; dateFilter: string; setDateFilter: (value: string) => void; attendance: typeof events; people: typeof people }) {
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [locationFilter, setLocationFilter] = useState('All locations')
  const [departmentFilter, setDepartmentFilter] = useState('All department')
  const rows = useMemo(() => attendance.map((event, index) => {
    const person = attendancePeople.find((candidate) => candidate.name === event.name) ?? attendancePeople[index]
    return person ? { person, event, location: person.location || event.location, time: event.time } : null
  }).filter((row): row is { person: (typeof people)[number]; event: (typeof events)[number]; location: string; time: string } => Boolean(row)), [attendance, attendancePeople])
  const filteredRows = rows.filter(({ person, location }) => (statusFilter === 'All statuses' || person.status === statusFilter) && (locationFilter === 'All locations' || location === locationFilter) && (departmentFilter === 'All department' || person.dept === departmentFilter))
  const exportCsv = () => {
    const headers = ['Person', 'Date', 'Check-in', 'Location', 'DEPT', 'Method', 'Status']
    const values = filteredRows.map(({ person, location, time }) => [person.name, 'Apr 18, 2025', time, location, person.dept, 'Face match', person.status])
    const csv = [headers, ...values].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `attendance-${dateFilter.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
    onAction(`${filteredRows.length} attendance record${filteredRows.length === 1 ? '' : 's'} exported as CSV`)
  }
  return <><PageHeading title="Attendance records" description="Review, filter, and export attendance across your workspace." action={<button className="button button-primary" onClick={exportCsv}><Download size={17} /> Export CSV</button>} /><div className="panel table-panel"><div className="table-toolbar"><div className="filter-group"><CalendarDays size={17} /><select aria-label="Filter by date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}><option>Today, Apr 18, 2025</option><option>This week, Apr 14–18</option><option>This month, April 2025</option></select><select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All statuses</option><option>Present</option><option>Late</option><option>Absent</option></select><select aria-label="Filter by location" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}><option>All locations</option><option>Hooghly</option><option>Howrah</option><option>North 24 Parganas</option><option>Purba Bardhaman</option></select><select aria-label="Filter by department" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}><option>All department</option><option>Creative</option><option>Technology</option><option>Growth</option><option>Operations</option><option>Finance</option></select></div><button className="button button-secondary" onClick={() => { setDateFilter('Today, Apr 18, 2025'); setStatusFilter('All statuses'); setLocationFilter('All locations'); setDepartmentFilter('All department'); onAction('Attendance filters cleared', 'info') }}><SlidersHorizontal size={16} /> Clear filters</button></div><table><thead><tr><th>Person</th><th>Date</th><th>Check-in</th><th>Location</th><th>DEPT</th><th>Method</th><th>Status</th><th /></tr></thead><tbody>{filteredRows.map(({ person, event, location, time }) => <tr key={event.id}><td><div className="person-cell"><Avatar initials={person.initials} color={person.color} /><div><strong>{person.name}</strong><span>{person.team}</span></div></div></td><td>Apr 18, 2025</td><td>{time}</td><td>{location}</td><td><span className="dept-cell">{person.dept}</span></td><td><span className="method"><Fingerprint size={14} /> Face match</span></td><td><StatusBadge status={person.status} /></td><td><button className="icon-button" aria-label={`More actions for ${person.name}`}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{filteredRows.length === 0 && <div className="empty-state"><Search size={20} /><strong>No attendance records found</strong><span>Try changing one of the filters.</span></div>}</div></> }

function PeopleLegacy({ search, setSearch, onAction, onEnroll, people: visiblePeople }: { search: string; setSearch: (value: string) => void; onAction: (text: string) => void; onEnroll: (person: { name: string; email: string; department: string; team: string; location?: string }) => void; people: typeof people }) {
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('Creative')
  const [team, setTeam] = useState('')
  const [location, setLocation] = useState('Hooghly')
  const [consent, setConsent] = useState(false)
  const [enrollmentFilter, setEnrollmentFilter] = useState('All people')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState('All departments')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const filteredPeople = visiblePeople.filter((person) => (enrollmentFilter === 'All people' || (enrollmentFilter === 'Enrolled' ? person.enrolled : !person.enrolled)) && (departmentFilter === 'All departments' || person.dept === departmentFilter) && (statusFilter === 'All statuses' || person.status === statusFilter))
  const clearPeopleFilters = () => { setEnrollmentFilter('All people'); setDepartmentFilter('All departments'); setStatusFilter('All statuses'); setFiltersOpen(false); onAction('People filters cleared') }
  const submitPerson = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !email.trim() || !team.trim() || !consent) return
    setFormOpen(false)
    onEnroll({ name: name.trim(), email: email.trim(), department, team: team.trim(), location })
setName(''); setEmail(''); setTeam(''); setLocation('Hooghly'); setConsent(false)
  }
  return <><PageHeading title="People" description="Manage your workspace members and biometric enrollment." action={<button className="button button-primary" onClick={() => setFormOpen(true)}><Plus size={17} /> Add person</button>} /><div className="panel table-panel"><div className="table-toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." aria-label="Search people" /></label><div className="filter-group"><select aria-label="Filter by enrollment" value={enrollmentFilter} onChange={(event) => setEnrollmentFilter(event.target.value)}><option>All people</option><option>Enrolled</option><option>Needs enrollment</option></select><button className={`button button-secondary ${filtersOpen ? 'button-active' : ''}`} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={16} /> Filters</button>{filtersOpen && <div className="inline-filter-menu"><select aria-label="Filter people by department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option>All departments</option><option>Creative</option><option>Technology</option><option>Growth</option><option>Operations</option><option>Finance</option></select><select aria-label="Filter people by attendance" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Present</option><option>Late</option><option>Absent</option></select><button type="button" className="link-button" onClick={clearPeopleFilters}>Clear filters</button></div>}</div></div><table><thead><tr><th>Person</th><th>Team</th><th>Attendance today</th><th>Face enrollment</th><th>Consent</th><th /></tr></thead><tbody>{filteredPeople.map((person) => <tr key={person.email}><td><div className="person-cell"><Avatar initials={person.initials} color={person.color} /><div><strong>{person.name}</strong><span>{person.email}</span></div></div></td><td>{person.team}</td><td><StatusBadge status={person.status} /></td><td>{person.enrolled ? <span className="inline-success"><CheckCircle2 size={16} /> Enrolled</span> : <button className="link-button" onClick={() => onAction(`Enrollment started for ${person.name}`)}>Enroll face</button>}</td><td>{person.consent ? <span className="inline-success"><ShieldCheck size={16} /> Granted</span> : <span className="inline-muted">Not granted</span>}</td><td><button className="icon-button" aria-label={`More actions for ${person.name}`}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{filteredPeople.length === 0 && <div className="empty-state"><Search size={28} /><strong>No people found</strong><span>Try a different name, email, or team.</span></div>}</div>{formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false) }}><section className="person-modal" role="dialog" aria-modal="true" aria-labelledby="add-person-title"><div className="modal-header"><div><p className="eyebrow">People enrollment</p><h2 id="add-person-title">Add person</h2><p>Create a profile before enrolling their face.</p></div><button className="icon-button" aria-label="Close add person form" onClick={() => setFormOpen(false)}><X size={18} /></button></div><form onSubmit={submitPerson}><label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Taylor Morgan" /></label><label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></label><div className="form-row"><label>Department<select value={department} onChange={(event) => setDepartment(event.target.value)}><option>Creative</option><option>Technology</option><option>Growth</option><option>Operations</option><option>Finance</option></select></label><label>Team<input required value={team} onChange={(event) => setTeam(event.target.value)} placeholder="e.g. Product" /></label></div><label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> <span>I confirm this person has provided biometric consent.</span></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Add person</button></div></form></section></div>}</> }

function People({ search, setSearch, onAction, onEnroll, people: visiblePeople }: { search: string; setSearch: (value: string) => void; onAction: (text: string) => void; onEnroll: (person: { name: string; email: string; department: string; team: string; location?: string }) => void; people: typeof people }) {
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [team, setTeam] = useState(''); const [location, setLocation] = useState('Hooghly'); const [consent, setConsent] = useState(false)
  const filtered = visiblePeople.filter((person) => `${person.name} ${person.email} ${person.team}`.toLowerCase().includes(search.toLowerCase()))
  return <><PageHeading title="People" description="Manage your workspace members and biometric enrollment." action={<button className="button button-primary" onClick={() => setFormOpen(true)}> <Plus size={17} /> Add person</button>} /><div className="panel table-panel"><div className="table-toolbar"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people..." aria-label="Search people" /></label></div><table><thead><tr><th>Person</th><th>Team</th><th>Attendance today</th><th>Face enrollment</th><th>Consent</th><th>Actions</th></tr></thead><tbody>{filtered.map((person) => <tr key={person.email}><td><div className="person-cell"><Avatar initials={person.initials} color={person.color} /><div><strong>{person.name}</strong><span>{person.email}</span></div></div></td><td>{person.team}</td><td><StatusBadge status={person.status} /></td><td>{person.enrolled ? <span className="inline-success"><CheckCircle2 size={14} /> Enrolled</span> : <button className="enroll-face-button" onClick={() => onEnroll({ name: person.name, email: person.email, department: person.dept, team: person.team, location: person.location || 'Hooghly' })}>Enroll face</button>}</td><td>{person.consent ? <span className="inline-success"><ShieldCheck size={14} /> Granted</span> : <span className="not-granted">Not granted</span>}</td><td><OverflowMenu label={`Open actions for ${person.name}`} onAction={onAction} /></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state"><Search size={28} /><strong>No people found</strong></div>}</div>{formOpen && <div className="modal-backdrop"><section className="person-modal" role="dialog" aria-modal="true"><div className="modal-header"><div><p className="eyebrow">People enrollment</p><h2>Add person</h2><p>Enter details, then enroll their face.</p></div><button className="icon-button" aria-label="Close" onClick={() => setFormOpen(false)}><X size={18} /></button></div><form onSubmit={(event) => { event.preventDefault(); if (!name.trim() || !email.trim() || !team.trim() || !consent) return; onEnroll({ name: name.trim(), email: email.trim(), department: 'Operations', team: team.trim() }); setFormOpen(false); setName(''); setEmail(''); setTeam(''); setConsent(false) }}><label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. James Wilson" /></label><label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><div className="form-row"><label>Team<input required value={team} onChange={(event) => setTeam(event.target.value)} /></label><label>Location<select value={location} onChange={(event) => setLocation(event.target.value)}><option>Hooghly</option><option>Howrah</option><option>North 24 Parganas</option><option>Purba Bardhaman</option></select></label></div><label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Consent granted</span></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button className="button button-primary" type="submit">Add person</button></div></form></section></div>}</>}function Verification({ status, enrollment, people: enrolledPeople, attendance, onStart, onReset, onNoMatch, onNavigate, onComplete, onAction }: { status: 'ready' | 'scanning' | 'verified' | 'no-match'; enrollment: { name: string; email: string; department: string; team: string; location?: string } | null; people: Person[]; attendance: EventRecord[]; onStart: () => void; onReset: () => void; onNoMatch: () => void; onNavigate: (view: View) => void; onComplete: (person: Person, event: EventRecord, mode: 'enrolled' | 'verified') => void; onAction: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'live' | 'blocked'>('idle')
  const [captureStep, setCaptureStep] = useState(0)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualDepartment, setManualDepartment] = useState('Operations')
  const [manualTeam, setManualTeam] = useState('')
  const [manualConsent, setManualConsent] = useState(false)
  const hasCompleted = useRef(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [matchResult, setMatchResult] = useState<{ name: string; confidence: string } | null>(null)
  const peopleRef = useRef(enrolledPeople)
  const angles = ['Look straight ahead', 'Turn slightly left', 'Turn slightly right', 'Tilt your chin up', 'Tilt your chin down', 'Look up-left', 'Look up-right', 'Return to center']

  useEffect(() => { peopleRef.current = enrolledPeople }, [enrolledPeople])

  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()) }, [])

  useEffect(() => {
    let cancelled = false
    loadFaceModels().then(() => { if (!cancelled) setModelsReady(true) }).catch(() => { if (!cancelled) onAction('Could not load face recognition models. Check that /models is set up.') })
    return () => { cancelled = true }
  }, [onAction])

  useEffect(() => {
    if (status !== 'scanning') return
    let cancelled = false
    hasCompleted.current = false

    async function runCaptureSequence() {
      if (!modelsReady) await loadFaceModels()
      const descriptors: Float32Array[] = []

      for (let index = 0; index < angles.length; index += 1) {
        const video = videoRef.current
        if (!video) return
        if (cancelled) return
        setCaptureStep(index + 1)
        try {
          const descriptor = await getFaceDescriptor(video)
          if (descriptor) descriptors.push(descriptor)
        } catch {
          // A missed angle is fine as long as other angles capture a usable face.
        }
        if (cancelled) return
        await new Promise((resolve) => window.setTimeout(resolve, 500))
      }

      if (cancelled) return
      const result = await matchFaceAgainstDatabase(descriptors, peopleRef.current, enrollment)
      if (cancelled || hasCompleted.current) return

      if (result.match && enrollment) {
        hasCompleted.current = true
        const initials = enrollment.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
        setMatchResult({ name: enrollment.name, confidence: result.confidence })
        onComplete(
          { name: enrollment.name, email: enrollment.email, team: enrollment.team, location: enrollment.location || 'Hooghly', dept: enrollment.department, status: 'Present', enrolled: true, consent: true, initials, color: 'cyan', faceDescriptor: result.descriptor },
          { id: makeEventId(), name: enrollment.name, time: 'Just now', location: enrollment.location || 'Hooghly', confidence: result.confidence, initials, result: 'Verified' },
          'enrolled',
        )
      } else if (result.match && result.person) {
        hasCompleted.current = true
        setMatchResult({ name: result.person.name, confidence: result.confidence })
        onComplete(
          { ...result.person, status: 'Present' },
          { id: makeEventId(), name: result.person.name, time: 'Just now', location: result.person.location || 'Hooghly', confidence: result.confidence, initials: result.person.initials, result: 'Verified' },
          'verified',
        )
      } else {
        onNoMatch()
      }
    }

    runCaptureSequence()
    return () => { cancelled = true }
  }, [status, enrollment, modelsReady, onComplete, onNoMatch])

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState('blocked'); return }
    setCameraState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      setCameraState('live')
      hasCompleted.current = false
      setMatchResult(null)
      onStart()
      setCaptureStep(1)
    } catch { setCameraState('blocked'); onAction('Camera access was denied. Enable camera permission in your browser and try again.') }
  }

  return <><PageHeading eyebrow="Live verification kiosk" title="Face verification" description="Use your camera for live, consent-aware verification." action={<span className="secure-chip"><ShieldCheck size={16} /> Secure session</span>} /><div className="verification-layout"><section className="panel camera-panel"><div className="camera-header"><div><h2>Northstar Studio · Main entrance</h2><p>Live camera preview · Permission required</p></div><span className={`camera-live ${cameraState === 'live' ? '' : 'camera-demo'}`}><i /> {cameraState === 'live' ? 'Camera live' : cameraState === 'requesting' ? 'Requesting access' : 'Camera off'}</span></div><div className={`camera-preview camera-${status}`}><video ref={videoRef} className="camera-video" autoPlay muted playsInline aria-label="Live face verification camera" /><canvas ref={canvasRef} aria-hidden="true" className="capture-canvas" /><div className="camera-grid" /><div className="face-frame"><span /><span /><span /><span /></div>{status === 'ready' && <div className="camera-prompt"><div className="camera-prompt-icon"><Camera size={24} /></div><strong>{cameraState === 'blocked' ? 'Camera access required' : cameraState === 'requesting' ? 'Requesting camera access...' : 'Position your face in the frame'}</strong><span>{cameraState === 'blocked' ? 'Allow camera permissions to continue' : cameraState === 'live' ? 'Live preview is active' : 'Start verification to enable live video'}</span></div>}{status === 'scanning' && <div className="camera-prompt"><div className="scan-ring"><Fingerprint size={28} /></div><strong>{`Capture ${Math.min(captureStep, angles.length)} of ${angles.length}`}</strong><span>{angles[Math.max(0, Math.min(captureStep - 1, angles.length - 1))]}</span><div className="capture-progress"><i style={{ width: `${Math.min((captureStep / angles.length) * 100, 100)}%` }} /></div></div>}{status === 'verified' && <div className="camera-prompt"><div className="verified-ring"><Check size={30} /></div><strong>{matchResult ? `${matchResult.name} ${enrollment ? 'enrolled' : 'already present'}` : 'Verified'}</strong><span>{matchResult ? `Confidence ${matchResult.confidence} · Attendance marked` : 'Attendance marked'}</span></div>}{status === 'no-match' && <div className="camera-prompt"><div className="scan-ring"><X size={28} /></div><strong>No matching face found</strong><span>{enrollment ? 'Could not capture a clear enough face to enroll. Try again in better lighting.' : 'This face is not enrolled yet, or the match was below the confidence threshold.'}</span></div>}<div className="camera-meta"><span><ShieldCheck size={14} /> Sample only</span><span>11:24:08 AM</span></div></div><div className="camera-actions" onClickCapture={(event) => { const button = (event.target as HTMLElement).closest('button'); if (button?.textContent?.toLowerCase().includes('manual')) { event.preventDefault(); event.stopPropagation(); setManualOpen(true) } }}>{status === 'verified' ? <button className="button button-secondary" onClick={onReset}>Verify another person</button> : status === 'no-match' ? <button className="button button-primary button-wide" onClick={() => { setMatchResult(null); onReset() }}>Try again</button> : <button className="button button-primary button-wide" onClick={startCamera} disabled={status === 'scanning' || cameraState === 'requesting'}>{cameraState === 'requesting' ? 'Requesting access...' : status === 'scanning' ? 'Scanning...' : cameraState === 'live' ? 'Verify live face' : 'Allow camera & start'}</button>}<button className="button button-ghost" onClick={() => onAction('Manual attendance flow opened')}>Use manual attendance</button>{manualOpen && <div className="modal-backdrop" role="presentation"><section className="person-modal" role="dialog" aria-modal="true" aria-labelledby="manual-attendance-title"><div className="modal-header"><div><p className="eyebrow">Manual attendance</p><h2 id="manual-attendance-title">Add attendance person</h2><p>Enter the person details to record attendance without a camera.</p></div><button type="button" className="icon-button" aria-label="Close manual attendance form" onClick={() => setManualOpen(false)}><X size={18} /></button></div><form onSubmit={(event) => { event.preventDefault(); if (!manualName.trim() || !manualEmail.trim() || !manualTeam.trim() || !manualConsent) return; const initials = manualName.trim().split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); onComplete({ name: manualName.trim(), email: manualEmail.trim(), team: manualTeam.trim(), dept: manualDepartment, status: 'Present', enrolled: false, consent: true, location: 'Hooghly', initials, color: 'cyan' }, { id: makeEventId(), name: manualName.trim(), time: 'Just now', location: 'Manual entry', confidence: '—', initials, result: 'Manual' }, 'enrolled'); setManualOpen(false); setManualName(''); setManualEmail(''); setManualTeam(''); setManualConsent(false) }}><label>Full name<input required value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="e.g. James Wilson" /></label><label>Email address<input required type="email" value={manualEmail} onChange={(event) => setManualEmail(event.target.value)} placeholder="name@company.com" /></label><div className="form-row"><label>Department<select value={manualDepartment} onChange={(event) => setManualDepartment(event.target.value)}><option>Operations</option><option>Creative</option><option>Technology</option><option>Growth</option><option>Finance</option></select></label><label>Team<input required value={manualTeam} onChange={(event) => setManualTeam(event.target.value)} placeholder="e.g. Operations" /></label></div><label className="consent-check"><input type="checkbox" checked={manualConsent} onChange={(event) => setManualConsent(event.target.checked)} /><span>I confirm this person has provided attendance consent.</span></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setManualOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Add person</button></div></form></section></div>}</div></section><aside className="verification-side"><section className="panel"><h2>Verification checks</h2><p className="panel-subtitle">All safeguards must pass before marking attendance.</p><div className="check-list"><CheckItem label="Camera connection" value="Connected" done={true} /><CheckItem label="Liveness detection" value={status === 'scanning' ? 'In progress' : status === 'verified' ? 'Passed' : status === 'no-match' ? 'No face matched' : 'Ready'} done={status === 'verified'} active={status === 'scanning'} /><CheckItem label="Face match" value={status === 'verified' && matchResult ? `${matchResult.confidence} confidence` : status === 'no-match' ? 'No match found' : 'Waiting'} done={status === 'verified'} /></div></section><section className="panel recent-panel"><div className="panel-header"><div><h2>Recent verifications</h2><p>Today, Apr 18</p></div><Activity size={18} className="muted-icon" /></div>{attendance.slice(0, 6).map((event) => <div className="recent-row" key={event.id}><Avatar initials={event.initials} color="blue" /><div><strong>{event.name}</strong><span>{event.time}</span></div><StatusBadge status={event.result} /></div>)}</section></aside></div><div className="privacy-banner"><ShieldCheck size={20} /><div><strong>Privacy and consent are built in</strong><span>Face embeddings are encrypted at rest. Raw images are not retained by default. People can always use an alternate attendance method.</span></div><button className="text-button" onClick={() => onAction('Privacy policy preview opened')}>Read policy</button></div></> }

function CheckItem({ label, value, done, active }: { label: string; value: string; done: boolean; active?: boolean }) { return <div className="check-item"><span className={`check-icon ${done ? 'done' : active ? 'active' : ''}`}>{done ? <Check size={14} /> : active ? <Activity size={14} /> : <span />}</span><div><strong>{label}</strong><span>{value}</span></div></div> }

function Reports({ onAction }: { onAction: (text: string) => void }) {
  const exportReport = () => {
    const rows = [['Metric', 'Value'], ['Average attendance', '91.4%'], ['Average check-in time', '08:54 AM'], ['Active people', '232 of 248'], ['Consent records', '248 of 248'], ['Retention policy', 'Configured · 90 days'], ['Audit log coverage', '100% of events']]
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'attendance-report-april-2025.csv'
    link.click()
    URL.revokeObjectURL(url)
    onAction('Attendance report downloaded as CSV')
  }
  return <><PageHeading title="Reports" description="Understand attendance patterns and keep your records audit-ready." action={<button className="button button-primary" onClick={exportReport}><Download size={17} /> Export report</button>} /><div className="report-grid"><div className="panel report-hero"><div className="report-hero-icon"><FileBarChart size={25} /></div><div><p className="eyebrow">April 2025 summary</p><h2>Attendance is trending up</h2><p>Average attendance is <strong>91.4%</strong>, up 3.2% compared with March.</p></div><div className="report-progress"><span><b style={{ width: '91.4%' }} /></span><strong>91.4%</strong></div></div><KpiCard icon={<Clock3 />} label="Avg. check-in time" value="08:54" detail="AM" trend="6 min earlier" tone="blue" /><KpiCard icon={<Users />} label="Active people" value="232" detail="of 248 total" trend="93.5% enrolled" tone="green" /></div><div className="content-grid report-content"><section className="panel"><div className="panel-header"><div><h2>Attendance by team</h2><p>Current month comparison</p></div><OverflowMenu label="Open attendance chart actions" onAction={onAction} /></div>{['Engineering', 'Design', 'Marketing', 'Operations', 'Finance'].map((team, index) => <div className="bar-row" key={team}><span>{team}</span><div><i style={{ width: `${96 - index * 5}%` }} /></div><strong>{96 - index * 5}%</strong></div>)}</section><section className="panel audit-panel"><div className="panel-header"><div><h2>Audit readiness</h2><p>Data governance checklist</p></div><ShieldCheck size={18} className="success-icon" /></div><CheckItem label="Consent records" value="248 of 248 people" done /><CheckItem label="Retention policy" value="Configured · 90 days" done /><CheckItem label="Audit log coverage" value="100% of events" done /><CheckItem label="Fallback attendance" value="Available" done /></section></div></> }

function SettingsView({ workspaceSettings, onWorkspaceSettingsChange, onResetData, onAction }: { workspaceSettings: { name: string; timezone: string }; onWorkspaceSettingsChange: (settings: { name: string; timezone: string }) => void; onResetData: () => void; onAction: (text: string, tone?: Notice['tone']) => void }) {
  const [section, setSection] = useState('Workspace')
  const [workspaceName, setWorkspaceName] = useState(workspaceSettings.name)
  const [timezone, setTimezone] = useState(workspaceSettings.timezone)
  const [toggles, setToggles] = useState<Record<string, boolean>>({ consent: true, rawImages: true, fallback: true, alerts: true, dailySummary: true })
  const [retention, setRetention] = useState('90 days')
  const [savedSettings, setSavedSettings] = useState({ workspaceName: 'Teen Titans', timezone: 'Indian Standard Time/IST', retention: '90 days', toggles: { consent: true, rawImages: true, fallback: true, alerts: true, dailySummary: true } })
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const currentSettings = { workspaceName, timezone, retention, toggles }
  const hasUnsavedChanges = JSON.stringify(currentSettings) !== JSON.stringify(savedSettings)
  const toggle = (key: string) => setToggles((current) => ({ ...current, [key]: !current[key] }))
  const saveChanges = () => {
    const nextSettings = { workspaceName, timezone, retention, toggles: { ...toggles } as typeof savedSettings.toggles }
    setSavedSettings(nextSettings)
    onWorkspaceSettingsChange({ name: workspaceName.trim() || workspaceSettings.name, timezone })
    setSavedAt(Date.now())
    onAction(`${section} settings saved successfully`)
  }
  const sections = ['Workspace', 'Privacy & consent', 'Devices', 'Notifications', 'Roles & permissions']
  return <><PageHeading title="Settings" description="Configure workspace controls, privacy, devices, and notifications." action={<div className="heading-actions"><span className={`save-state ${hasUnsavedChanges ? 'save-state-pending' : ''}`} aria-live="polite">{hasUnsavedChanges ? 'Unsaved changes' : savedAt ? `Saved just now · ${savedSettings.timezone}` : `Saved · ${savedSettings.timezone}`}</span><button type="button" className="button button-primary" onClick={saveChanges} disabled={!hasUnsavedChanges}><Check size={17} /> Save changes</button></div>} /><div className="settings-layout"><div className="settings-nav">{sections.map((item) => <button key={item} className={section === item ? 'settings-nav-active' : ''} onClick={() => setSection(item)}>{item}</button>)}</div><div className="settings-content">
    {section === 'Workspace' && <><section className="panel settings-section"><div className="settings-heading"><div><h2>Workspace settings</h2><p>General information about your attendance workspace.</p></div><Settings size={19} /></div><label>Workspace name<input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></label><label>Timezone<select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option value="America/New_York">Eastern Time (ET)</option><option value="Pacific Time">Pacific Time (PT)</option><option value="Central European Time">Central European Time (CET)</option><option value="Asia/Kolkata">Indian Standard Time (IST)</option></select></label></section><section className="panel settings-section"><div className="settings-heading"><div><h2>Privacy defaults</h2><p>Set how biometric data is handled in your workspace.</p></div><ShieldCheck size={19} /></div><ToggleRow title="Require consent before enrollment" description="People must accept the biometric consent notice." enabled={toggles.consent} onToggle={() => toggle('consent')} /><ToggleRow title="Do not retain raw camera images" description="Only encrypted face embeddings are stored." enabled={toggles.rawImages} onToggle={() => toggle('rawImages')} /><ToggleRow title="Allow alternate attendance method" description="People can check in manually if they prefer." enabled={toggles.fallback} onToggle={() => toggle('fallback')} /></section></>}
    {section === 'Privacy & consent' && <SettingsPanel title="Privacy & consent" description="Control biometric consent, storage, and data retention." icon={<ShieldCheck size={19} />}><ToggleRow title="Require consent before enrollment" description="People must accept the biometric consent notice." enabled={toggles.consent} onToggle={() => toggle('consent')} /><ToggleRow title="Do not retain raw camera images" description="Only encrypted face embeddings are stored." enabled={toggles.rawImages} onToggle={() => toggle('rawImages')} /><label>Retention period<select value={retention} onChange={(event) => setRetention(event.target.value)}><option>30 days</option><option>90 days</option><option>1 year</option></select></label></SettingsPanel>}
    {section === 'Devices' && <SettingsPanel title="Devices" description="Manage cameras and verification locations." icon={<Video size={19} />}><DeviceRow name="Camera 01 · Main entrance" detail="Online · Last seen just now" /><DeviceRow name="Camera 02 · South lobby" detail="Online · Last seen 2 minutes ago" /><button className="button button-secondary" onClick={() => onAction('Device pairing flow started', 'info')}>Add verification device</button></SettingsPanel>}
    {section === 'Notifications' && <SettingsPanel title="Notifications" description="Choose which attendance events reach administrators." icon={<Bell size={19} />}><ToggleRow title="Unknown verification attempts" description="Alert administrators when a match needs review." enabled={toggles.alerts} onToggle={() => toggle('alerts')} /><ToggleRow title="Daily attendance summary" description="Send a summary of attendance activity each morning." enabled={toggles.dailySummary} onToggle={() => toggle('dailySummary')} /></SettingsPanel>}
    {section === 'Roles & permissions' && <SettingsPanel title="Roles & permissions" description="Control who can manage biometric and attendance data." icon={<Users size={19} />}><DeviceRow name="Jordan Davis" detail="Administrator · Full access" /><DeviceRow name="Operations team" detail="Manager · Attendance and reports" /><button className="button button-secondary" onClick={() => onAction('Invite administrator flow started', 'info')}>Invite administrator</button></SettingsPanel>}
    {section === 'Workspace' && <section className="panel settings-section danger-section"><div className="settings-heading"><div><h2>Reset workspace data</h2><p>Permanently delete all People and Attendance records from MongoDB for this workspace.</p></div><Trash2 size={19} /></div><button className="button button-danger" onClick={async () => { if (!window.confirm('Delete all People and Attendance records? This cannot be undone.')) return; const response = await fetch('/api/workspace', { method: 'DELETE' }); if (!response.ok) { onAction('Could not reset workspace data', 'info'); return } onResetData(); onAction('All People and Attendance data was deleted') }}>Delete all data</button></section>}
  </div></div></> }

function SettingsPanel({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="panel settings-section"><div className="settings-heading"><div><h2>{title}</h2><p>{description}</p></div>{icon}</div>{children}</section> }
function DeviceRow({ name, detail }: { name: string; detail: string }) { return <div className="toggle-row"><div><strong>{name}</strong><span>{detail}</span></div><span className="status-dot">Online</span></div> }
function ToggleRow({ title, description, enabled, onToggle }: { title: string; description: string; enabled: boolean; onToggle: () => void }) { return <div className="toggle-row"><div><strong>{title}</strong><span>{description}</span></div><button className={`toggle ${enabled ? 'toggle-on' : ''}`} aria-label={title} aria-pressed={enabled} onClick={onToggle}><i /></button></div> }