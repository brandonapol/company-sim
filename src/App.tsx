import { useEffect, useState } from 'react'
import { stageForHeadcount } from './domain/curriculum.ts'
import { ACTIVITY_LABEL, autoAdvanceDue, tokensToday, unreadCount } from './domain/engine.ts'
import { finance, runwayLabel } from './domain/finance.ts'
import type { Activity, Channel, State } from './domain/types.ts'
import { money } from './domain/util.ts'
import { dismissNotice, runWeek, setView, startCompany, updateSettings } from './state/actions.ts'
import { get, useStore } from './state/store.ts'
import type { Ui, View } from './state/store.ts'
import { Field, NumberInput, useNow } from './ui/bits.tsx'
import { ChannelView } from './ui/ChannelView.tsx'
import { SettingsView } from './ui/SettingsView.tsx'
import { CompanyView, CurriculumView, DecisionsView, HiringView, MentorView, PeopleView } from './ui/Views.tsx'

const AUTO_CHECK_MS = 60_000

const QUARK_PITCH = [
  'Quark is a self-hosted personal cloud: a small device that sits in your home and replaces Google Drive or iCloud for photos, files and documents. You buy the hardware once. No subscription, no data mining, and the data never leaves the house.',
  'It is open source (MIT-0): one Go binary with SQLite on the device, Flutter apps for web, iOS and Android, and optional remote access over Tailscale with no vendor relay. Beyond files and photos it already includes docs, sheets, slides, music, books, calendar, chat and a built-in password vault.',
  'Buyers cross-shop Synology, UGREEN, QNAP and TerraMaster. Our own competitive analysis (September 2026) listed the gaps a real buyer would feel: only one user account per device, no automatic phone photo backup, no share links, no SMB network drive, no two-factor login, no desktop sync client and no RAID or redundancy story.',
  'The team today is two people.',
].join('\n\n')

