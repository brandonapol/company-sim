import { scenarioById } from '../domain/curriculum.ts'
import {
  activePeople,
  assignProvider,
  delegatedFillsThisWeek,
  homeChannel,
  nextScenario,
  overBudget,
  pickResponders,
  pickUnpromptedSpeakers,
  resolveProvider,
  scenarioChannel,
  scenarioRaiser,
  usableProviders,
} from '../domain/engine.ts'
import { advanceWeek, finance, runwayLabel } from '../domain/finance.ts'
import {
  mockCandidateReply,
  mockCandidates,
  mockMentor,
  mockReply,
  mockReview,
  mockUnprompted,
} from '../domain/mock.ts'
import type { CandidateDraft } from '../domain/mock.ts'
import { PERSONAS, defaultTitle, generatePerson } from '../domain/names.ts'
import {
  candidateSystem,
  candidatesPrompt,
  employeeSystem,
  mentorChatPrompt,
  mentorSystem,
  replyPrompt,
  reviewPrompt,
  unpromptedPrompt,
} from '../domain/prompts.ts'
import { cofounderPerson, deptChannel, dmChannel, emptyState } from '../domain/seed.ts'
import type { Cofounder } from '../domain/seed.ts'
import { CEO_ID, MENTOR_ID, SYSTEM_ID } from '../domain/types.ts'
import type {
  Channel,
  Company,
  Decision,
  Dept,
  Level,
  Message,
  MessageKind,
  Person,
  Provider,
  Req,
  ReqMode,
  Review,
  ScoreKey,
  Settings,
  State,
} from '../domain/types.ts'
import { dayKey, extractJson, fill, firstName, money, uid } from '../domain/util.ts'
import { getHealth, postChat, postModels } from '../lib/api.ts'
import type { ChatResponse, Effort, RealProvider } from '../shared/api.ts'
import { get, update, updateUi } from './store.ts'
import type { View } from './store.ts'

const rng = Math.random
const MESSAGES_KEPT_PER_CHANNEL = 300
const MAX_ACTIVE_SCENARIOS = 2
const SCORE_KEYS: ScoreKey[] = ['strategy', 'communication', 'delegation', 'people', 'finance', 'decisions']

class BudgetError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let queue: Promise<unknown> = Promise.resolve()

const enqueue = (job: () => Promise<void>) => {
  queue = queue.then(job).catch((err: unknown) => {
    console.error(err)
  })
  return queue
}

const notify = (notice: string | null) => updateUi((ui) => ({ ...ui, notice }))

const setBusy = (busy: string | null) => updateUi((ui) => ({ ...ui, busy }))

const setTyping = (channelId: string, name: string, on: boolean) =>
  updateUi((ui) => {
    const current = ui.typing[channelId] ?? []
    const next = on ? [...current, name] : current.filter((n) => n !== name)
    return { ...ui, typing: { ...ui.typing, [channelId]: next } }
  })

const newMessage = (
  state: State,
  channelId: string,
  authorId: string,
  text: string,
  kind: MessageKind = 'chat',
  scenarioId: string | null = null,
): Message => ({
  id: uid(),
  channelId,
  authorId,
  text,
  ts: Math.max(Date.now(), (state.messages[state.messages.length - 1]?.ts ?? 0) + 1),
  week: state.company.week,
  kind,
  scenarioId,
})

const say = (
  channelId: string,
  authorId: string,
  text: string,
  kind: MessageKind = 'chat',
  scenarioId: string | null = null,
) => update((s) => ({ ...s, messages: [...s.messages, newMessage(s, channelId, authorId, text, kind, scenarioId)] }))

const recordUsage = (provider: Provider, res: ChatResponse) =>
  update((s) => {
    const day = dayKey(Date.now())
    const cell = s.usage[day]?.[provider] ?? { input: 0, output: 0, calls: 0 }
    return {
      ...s,
      usage: {
        ...s.usage,
        [day]: {
          ...s.usage[day],
          [provider]: {
            input: cell.input + res.inputTokens,
            output: cell.output + res.outputTokens,
            calls: cell.calls + 1,
          },
        },
      },
    }
  })

