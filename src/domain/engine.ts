import { scenariosFor, stageForHeadcount } from './curriculum.ts'
import type { Scenario } from './curriculum.ts'
import { LEVEL_RANK } from './types.ts'
import type { Activity, Channel, Message, Person, Provider, ScenarioRun, Settings, State } from './types.ts'
import { CEO_ID } from './types.ts'
import type { RealProvider } from '../shared/api.ts'
import { REAL_PROVIDERS } from '../shared/api.ts'
import { dayKey, firstName, sampleWeighted } from './util.ts'
import type { Rng } from './util.ts'

export const REPLIES_PER_POST: Record<Activity, number> = { silent: 0, quiet: 1, normal: 2, lively: 3 }

export const UNPROMPTED_PER_WEEK: Record<Activity, number> = { silent: 0, quiet: 1, normal: 3, lively: 6 }

export const ACTIVITY_LABEL: Record<Activity, string> = {
  silent: 'Silent: bots only answer DMs and @mentions',
  quiet: 'Quiet: one reply per post, one unprompted message a week',
  normal: 'Normal: up to two replies, a few unprompted messages a week',
  lively: 'Lively: up to three replies, lots of unprompted chatter',
}

const MAX_MENTIONS = 4

export const activePeople = (people: Person[]) => people.filter((p) => p.status === 'active')

export const headcount = (people: Person[]) => activePeople(people).length + 1

export const channelMembers = (channel: Channel, people: Person[]): Person[] => {
  const staff = activePeople(people)
  if (channel.kind !== 'channel') return staff.filter((p) => p.id === channel.personId)
  if (channel.leadership) {
    const leaders = staff.filter((p) => LEVEL_RANK[p.level] >= LEVEL_RANK.manager || p.dept === 'exec')
    return leaders.length > 0 ? leaders : staff
  }
  if (channel.dept) {
    return staff.filter((p) => p.dept === channel.dept || LEVEL_RANK[p.level] >= LEVEL_RANK.vp || p.dept === 'exec')
  }
  return staff
}

