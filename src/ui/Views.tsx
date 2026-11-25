import { useState } from 'react'
import { STAGES, scenariosFor, stageForHeadcount } from '../domain/curriculum.ts'
import { activePeople, headcount } from '../domain/engine.ts'
import { finance, runwayLabel } from '../domain/finance.ts'
import { defaultTitle } from '../domain/names.ts'
import { DEPTS, DEPT_LABEL, LEVELS, LEVEL_LABEL, LEVEL_RANK } from '../domain/types.ts'
import type { Dept, Level, Person, Provider, ReqMode, ScoreKey, State } from '../domain/types.ts'
import { money } from '../domain/util.ts'
import {
  closeReq,
  hire,
  letGo,
  moreCandidates,
  openDm,
  openReq,
  rejectCandidate,
  requestReview,
  setView,
  startScenario,
  updateCompany,
  updatePerson,
} from '../state/actions.ts'
import type { Ui } from '../state/store.ts'
import { Avatar, Field, Modal, NumberInput } from './bits.tsx'

const Metric = ({ label, value, bad }: { label: string; value: string; bad?: boolean }) => (
  <div className={`metric ${bad ? 'bad' : ''}`}>
    <div className="metric-value">{value}</div>
    <div className="metric-label">{label}</div>
  </div>
)