type ModelCall = {
  wanted: Provider
  model?: string
  system: string
  prompt: string
  maxTokens: number
  effort: Effort
  mock: () => string
}

const callModel = async (call: ModelCall): Promise<string> => {
  const { state, ui } = get()
  const provider = resolveProvider(call.wanted, state.settings, ui.serverKeys)
  if (provider === 'mock') {
    await sleep(300)
    return call.mock()
  }
  if (overBudget(state, Date.now())) throw new BudgetError()
  const config = state.settings.providers[provider]
  const res = await postChat(
    {
      provider,
      model: call.model && provider === call.wanted ? call.model : config.model,
      system: call.system,
      prompt: call.prompt,
      maxTokens: call.maxTokens,
      effort: call.effort,
    },
    config.key,
  )
  recordUsage(provider, res)
  if (!res.text) throw new Error(`${provider} returned an empty reply. Try a larger reply length or a different model.`)
  return res.text
}

const reportError = (err: unknown) =>
  notify(
    err instanceof BudgetError
      ? 'Daily token budget reached. The bots are paused until tomorrow, or raise the budget in Settings.'
      : `Model call failed: ${err instanceof Error ? err.message : String(err)}`,
  )

const clean = (text: string, name: string) =>
  text
    .replace(new RegExp(`^\\s*\\**${firstName(name)}[^:\\n]{0,40}:\\**\\s*`, 'i'), '')
    .replace(/^"([\s\S]*)"$/, '$1')
    .trim()

const chatTokens = (settings: Settings) => Math.round(settings.replyWords * 2.2) + 80

const speak = async (personId: string, channelId: string, mode: 'reply' | 'unprompted'): Promise<boolean> => {
  const { state } = get()
  const person = state.people.find((p) => p.id === personId)
  const channel = state.channels.find((c) => c.id === channelId)
  if (!person || !channel) return true
  setTyping(channelId, person.name, true)
  try {
    const candidate = person.status === 'candidate'
    const text = await callModel({
      wanted: person.provider,
      system: candidate
        ? candidateSystem(
            state,
            person,
            state.reqs.find((r) => r.id === person.reqId),
          )
        : employeeSystem(state, person),
      prompt: mode === 'reply' ? replyPrompt(state, channel, person) : unpromptedPrompt(state, channel, person),
      maxTokens: chatTokens(state.settings) + (candidate ? 90 : 0),
      effort: 'low',
      mock: () => (candidate ? mockCandidateReply(rng) : mode === 'reply' ? mockReply(rng) : mockUnprompted(rng)),
    })
    say(channelId, person.id, clean(text, person.name))
    return true
  } catch (err) {
    reportError(err)
    return false
  } finally {
    setTyping(channelId, person.name, false)
  }
}

const mentorReply = async (channel: Channel) => {
  const { state } = get()
  setTyping(channel.id, 'Mentor', true)
  try {
    const text = await callModel({
      wanted: state.settings.mentor.provider,
      model: state.settings.mentor.model,
      system: mentorSystem(state),
      prompt: mentorChatPrompt(state, channel),
      maxTokens: 700,
      effort: 'medium',
      mock: mockMentor,
    })
    say(channel.id, MENTOR_ID, clean(text, 'Mentor'))
  } catch (err) {
    reportError(err)
  } finally {
    setTyping(channel.id, 'Mentor', false)
  }
}

const speakInTurn = async (personIds: string[], channelId: string, mode: 'reply' | 'unprompted'): Promise<void> => {
  const [head, ...rest] = personIds
  if (!head) return
  const ok = await speak(head, channelId, mode)
  if (ok) await speakInTurn(rest, channelId, mode)
}