export const mentioned = (text: string, people: Person[]): Person[] => {
  const handles = [...text.matchAll(/@([\p{L}][\p{L}'-]*)/gu)].map((m) => (m[1] ?? '').toLowerCase())
  if (handles.length === 0) return []
  return activePeople(people)
    .filter((p) => handles.includes(firstName(p.name).toLowerCase()))
    .slice(0, MAX_MENTIONS)
}

const words = (text: string) => new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? [])

const relevance = (text: string, person: Person) => {
  const textWords = words(text)
  const roleWords = words(`${person.title} ${person.dept}`)
  return [...roleWords].filter((w) => textWords.has(w)).length
}

export type ResponderInput = {
  channel: Channel
  text: string
  people: Person[]
  recentAuthorIds: string[]
  activity: Activity
  rng: Rng
}

export const pickResponders = ({ channel, text, people, recentAuthorIds, activity, rng }: ResponderInput): Person[] => {
  if (channel.kind === 'mentor') return []
  if (channel.kind !== 'channel') {
    return people.filter((p) => p.id === channel.personId && (p.status === 'active' || p.status === 'candidate'))
  }
  const direct = mentioned(text, people)
  const slots = Math.max(REPLIES_PER_POST[activity] - direct.length, 0)
  const pool = channelMembers(channel, people).filter((p) => !direct.some((d) => d.id === p.id))
  const scored = sampleWeighted(
    pool,
    (p) =>
      1 +
      LEVEL_RANK[p.level] * 0.4 +
      relevance(text, p) * 3 +
      (channel.dept && p.dept === channel.dept ? 2 : 0) +
      (recentAuthorIds.includes(p.id) ? 0 : 0.5),
    slots,
    rng,
  )
  return [...direct, ...scored]
}

export const pickUnpromptedSpeakers = (people: Person[], activity: Activity, rng: Rng): Person[] =>
  sampleWeighted(activePeople(people), (p) => 1 + LEVEL_RANK[p.level] * 0.5, UNPROMPTED_PER_WEEK[activity], rng)

export const homeChannel = (person: Person, channels: Channel[]): Channel => {
  const general = channels.find((c) => c.id === 'general') as Channel
  return channels.find((c) => c.kind === 'channel' && c.dept === person.dept) ?? general
}

export const nextScenario = (runs: ScenarioRun[], people: Person[], product: string): Scenario | null => {
  const seen = new Set(runs.map((r) => r.id))
  const stage = stageForHeadcount(headcount(people)).index
  const unseen = scenariosFor(product).filter((s) => !seen.has(s.id))
  return unseen.find((s) => s.stage <= stage) ?? unseen[0] ?? null
}

export const scenarioRaiser = (scenario: Scenario, people: Person[]): Person | null => {
  const staff = activePeople(people)
  const byRank = (a: Person, b: Person) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]
  return (
    staff.filter((p) => p.dept === scenario.raisedBy).sort(byRank)[0] ?? [...staff].sort(byRank)[0] ?? null
  )
}

export const scenarioChannel = (scenario: Scenario, raiser: Person | null, channels: Channel[]): Channel => {
  const leadership = channels.find((c) => c.id === 'leadership') as Channel
  if (scenario.raisedBy === 'exec' || !raiser) return leadership
  return channels.find((c) => c.kind === 'channel' && c.dept === scenario.raisedBy) ?? leadership
}

export const tokensToday = (state: State, now: number): number =>
  Object.values(state.usage[dayKey(now)] ?? {}).reduce((sum, cell) => sum + (cell?.input ?? 0) + (cell?.output ?? 0), 0)

export const overBudget = (state: State, now: number) => tokensToday(state, now) >= state.settings.dailyTokenBudget

export const usableProviders = (settings: Settings, serverKeys: Record<RealProvider, boolean>): RealProvider[] =>
  REAL_PROVIDERS.filter((p) => settings.providers[p].enabled && (settings.providers[p].key.trim() !== '' || serverKeys[p]))

export const resolveProvider = (
  wanted: Provider,
  settings: Settings,
  serverKeys: Record<RealProvider, boolean>,
): Provider => {
  const usable = usableProviders(settings, serverKeys)
  if (wanted !== 'mock' && usable.includes(wanted)) return wanted
  return usable[0] ?? 'mock'
}

export const assignProvider = (
  people: Person[],
  settings: Settings,
  serverKeys: Record<RealProvider, boolean>,
): Provider => {
  const usable = usableProviders(settings, serverKeys)
  if (usable.length === 0) return 'mock'
  const counts = usable.map((p) => ({ p, n: activePeople(people).filter((x) => x.provider === p).length }))
  return counts.reduce((best, c) => (c.n < best.n ? c : best)).p
}

export const inQuietHours = (settings: Settings, now: Date): boolean => {
  const { quietStart, quietEnd, quietWeekdaysOnly } = settings
  if (quietStart === quietEnd) return false
  const day = now.getDay()
  if (quietWeekdaysOnly && (day === 0 || day === 6)) return false
  const hour = now.getHours()
  return quietStart < quietEnd ? hour >= quietStart && hour < quietEnd : hour >= quietStart || hour < quietEnd
}

export const autoAdvanceDue = (state: State, now: number): boolean => {
  const hours = state.settings.autoAdvanceHours
  if (!state.started || hours <= 0) return false
  if (inQuietHours(state.settings, new Date(now))) return false
  return now - state.lastAutoTick >= hours * 3_600_000
}

export const unreadCount = (channelId: string, messages: Message[], lastRead: Record<string, number>) => {
  const since = lastRead[channelId] ?? 0
  return messages.filter((m) => m.channelId === channelId && m.ts > since && m.authorId !== CEO_ID).length
}

export const delegatedFillsThisWeek = (openedWeek: number, week: number, remaining: number) =>
  week - openedWeek >= 2 ? Math.min(remaining, 3) : 0