export const CompanyView = ({ state }: { state: State }) => {
  const { company } = state
  const f = finance(company, state.people)
  const stage = stageForHeadcount(f.headcount)
  const staff = activePeople(state.people)
  const byDept = DEPTS.map((dept) => ({ dept, n: staff.filter((p) => p.dept === dept).length })).filter((d) => d.n > 0)
  return (
    <div className="page">
      <h2>
        {company.name} <span className="muted">week {company.week}</span>
      </h2>
      <div className="card">
        <b>
          Stage {stage.index + 1} of {STAGES.length}: {stage.name} ({stage.min}-{stage.max} people)
        </b>
        <p>{stage.theme}</p>
        <p className="muted">Your job at this size: {stage.ceoJob}</p>
      </div>
      <div className="metrics">
        <Metric label="Headcount (incl. you)" value={String(f.headcount)} />
        <Metric label="Cash" value={money(company.cash)} bad={company.cash < 0} />
        <Metric label="Monthly revenue" value={money(company.mrr)} />
        <Metric label="Revenue growth / month" value={`${f.growthPct.toFixed(1)}%`} />
        <Metric label="Payroll / month" value={money(f.payroll)} />
        <Metric label="Total burn / month" value={money(f.burn)} />
        <Metric label="Net burn / month" value={money(f.netBurn)} />
        <Metric label="Runway" value={runwayLabel(f)} bad={f.runwayMonths !== null && f.runwayMonths < 6} />
      </div>
      <div className="card">
        <h3>Team by function</h3>
        {byDept.length === 0 ? <p className="muted">Just you so far.</p> : null}
        {byDept.map(({ dept, n }) => (
          <div key={dept} className="bar-row">
            <span>{DEPT_LABEL[dept]}</span>
            <span className="bar">
              <span style={{ width: `${(n / staff.length) * 100}%` }} />
            </span>
            <span>{n}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>The numbers behind the sim</h3>
        <p className="muted">
          This is a deliberately simple model so that hiring has a visible cost: payroll is salaries plus 25% load, cash
          moves by net burn each week, and monthly revenue grows at the base rate plus a diminishing boost from
          go-to-market and product headcount. Edit anything here to simulate a fundraise, a price change or a bad
          quarter.
        </p>
        <div className="grid2">
          <Field label="Cash ($)">
            <NumberInput
              value={Math.round(company.cash)}
              min={-100_000_000}
              step={50_000}
              onChange={(v) => updateCompany({ cash: v })}
            />
          </Field>
          <Field label="Monthly revenue ($)">
            <NumberInput value={Math.round(company.mrr)} step={1_000} onChange={(v) => updateCompany({ mrr: v })} />
          </Field>
          <Field label="Base revenue growth (% per month)">
            <NumberInput
              value={company.baseGrowthPct}
              min={-50}
              step={0.5}
              onChange={(v) => updateCompany({ baseGrowthPct: v })}
            />
          </Field>
          <Field label="Non-payroll costs ($ per month)">
            <NumberInput value={company.otherBurn} step={1_000} onChange={(v) => updateCompany({ otherBurn: v })} />
          </Field>
        </div>
        <Field label="Company description (every employee reads this)">
          <textarea rows={4} value={company.pitch} onChange={(e) => updateCompany({ pitch: e.target.value })} />
        </Field>
      </div>
    </div>
  )
}

const PROVIDERS: Provider[] = ['anthropic', 'openai', 'xai', 'mock']

const PersonModal = ({ person, state, onClose }: { person: Person; state: State; onClose: () => void }) => {
  const [note, setNote] = useState('')
  const [leaving, setLeaving] = useState(false)
  const managers = activePeople(state.people).filter((p) => p.id !== person.id)
  const reports = activePeople(state.people).filter((p) => p.managerId === person.id)
  return (
    <Modal title={person.name} onClose={onClose}>
      <p>
        {person.title} · {DEPT_LABEL[person.dept]} · joined week {person.hiredWeek}
        {reports.length ? ` · ${reports.length} direct reports` : ''}
      </p>
      <p className="muted">{person.persona}</p>
      {person.background ? <p className="muted">{person.background}</p> : null}
      <div className="grid2">
        <Field label="Title">
          <input value={person.title} onChange={(e) => updatePerson(person.id, { title: e.target.value })} />
        </Field>
        <Field label="Level">
          <select value={person.level} onChange={(e) => updatePerson(person.id, { level: e.target.value as Level })}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reports to">
          <select
            value={person.managerId ?? ''}
            onChange={(e) => updatePerson(person.id, { managerId: e.target.value || null })}
          >
            <option value="">You (CEO)</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}, {m.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Salary ($ per year)">
          <NumberInput value={person.salary} step={5_000} onChange={(v) => updatePerson(person.id, { salary: v })} />
        </Field>
        <Field label="Runs on">
          <select
            value={person.provider}
            onChange={(e) => updatePerson(person.id, { provider: e.target.value as Provider })}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {leaving ? (
        <>
          <Field
            label="Your announcement to the company"
            hint="Posted in #general in your name; the team will react. Leave blank to say nothing, which is also a choice the mentor will see."
          >
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="row end">
            <button onClick={() => setLeaving(false)}>Cancel</button>
            <button
              className="danger"
              onClick={() => {
                letGo(person.id, note)
                onClose()
              }}
            >
              Confirm: let {person.name.split(' ')[0]} go
            </button>
          </div>
        </>
      ) : (
        <div className="row end">
          <button className="danger" onClick={() => setLeaving(true)}>
            Let go
          </button>
          <button
            className="primary"
            onClick={() => {
              openDm(person.id)
              onClose()
            }}
          >
            Message
          </button>
        </div>
      )}
    </Modal>
  )
}

export const PeopleView = ({ state }: { state: State }) => {
  const [selected, setSelected] = useState<string | null>(null)
  const staff = activePeople(state.people)
  const person = staff.find((p) => p.id === selected)
  const directs = staff.filter((p) => p.managerId === null).length
  const name = (id: string | null) => (id ? (staff.find((p) => p.id === id)?.name ?? 'You') : 'You')
  return (
    <div className="page">
      <h2>
        People <span className="muted">{staff.length + 1} including you</span>
      </h2>
      <p className={directs > 8 ? 'warn' : 'muted'}>
        You have {directs} direct reports.
        {directs > 8 ? ' Most people manage 5 to 8 well. Time to think about org design.' : ''}
      </p>
      {DEPTS.map((dept) => {
        const members = staff.filter((p) => p.dept === dept).sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level])
        if (members.length === 0) return null
        return (
          <div className="card" key={dept}>
            <h3>
              {DEPT_LABEL[dept]} <span className="muted">{members.length}</span>
            </h3>
            <table>
              <tbody>
                {members.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => setSelected(p.id)}>
                    <td>
                      <span className="row">
                        <Avatar id={p.id} name={p.name} size={26} /> {p.name}
                      </span>
                    </td>
                    <td>{p.title}</td>
                    <td>{LEVEL_LABEL[p.level]}</td>
                    <td className="muted">reports to {name(p.managerId)}</td>
                    <td>{money(p.salary)}</td>
                    <td className="muted">{p.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
      {staff.length === 0 ? <p className="muted">Nobody yet. Open a role in Hiring.</p> : null}
      {person ? <PersonModal person={person} state={state} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}

const SALARY_GUIDE: Record<Level, number> = {
  ic: 95_000,
  senior: 135_000,
  lead: 155_000,
  manager: 165_000,
  director: 195_000,
  vp: 240_000,
  cxo: 280_000,
}

const ReqFormCard = ({ state }: { state: State }) => {
  const [dept, setDept] = useState<Dept>('marketing')
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState<Level>('ic')
  const [salary, setSalary] = useState(SALARY_GUIDE.ic)
  const [managerId, setManagerId] = useState('')
  const [mode, setMode] = useState<ReqMode>('direct')
  const [count, setCount] = useState(1)
  const [notes, setNotes] = useState('')
  const staff = activePeople(state.people)
  const f = finance(state.company, state.people)
  const seats = mode === 'delegated' ? count : 1
  const added = ((salary * seats) / 12) * 1.25
  const after = f.netBurn + added > 0 ? Math.max(state.company.cash, 0) / (f.netBurn + added) : null
  const canDelegate = managerId !== ''
  return (
    <div className="card">
      <h3>Open a role</h3>
      <div className="grid3">
        <Field label="Function">
          <select value={dept} onChange={(e) => setDept(e.target.value as Dept)}>
            {DEPTS.map((d) => (
              <option key={d} value={d}>
                {DEPT_LABEL[d]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input value={title} placeholder={defaultTitle(dept)} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Level">
          <select
            value={level}
            onChange={(e) => {
              const next = e.target.value as Level
              setLevel(next)
              setSalary(SALARY_GUIDE[next])
            }}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Salary budget ($ per year)">
          <NumberInput value={salary} step={5_000} onChange={setSalary} />
        </Field>
        <Field label="Reports to">
          <select
            value={managerId}
            onChange={(e) => {
              setManagerId(e.target.value)
              if (!e.target.value) setMode('direct')
            }}
          >
            <option value="">You (CEO)</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}, {p.title}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Who runs the search"
          hint={
            canDelegate
              ? 'Delegated roles fill on their own in about two weeks; you do not meet the hires.'
              : 'Pick a manager other than yourself to delegate.'
          }
        >
          <select value={mode} onChange={(e) => setMode(e.target.value as ReqMode)}>
            <option value="direct">I interview candidates myself</option>
            <option value="delegated" disabled={!canDelegate}>
              Delegate to the hiring manager
            </option>
          </select>
        </Field>
        {mode === 'delegated' ? (
          <Field label="How many">
            <NumberInput value={count} min={1} onChange={(v) => setCount(Math.min(v, 50))} />
          </Field>
        ) : null}
      </div>
      <Field
        label="What is this hire for?"
        hint="Outcomes in the first 90 days, what they will own, what you will stop doing. Candidates are generated from this, and the mentor reads it."
      >
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="row between">
        <span className="muted">
          Adds about {money(added)}/mo of burn. Runway goes from {runwayLabel(f)} to{' '}
          {after === null ? 'still profitable' : `${after.toFixed(1)} mo`}.
        </span>
        <button
          className="primary"
          onClick={() => {
            openReq({ title, dept, level, salary, managerId: managerId || null, mode, count, notes })
            setTitle('')
            setNotes('')
          }}
        >
          Open role
        </button>
      </div>
    </div>
  )
}

export const HiringView = ({ state, ui }: { state: State; ui: Ui }) => {
  const reqs = [...state.reqs].reverse()
  return (
    <div className="page">
      <h2>Hiring</h2>
      <ReqFormCard state={state} />
      {reqs.map((req) => {
        const candidates = state.people.filter((p) => p.reqId === req.id && p.status === 'candidate')
        const manager = state.people.find((p) => p.id === req.managerId)
        return (
          <div className="card" key={req.id}>
            <div className="row between">
              <h3>
                {req.title}{' '}
                <span className="muted">
                  {LEVEL_LABEL[req.level]} · {DEPT_LABEL[req.dept]} · {money(req.salary)} · reports to{' '}
                  {manager?.name ?? 'you'}
                </span>
              </h3>
              <span className={`tag ${req.status}`}>
                {req.status === 'open'
                  ? req.mode === 'delegated'
                    ? `${req.filled}/${req.count} filled`
                    : 'open'
                  : req.status}
              </span>
            </div>
            {req.notes ? <p className="muted">{req.notes}</p> : null}
            {req.mode === 'delegated' && req.status === 'open' ? (
              <p className="muted">
                Delegated to {manager?.name ?? 'the hiring manager'} in week {req.openedWeek}. Hires start arriving in
                week {req.openedWeek + 2}.
              </p>
            ) : null}
            {candidates.map((c) => (
              <div className="candidate" key={c.id}>
                <div>
                  <b>{c.name}</b> <span className="muted">asking {money(c.salary)}</span>
                  <div>{c.background}</div>
                  <div className="muted">
                    Strengths: {c.strengths.join('; ')}. Concerns: {c.concerns.join('; ')}.
                  </div>
                </div>
                <div className="row">
                  <button onClick={() => openDm(c.id)}>Interview</button>
                  <button className="primary" onClick={() => hire(c.id)}>
                    Offer
                  </button>
                  <button onClick={() => rejectCandidate(c.id)}>Pass</button>
                </div>
              </div>
            ))}
            {req.status === 'open' ? (
              <div className="row end">
                {req.mode === 'direct' ? (
                  <button disabled={ui.busy !== null} onClick={() => void moreCandidates(req.id)}>
                    {candidates.length ? 'Source more candidates' : 'Source candidates'}
                  </button>
                ) : null}
                <button onClick={() => closeReq(req.id)}>Close role</button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export const CurriculumView = ({ state }: { state: State }) => {
  const current = stageForHeadcount(headcount(state.people)).index
  const done = state.scenarios.filter((r) => r.status === 'decided').length
  const scenarios = scenariosFor(state.company.product)
  return (
    <div className="page">
      <h2>
        Curriculum{' '}
        <span className="muted">
          {done} of {scenarios.length} situations decided
        </span>
      </h2>
      <p className="muted">
        These are the decisions that tend to arrive at each company size. One new situation is raised by your team each
        week (at most two open at a time), starting with your current stage. You can also pull any of them forward.
      </p>
      {STAGES.map((stage) => (
        <div className={`card ${stage.index === current ? 'current' : ''}`} key={stage.index}>
          <h3>
            {stage.index + 1}. {stage.name}{' '}
            <span className="muted">
              {stage.min}-{stage.max} people · {stage.theme}
            </span>
            {stage.index === current ? <span className="tag open">you are here</span> : null}
          </h3>
          <p className="muted">{stage.ceoJob}</p>
          {scenarios
            .filter((s) => s.stage === stage.index)
            .map((s) => {
              const run = state.scenarios.find((r) => r.id === s.id)
              return (
                <details key={s.id} className="lesson">
                  <summary>
                    <span className={`dot ${run?.status ?? 'todo'}`} />
                    <span className="tag">{s.topic}</span> {s.title}
                    <span className="muted">
                      {run?.status === 'decided' ? ` · decided week ${run.decidedWeek}` : run ? ' · open' : ''}
                    </span>
                  </summary>
                  <p>{s.primer}</p>
                  <p className="muted">Frameworks to look up: {s.frameworks.join(' · ')}</p>
                  <p className="muted">What good looks like: {s.rubric}</p>
                  {run ? (
                    <button onClick={() => setView({ kind: 'channel', id: run.channelId })}>
                      Go to the conversation
                    </button>
                  ) : (
                    <button onClick={() => startScenario(s.id)}>Have the team raise this now</button>
                  )}
                </details>
              )
            })}
        </div>
      ))}
    </div>
  )
}

export const DecisionsView = ({ state }: { state: State }) => (
  <div className="page">
    <h2>Decision log</h2>
    <p className="muted">
      Record decisions from any channel. Rereading your own reasoning a few weeks later is one of the cheapest ways to
      get better at this.
    </p>
    {state.decisions.length === 0 ? <p className="muted">No decisions recorded yet.</p> : null}
    {[...state.decisions].reverse().map((d) => (
      <div className="card" key={d.id}>
        <h3>
          {d.title} <span className="muted">week {d.week}</span>
        </h3>
        <p>{d.decision}</p>
        {d.rationale ? <p className="muted">Why: {d.rationale}</p> : null}
        <button onClick={() => setView({ kind: 'channel', id: d.channelId })}>See the discussion</button>
      </div>
    ))}
  </div>
)

const SCORE_LABEL: Record<ScoreKey, string> = {
  strategy: 'Strategy',
  communication: 'Communication',
  delegation: 'Delegation',
  people: 'People',
  finance: 'Finance',
  decisions: 'Decision quality',
}

const ListBlock = ({ title, items }: { title: string; items: string[] }) =>
  items.length === 0 ? null : (
    <>
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  )

export const MentorView = ({ state, ui }: { state: State; ui: Ui }) => {
  const reviews = [...state.reviews].reverse()
  const since = state.messages.filter((m) => m.ts > state.lastReviewTs && m.authorId === 'ceo').length
  return (
    <div className="page">
      <div className="row between">
        <h2>Mentor reviews</h2>
        <div className="row">
          <button onClick={() => setView({ kind: 'channel', id: 'mentor' })}>Talk to the mentor</button>
          <button className="primary" disabled={ui.busy !== null} onClick={() => void requestReview()}>
            Review my work
          </button>
        </div>
      </div>
      <p className="muted">
        The mentor reads every channel, DM, interview, decision and hiring brief since the last review, compares your
        decisions with what good looks like for each situation, and tells you what you missed. You have posted {since}{' '}
        messages since the last review.
      </p>
      {reviews.length === 0 ? (
        <p className="muted">No reviews yet. Work through a situation or two, then ask for one.</p>
      ) : null}
      {reviews.map((r) => (
        <div className="card" key={r.id}>
          <h3>
            Week {r.week} <span className="muted">{new Date(r.ts).toLocaleDateString()}</span>
          </h3>
          <p>{r.headline}</p>
          <div className="scores">
            {(Object.keys(SCORE_LABEL) as ScoreKey[]).map((key) => {
              const score = r.scores[key]
              return (
                <div key={key} className="score">
                  <span>{SCORE_LABEL[key]}</span>
                  <span className="bar">
                    <span style={{ width: `${((score ?? 0) / 5) * 100}%` }} />
                  </span>
                  <span>{score ?? 'n/a'}</span>
                </div>
              )
            })}
          </div>
          <ListBlock title="What went well" items={r.wentWell} />
          <ListBlock title="Blind spots" items={r.blindSpots} />
          <ListBlock title="Questions you did not ask" items={r.missedQuestions} />
          {r.practice ? (
            <>
              <h4>Practice for next week</h4>
              <p>{r.practice}</p>
            </>
          ) : null}
          {r.concept ? (
            <>
              <h4>Study next</h4>
              <p>{r.concept}</p>
            </>
          ) : null}
        </div>
      ))}
    </div>
  )
}