const respond = async (channelId: string, text: string) => {
  const { state } = get()
  const channel = state.channels.find((c) => c.id === channelId)
  if (!channel) return
  if (channel.kind === 'mentor') return mentorReply(channel)
  const responders = pickResponders({
    channel,
    text,
    people: state.people,
    recentAuthorIds: state.messages
      .filter((m) => m.channelId === channelId)
      .slice(-6)
      .map((m) => m.authorId),
    activity: state.settings.activity,
    rng,
  })
  await speakInTurn(
    responders.map((p) => p.id),
    channelId,
    'reply',
  )
}

export const markRead = (channelId: string) =>
  update((s) => ({ ...s, lastRead: { ...s.lastRead, [channelId]: Date.now() } }))

export const setView = (view: View) => {
  updateUi((ui) => ({ ...ui, view }))
  if (view.kind === 'channel') markRead(view.id)
}

export const dismissNotice = () => notify(null)

export const postMessage = (channelId: string, text: string) => {
  const trimmed = text.trim()
  if (!trimmed) return
  say(channelId, CEO_ID, trimmed)
  markRead(channelId)
  void enqueue(() => respond(channelId, trimmed))
}

const ensureDeptChannel = (dept: Dept) =>
  update((s) =>
    dept === 'exec' || s.channels.some((c) => c.kind === 'channel' && c.dept === dept)
      ? s
      : { ...s, channels: [...s.channels, deptChannel(dept)] },
  )

const kickoffScenario = (scenarioId: string) => {
  const { state } = get()
  const scenario = scenarioById(scenarioId)
  if (!scenario || state.scenarios.some((r) => r.id === scenarioId)) return
  const raiser = scenarioRaiser(scenario, state.people)
  const channel = scenarioChannel(scenario, raiser, state.channels)
  const text = fill(scenario.kickoff, { product: state.company.product, company: state.company.name })
  update((s) => ({
    ...s,
    scenarios: [
      ...s.scenarios,
      { id: scenario.id, status: 'active', startedWeek: s.company.week, decidedWeek: null, channelId: channel.id },
    ],
  }))
  say(channel.id, raiser?.id ?? SYSTEM_ID, text, 'scenario', scenario.id)
}

export const startScenario = (scenarioId: string) => {
  kickoffScenario(scenarioId)
  const run = get().state.scenarios.find((r) => r.id === scenarioId)
  if (run) setView({ kind: 'channel', id: run.channelId })
}

export type StartForm = {
  ceoName: string
  companyName: string
  product: string
  pitch: string
  cash: number
  mrr: number
  cofounder: Cofounder | null
}

export const startCompany = (form: StartForm) => {
  const { ui } = get()
  update((s) => {
    const cofounder = form.cofounder ? cofounderPerson(form.cofounder) : null
    const people = cofounder ? [{ ...cofounder, provider: assignProvider([], s.settings, ui.serverKeys) }] : []
    return {
      ...s,
      started: true,
      company: {
        ...s.company,
        name: form.companyName,
        product: form.product,
        pitch: form.pitch,
        ceoName: form.ceoName,
        cash: form.cash,
        mrr: form.mrr,
      },
      people,
      channels: cofounder ? [...s.channels, dmChannel(cofounder, 'dm')] : s.channels,
      lastAutoTick: Date.now(),
      lastReviewTs: 0,
    }
  })
  say(
    'general',
    SYSTEM_ID,
    `Welcome to ${form.companyName}. Nothing here happens on its own: employees reply when you post, and time only moves when you press "Run week". Start in #leadership, where the first situation is waiting. Open roles in Hiring, and ask the Mentor for a review whenever you want feedback.`,
    'system',
  )
  const first = nextScenario([], get().state.people, form.product)
  if (first) kickoffScenario(first.id)
  setView({ kind: 'channel', id: 'leadership' })
}