const Onboarding = () => {
  const [ceoName, setCeoName] = useState('')
  const [companyName, setCompanyName] = useState('Autobutler')
  const [product, setProduct] = useState('Quark')
  const [pitch, setPitch] = useState(QUARK_PITCH)
  const [cash, setCash] = useState(250_000)
  const [mrr, setMrr] = useState(0)
  const [cofounderName, setCofounderName] = useState('')
  const [cofounderTitle, setCofounderTitle] = useState('Co-founder & CTO')
  const ready = ceoName.trim() && companyName.trim() && product.trim() && pitch.trim().length >= 20
  return (
    <div className="onboarding">
      <div className="card onboarding-card">
        <h1>Company Sim</h1>
        <p className="muted">
          Practice being CEO as your company grows from 2 people to 500. Your employees are AI agents with their own
          priorities, a mentor reads everything and tells you how you are doing, and the curriculum walks you through
          the decisions that show up at each size. Everything is stored in this browser.
        </p>
        <div className="grid2">
          <Field label="Your name">
            <input value={ceoName} onChange={(e) => setCeoName(e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Company">
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" />
          </Field>
        </div>
        <Field label="Product">
          <input value={product} onChange={(e) => setProduct(e.target.value)} />
        </Field>
        <Field
          label="What it is, who it is for, where it stands today"
          hint="Every employee reads this. Prefilled from the Quark repo. Correct anything stale and add what the repo does not say: price, units sold, who buys it and how they find you."
        >
          <textarea rows={10} value={pitch} onChange={(e) => setPitch(e.target.value)} />
        </Field>
        <div className="grid2">
          <Field label="Co-founder name" hint="Optional. They become your first AI colleague.">
            <input value={cofounderName} onChange={(e) => setCofounderName(e.target.value)} />
          </Field>
          <Field label="Co-founder title">
            <input value={cofounderTitle} onChange={(e) => setCofounderTitle(e.target.value)} />
          </Field>
          <Field label="Cash in the bank ($)">
            <NumberInput value={cash} onChange={setCash} step={10_000} />
          </Field>
          <Field label="Revenue per month today ($)">
            <NumberInput value={mrr} onChange={setMrr} step={500} />
          </Field>
        </div>
        <button
          className="primary"
          disabled={!ready}
          onClick={() =>
            startCompany({
              ceoName: ceoName.trim(),
              companyName: companyName.trim(),
              product: product.trim(),
              pitch: pitch.trim(),
              cash,
              mrr,
              cofounder: cofounderName.trim()
                ? { name: cofounderName.trim(), title: cofounderTitle.trim() || 'Co-founder', salary: 0 }
                : null,
            })
          }
        >
          Start the company
        </button>
        <p className="hint">Works without API keys in mock mode. Add keys in Settings to bring the team to life.</p>
      </div>
    </div>
  )
}

const NAV: { view: View; label: string }[] = [
  { view: { kind: 'company' }, label: 'Company' },
  { view: { kind: 'people' }, label: 'People' },
  { view: { kind: 'hiring' }, label: 'Hiring' },
  { view: { kind: 'curriculum' }, label: 'Curriculum' },
  { view: { kind: 'decisions' }, label: 'Decisions' },
  { view: { kind: 'mentor' }, label: 'Mentor reviews' },
  { view: { kind: 'settings' }, label: 'Settings' },
]

const ChannelLink = ({ channel, state, ui, prefix }: { channel: Channel; state: State; ui: Ui; prefix: string }) => {
  const active = ui.view.kind === 'channel' && ui.view.id === channel.id
  const unread = active ? 0 : unreadCount(channel.id, state.messages, state.lastRead)
  return (
    <button
      className={`side-link ${active ? 'active' : ''} ${unread ? 'unread' : ''}`}
      onClick={() => setView({ kind: 'channel', id: channel.id })}
    >
      <span className="side-prefix">{prefix}</span>
      <span className="side-name">{channel.name}</span>
      {unread ? <span className="badge">{unread}</span> : null}
    </button>
  )
}

const Sidebar = ({ state, ui }: { state: State; ui: Ui }) => {
  const [dmFilter, setDmFilter] = useState('')
  const status = (channel: Channel) => state.people.find((p) => p.id === channel.personId)?.status
  const channels = state.channels.filter((c) => c.kind === 'channel')
  const mentor = state.channels.filter((c) => c.kind === 'mentor')
  const interviews = state.channels.filter((c) => c.kind === 'interview' && status(c) === 'candidate')
  const dms = state.channels
    .filter((c) => c.kind === 'dm' && status(c) === 'active')
    .filter((c) => c.name.toLowerCase().includes(dmFilter.toLowerCase()))
  const lastTs = (c: Channel) => state.messages.findLast((m) => m.channelId === c.id)?.ts ?? 0
  const shownDms = [...dms].sort((a, b) => lastTs(b) - lastTs(a)).slice(0, 14)
  return (
    <aside className="sidebar">
      <div className="side-head">{state.company.name}</div>
      <nav className="side-scroll">
        <div className="side-group">
          {NAV.map((item) => (
            <button
              key={item.label}
              className={`side-link ${ui.view.kind === item.view.kind ? 'active' : ''}`}
              onClick={() => setView(item.view)}
            >
              <span className="side-name">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="side-title">Channels</div>
        {channels.map((c) => (
          <ChannelLink key={c.id} channel={c} state={state} ui={ui} prefix="#" />
        ))}
        <div className="side-title">Coach</div>
        {mentor.map((c) => (
          <ChannelLink key={c.id} channel={c} state={state} ui={ui} prefix="*" />
        ))}
        {interviews.length > 0 ? <div className="side-title">Interviews</div> : null}
        {interviews.map((c) => (
          <ChannelLink key={c.id} channel={c} state={state} ui={ui} prefix="?" />
        ))}
        <div className="side-title">Direct messages</div>
        {dms.length > 8 || dmFilter ? (
          <input
            className="side-filter"
            placeholder="Find a person"
            value={dmFilter}
            onChange={(e) => setDmFilter(e.target.value)}
          />
        ) : null}
        {shownDms.map((c) => (
          <ChannelLink key={c.id} channel={c} state={state} ui={ui} prefix="@" />
        ))}
        {dms.length > shownDms.length ? (
          <div className="side-more">{dms.length - shownDms.length} more in People</div>
        ) : null}
      </nav>
    </aside>
  )
}

const TopBar = ({ state, ui }: { state: State; ui: Ui }) => {
  const f = finance(state.company, state.people)
  const stage = stageForHeadcount(f.headcount)
  const now = useNow()
  const used = tokensToday(state, now)
  const budget = state.settings.dailyTokenBudget
  const pct = Math.min(100, Math.round((used / Math.max(budget, 1)) * 100))
  return (
    <header className="topbar">
      <div className="stats">
        <span className="stat">
          <b>Week {state.company.week}</b>
        </span>
        <span className="stat">
          {stage.name} stage, {f.headcount} people
        </span>
        <span className={`stat ${state.company.cash < 0 ? 'bad' : ''}`}>Cash {money(state.company.cash)}</span>
        <span className={`stat ${f.runwayMonths !== null && f.runwayMonths < 6 ? 'bad' : ''}`}>
          Runway {runwayLabel(f)}
        </span>
        <span
          className="stat tokens"
          title={`${used.toLocaleString()} of ${budget.toLocaleString()} tokens used today`}
        >
          Tokens today
          <span className="meter">
            <span className={pct >= 100 ? 'full' : ''} style={{ width: `${pct}%` }} />
          </span>
          {pct}%
        </span>
      </div>
      <div className="top-actions">
        {ui.busy ? <span className="busy">{ui.busy}…</span> : null}
        <select
          value={state.settings.activity}
          title="How much the bots talk"
          onChange={(e) => updateSettings((s) => ({ ...s, activity: e.target.value as Activity }))}
        >
          {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => (
            <option key={a} value={a}>
              {ACTIVITY_LABEL[a].split(':')[0]}
            </option>
          ))}
        </select>
        <button className="primary" disabled={ui.busy !== null} onClick={() => void runWeek()}>
          Run week
        </button>
      </div>
    </header>
  )
}

const Main = ({ state, ui }: { state: State; ui: Ui }) => {
  const view = ui.view
  if (view.kind === 'channel') return <ChannelView key={view.id} channelId={view.id} state={state} ui={ui} />
  if (view.kind === 'company') return <CompanyView state={state} />
  if (view.kind === 'people') return <PeopleView state={state} />
  if (view.kind === 'hiring') return <HiringView state={state} ui={ui} />
  if (view.kind === 'curriculum') return <CurriculumView state={state} />
  if (view.kind === 'decisions') return <DecisionsView state={state} />
  if (view.kind === 'mentor') return <MentorView state={state} ui={ui} />
  return <SettingsView state={state} ui={ui} />
}

export const App = () => {
  const { state, ui } = useStore()
  useEffect(() => {
    const timer = setInterval(() => {
      const snapshot = get()
      if (snapshot.ui.busy === null && autoAdvanceDue(snapshot.state, Date.now())) void runWeek()
    }, AUTO_CHECK_MS)
    return () => clearInterval(timer)
  }, [])
  if (!ui.loaded) return <div className="loading">Loading</div>
  if (!state.started) return <Onboarding />
  return (
    <div className="shell">
      <Sidebar state={state} ui={ui} />
      <div className="main">
        <TopBar state={state} ui={ui} />
        {!ui.serverUp ? (
          <div className="notice">The server is not reachable, so model calls will fail. Is it running?</div>
        ) : null}
        {ui.notice ? (
          <div className="notice">
            <span>{ui.notice}</span>
            <button className="ghost" onClick={dismissNotice}>
              Dismiss
            </button>
          </div>
        ) : null}
        <Main state={state} ui={ui} />
      </div>
    </div>
  )
}