const fillDelegatedReqs = () => {
  const { state, ui } = get()
  state.reqs
    .filter((r) => r.status === 'open' && r.mode === 'delegated')
    .forEach((req) => {
      const n = delegatedFillsThisWeek(req.openedWeek, get().state.company.week, req.count - req.filled)
      if (n === 0) return
      const current = get().state
      const taken = new Set(current.people.map((p) => p.name))
      const hires = Array.from({ length: n }).reduce<Person[]>((acc) => {
        const person = generatePerson(
          {
            title: req.title,
            dept: req.dept,
            level: req.level,
            salary: req.salary,
            managerId: req.managerId,
            provider: assignProvider([...current.people, ...acc], current.settings, ui.serverKeys),
            week: current.company.week,
            reqId: req.id,
          },
          taken,
          rng,
        )
        taken.add(person.name)
        return [...acc, person]
      }, [])
      const manager = current.people.find((p) => p.id === req.managerId)
      update((s) => ({
        ...s,
        people: [...s.people, ...hires],
        channels: [...s.channels, ...hires.map((h) => dmChannel(h, 'dm'))],
        reqs: s.reqs.map((r) =>
          r.id === req.id ? { ...r, filled: r.filled + n, status: r.filled + n >= r.count ? 'filled' : 'open' } : r,
        ),
      }))
      ensureDeptChannel(req.dept)
      say(
        'hiring',
        SYSTEM_ID,
        `${manager?.name ?? 'A manager'} hired ${hires.map((h) => h.name).join(', ')} as ${req.title} (${req.filled + n}/${req.count} filled). You delegated this one, so you did not meet them first.`,
        'system',
      )
    })
}

const weeklyDigest = (before: Company) => {
  const { state } = get()
  const f = finance(state.company, state.people)
  const prev = finance(before, state.people)
  say(
    'leadership',
    SYSTEM_ID,
    `Week ${state.company.week}: headcount ${f.headcount}, cash ${money(state.company.cash)}, revenue ${money(state.company.mrr)}/mo (growing ${f.growthPct.toFixed(1)}%/mo), burn ${money(f.burn)}/mo, runway ${runwayLabel(f)}.`,
    'system',
  )
  const crossed = (limit: number) =>
    f.runwayMonths !== null && f.runwayMonths < limit && (prev.runwayMonths === null || prev.runwayMonths >= limit)
  if (state.company.cash < 0 && before.cash >= 0) {
    say(
      'leadership',
      SYSTEM_ID,
      'The company is out of cash. In real life this is where payroll bounces. Cut burn, raise money (edit cash in Company to simulate a round), or reset.',
      'system',
    )
  } else if (crossed(3)) {
    say(
      'leadership',
      SYSTEM_ID,
      'Runway is under 3 months. A fundraise started today would probably not close in time.',
      'system',
    )
  } else if (crossed(6)) {
    say(
      'leadership',
      SYSTEM_ID,
      'Runway is under 6 months. Fundraising usually takes that long, so this is the latest sensible moment to act.',
      'system',
    )
  }
}

const pruneMessages = () =>
  update((s) => {
    const counts = s.messages.reduce<Record<string, number>>(
      (acc, m) => ({ ...acc, [m.channelId]: (acc[m.channelId] ?? 0) + 1 }),
      {},
    )
    const seen: Record<string, number> = {}
    const messages = s.messages.filter((m) => {
      seen[m.channelId] = (seen[m.channelId] ?? 0) + 1
      return (counts[m.channelId] ?? 0) - (seen[m.channelId] ?? 0) < MESSAGES_KEPT_PER_CHANNEL
    })
    return messages.length === s.messages.length ? s : { ...s, messages }
  })

const runReview = async () => {
  const { state } = get()
  setTyping('mentor', 'Mentor', true)
  try {
    const raw = await callModel({
      wanted: state.settings.mentor.provider,
      model: state.settings.mentor.model,
      system: mentorSystem(state),
      prompt: reviewPrompt(state),
      maxTokens: 1800,
      effort: 'medium',
      mock: () => JSON.stringify(mockReview(state)),
    })
    const parsed = extractJson<Partial<Review> & { scores?: Record<string, unknown> }>(raw)
    if (!parsed || typeof parsed.headline !== 'string') {
      notify('The mentor replied in a format I could not read. Try again, or pick a stronger mentor model in Settings.')
      return
    }
    const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : [])
    const review: Review = {
      id: uid(),
      week: state.company.week,
      ts: Date.now(),
      headline: parsed.headline,
      scores: Object.fromEntries(
        SCORE_KEYS.flatMap((key) => {
          const value = Number(parsed.scores?.[key])
          return parsed.scores?.[key] != null && value >= 1 && value <= 5 ? [[key, Math.round(value)]] : []
        }),
      ),
      wentWell: list(parsed.wentWell),
      blindSpots: list(parsed.blindSpots),
      missedQuestions: list(parsed.missedQuestions),
      practice: String(parsed.practice ?? ''),
      concept: String(parsed.concept ?? ''),
    }
    update((s) => ({ ...s, reviews: [...s.reviews, review], lastReviewTs: review.ts }))
    say(
      'mentor',
      MENTOR_ID,
      `Week ${review.week} review: ${review.headline}${review.practice ? `\n\nPractice for next week: ${review.practice}` : ''}\n\nThe full write-up is in the Mentor tab.`,
    )
  } catch (err) {
    reportError(err)
  } finally {
    setTyping('mentor', 'Mentor', false)
  }
}

export const requestReview = () =>
  enqueue(async () => {
    setBusy('Mentor is reviewing')
    await runReview()
    setBusy(null)
  })

export const runWeek = () =>
  enqueue(async () => {
    setBusy('Running the week')
    try {
      const before = get().state.company
      update((s) => ({ ...s, company: advanceWeek(s.company, s.people), lastAutoTick: Date.now() }))
      fillDelegatedReqs()
      weeklyDigest(before)
      const { state } = get()
      if (state.scenarios.filter((r) => r.status === 'active').length < MAX_ACTIVE_SCENARIOS) {
        const scenario = nextScenario(state.scenarios, state.people, state.company.product)
        if (scenario) kickoffScenario(scenario.id)
      }
      const speakers = pickUnpromptedSpeakers(state.people, state.settings.activity, rng)
      await speakers.reduce<Promise<boolean>>(
        async (prev, person) =>
          (await prev) ? speak(person.id, homeChannel(person, get().state.channels).id, 'unprompted') : false,
        Promise.resolve(true),
      )
      if (get().state.settings.autoReview) await runReview()
      pruneMessages()
    } finally {
      setBusy(null)
    }
  })

export type ReqForm = {
  title: string
  dept: Dept
  level: Level
  salary: number
  managerId: string | null
  mode: ReqMode
  count: number
  notes: string
}

const draftToCandidate = (draft: CandidateDraft, req: Req, week: number): Person => ({
  id: uid(),
  name: String(draft.name),
  title: req.title,
  dept: req.dept,
  level: req.level,
  managerId: req.managerId,
  salary: Number(draft.salaryAsk) > 0 ? Math.round(Number(draft.salaryAsk)) : req.salary,
  provider: 'mock',
  persona: String(draft.persona ?? PERSONAS[0]),
  quirk: String(draft.hiddenWeakness ?? ''),
  background: String(draft.background ?? ''),
  strengths: Array.isArray(draft.strengths) ? draft.strengths.map(String) : [],
  concerns: Array.isArray(draft.concerns) ? draft.concerns.map(String) : [],
  status: 'candidate',
  hiredWeek: week,
  reqId: req.id,
})

const sourceCandidates = async (reqId: string) => {
  const { state, ui } = get()
  const req = state.reqs.find((r) => r.id === reqId)
  if (!req) return
  setBusy('Sourcing candidates')
  try {
    const fallback = () => mockCandidates(req, state.people, rng)
    const raw = await callModel({
      wanted: usableProviders(state.settings, ui.serverKeys)[0] ?? 'mock',
      system: 'You design realistic hiring exercises for a management simulation. Reply with JSON only.',
      prompt: candidatesPrompt(state, req),
      maxTokens: 1400,
      effort: 'low',
      mock: () => JSON.stringify(fallback()),
    })
    const parsed = extractJson<CandidateDraft[]>(raw)
    const drafts =
      Array.isArray(parsed) && parsed.length > 0 && parsed.every((d) => d && d.name) ? parsed.slice(0, 4) : fallback()
    const current = get().state
    const candidates = drafts.map((d) => ({
      ...draftToCandidate(d, req, current.company.week),
      provider: assignProvider(current.people, current.settings, ui.serverKeys),
    }))
    update((s) => ({
      ...s,
      people: [...s.people, ...candidates],
      channels: [...s.channels, ...candidates.map((c) => dmChannel(c, 'interview'))],
    }))
    say(
      'hiring',
      SYSTEM_ID,
      `Three candidates are ready for ${req.title}: ${candidates.map((c) => c.name).join(', ')}. Interview them from the Hiring tab before you decide.`,
      'system',
    )
  } catch (err) {
    reportError(err)
  } finally {
    setBusy(null)
  }
}

export const openReq = (form: ReqForm) => {
  const { state } = get()
  const req: Req = {
    id: uid(),
    title: form.title.trim() || defaultTitle(form.dept),
    dept: form.dept,
    level: form.level,
    salary: form.salary,
    managerId: form.managerId,
    mode: form.mode,
    count: form.mode === 'delegated' ? Math.max(1, Math.min(form.count, 50)) : 1,
    filled: 0,
    status: 'open',
    openedWeek: state.company.week,
    notes: form.notes.trim(),
  }
  update((s) => ({ ...s, reqs: [...s.reqs, req] }))
  const manager = state.people.find((p) => p.id === req.managerId)
  say(
    'hiring',
    SYSTEM_ID,
    req.mode === 'delegated'
      ? `Opened ${req.count} x ${req.title}, delegated to ${manager?.name ?? 'the hiring manager'}. Expect hires from week ${req.openedWeek + 2}, up to three a week.`
      : `Opened a role: ${req.title}. Sourcing candidates for you to interview.`,
    'system',
  )
  if (req.mode === 'direct') void enqueue(() => sourceCandidates(req.id))
}

export const moreCandidates = (reqId: string) => enqueue(() => sourceCandidates(reqId))

export const closeReq = (reqId: string) =>
  update((s) => ({
    ...s,
    reqs: s.reqs.map((r) => (r.id === reqId ? { ...r, status: 'closed' } : r)),
    people: s.people.map((p) => (p.reqId === reqId && p.status === 'candidate' ? { ...p, status: 'rejected' } : p)),
  }))

export const rejectCandidate = (personId: string) =>
  update((s) => ({ ...s, people: s.people.map((p) => (p.id === personId ? { ...p, status: 'rejected' } : p)) }))

export const hire = (personId: string) => {
  const { state } = get()
  const person = state.people.find((p) => p.id === personId)
  if (!person || person.status !== 'candidate') return
  const manager = state.people.find((p) => p.id === person.managerId)
  update((s) => ({
    ...s,
    people: s.people.map((p) =>
      p.id === personId
        ? { ...p, status: 'active', hiredWeek: s.company.week }
        : p.reqId === person.reqId && p.status === 'candidate'
          ? { ...p, status: 'rejected' }
          : p,
    ),
    channels: s.channels.map((c) => (c.personId === personId ? { ...c, kind: 'dm', topic: person.title } : c)),
    reqs: s.reqs.map((r) => (r.id === person.reqId ? { ...r, filled: r.filled + 1, status: 'filled' } : r)),
  }))
  ensureDeptChannel(person.dept)
  say(
    'hiring',
    SYSTEM_ID,
    `${person.name} accepted and joins as ${person.title} at ${money(person.salary)}, reporting to ${manager?.name ?? 'you'}.`,
    'system',
  )
}

export const letGo = (personId: string, note: string) => {
  const { state } = get()
  const person = state.people.find((p) => p.id === personId)
  if (!person || person.status !== 'active') return
  update((s) => ({
    ...s,
    people: s.people.map((p) =>
      p.id === personId
        ? { ...p, status: 'departed' }
        : p.managerId === personId
          ? { ...p, managerId: person.managerId }
          : p,
    ),
    reqs: s.reqs.map((r) => (r.managerId === personId ? { ...r, managerId: person.managerId } : r)),
  }))
  const text = note.trim()
  if (text) {
    say('general', CEO_ID, text)
    void enqueue(() => respond('general', text))
  } else {
    say(
      'general',
      SYSTEM_ID,
      `${person.name} (${person.title}) has left the company. The CEO made no announcement.`,
      'system',
    )
  }
}

export type DecisionForm = {
  title: string
  decision: string
  rationale: string
  scenarioId: string | null
  channelId: string
}

export const recordDecision = (form: DecisionForm) => {
  const { state } = get()
  const decision: Decision = {
    id: uid(),
    week: state.company.week,
    ts: Date.now(),
    title: form.title.trim(),
    decision: form.decision.trim(),
    rationale: form.rationale.trim(),
    scenarioId: form.scenarioId,
    channelId: form.channelId,
  }
  update((s) => ({
    ...s,
    decisions: [...s.decisions, decision],
    scenarios: s.scenarios.map((r) =>
      r.id === form.scenarioId ? { ...r, status: 'decided', decidedWeek: s.company.week } : r,
    ),
  }))
  const text = `Decision: ${decision.title}\n${decision.decision}${decision.rationale ? `\nWhy: ${decision.rationale}` : ''}`
  say(form.channelId, CEO_ID, text, 'decision', form.scenarioId)
  markRead(form.channelId)
  void enqueue(() => respond(form.channelId, text))
}

export const updateSettings = (fn: (settings: Settings) => Settings) =>
  update((s) => ({ ...s, settings: fn(s.settings) }))

export const updateCompany = (patch: Partial<Company>) => update((s) => ({ ...s, company: { ...s.company, ...patch } }))

export const updatePerson = (personId: string, patch: Partial<Person>) =>
  update((s) => ({ ...s, people: s.people.map((p) => (p.id === personId ? { ...p, ...patch } : p)) }))

export const openDm = (personId: string) => {
  const channel = get().state.channels.find((c) => c.personId === personId)
  if (channel) setView({ kind: 'channel', id: channel.id })
}

export const fetchModels = (provider: RealProvider) =>
  postModels(provider, get().state.settings.providers[provider].key)

export const testProvider = async (provider: RealProvider): Promise<string> => {
  const config = get().state.settings.providers[provider]
  try {
    const res = await postChat(
      {
        provider,
        model: config.model,
        system: 'Reply with one short sentence.',
        prompt: 'Say hello.',
        maxTokens: 60,
        effort: 'low',
      },
      config.key,
    )
    recordUsage(provider, res)
    return `Works: "${res.text.slice(0, 80)}"`
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

export const refreshHealth = async () => {
  const health = await getHealth()
  updateUi((ui) => ({
    ...ui,
    serverUp: health !== null,
    serverKeys: health?.serverKeys ?? ui.serverKeys,
    serverVersion: health?.version ?? ui.serverVersion,
  }))
}

export const exportState = (): string => {
  const { state } = get()
  const providers = Object.fromEntries(
    Object.entries(state.settings.providers).map(([name, config]) => [name, { ...config, key: '' }]),
  )
  return JSON.stringify({ ...state, settings: { ...state.settings, providers } }, null, 2)
}

export const importState = (json: string): boolean => {
  const parsed = extractJson<State>(json)
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.people) || !Array.isArray(parsed.messages)) return false
  const keys = get().state.settings.providers
  update(() => ({
    ...emptyState(),
    ...parsed,
    settings: {
      ...parsed.settings,
      providers: {
        anthropic: { ...parsed.settings.providers.anthropic, key: keys.anthropic.key },
        openai: { ...parsed.settings.providers.openai, key: keys.openai.key },
        xai: { ...parsed.settings.providers.xai, key: keys.xai.key },
      },
    },
  }))
  return true
}

export const resetAll = () => {
  const settings = get().state.settings
  update(() => ({ ...emptyState(), settings }))
  setView({ kind: 'channel', id: 'leadership' })
}

export const reportsOf = (state: State, personId: string | null) =>
  activePeople(state.people).filter((p) => p.managerId === personId)
