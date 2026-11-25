import type { RealProvider } from '../shared/api.ts'
import type { Character } from './character.ts'

export type Provider = RealProvider | 'mock'

export type Dept =
  'exec' | 'engineering' | 'product' | 'design' | 'marketing' | 'sales' | 'success' | 'people' | 'finance' | 'ops'

export type Level = 'ic' | 'senior' | 'lead' | 'manager' | 'director' | 'vp' | 'cxo'

export type PersonStatus = 'active' | 'candidate' | 'rejected' | 'departed'

export type Person = {
  id: string
  name: string
  title: string
  dept: Dept
  level: Level
  managerId: string | null
  salary: number
  provider: Provider
  persona: string
  quirk: string
  character: Character
  background: string
  strengths: string[]
  concerns: string[]
  status: PersonStatus
  hiredWeek: number
  reqId: string | null
}

export type ChannelKind = 'channel' | 'dm' | 'interview' | 'mentor'

export type Channel = {
  id: string
  name: string
  kind: ChannelKind
  topic: string
  dept: Dept | null
  personId: string | null
  leadership: boolean
}

export type MessageKind = 'chat' | 'system' | 'decision' | 'scenario'

export type Message = {
  id: string
  channelId: string
  authorId: string
  text: string
  ts: number
  week: number
  kind: MessageKind
  scenarioId: string | null
}

export type ReqMode = 'direct' | 'delegated'

export type Req = {
  id: string
  title: string
  dept: Dept
  level: Level
  salary: number
  managerId: string | null
  mode: ReqMode
  count: number
  filled: number
  status: 'open' | 'filled' | 'closed'
  openedWeek: number
  notes: string
}

export type Decision = {
  id: string
  week: number
  ts: number
  title: string
  decision: string
  rationale: string
  scenarioId: string | null
  channelId: string
}

export type ScoreKey = 'strategy' | 'communication' | 'delegation' | 'people' | 'finance' | 'decisions'

export type Review = {
  id: string
  week: number
  ts: number
  headline: string
  scores: Partial<Record<ScoreKey, number>>
  wentWell: string[]
  blindSpots: string[]
  missedQuestions: string[]
  practice: string
  concept: string
}

export type ScenarioRun = {
  id: string
  status: 'active' | 'decided'
  startedWeek: number
  decidedWeek: number | null
  channelId: string
}

export type Company = {
  name: string
  product: string
  pitch: string
  ceoName: string
  cash: number
  mrr: number
  baseGrowthPct: number
  otherBurn: number
  week: number
}

export type Activity = 'silent' | 'quiet' | 'normal' | 'lively'

export type ProviderSettings = { key: string; model: string; enabled: boolean }

export type Settings = {
  activity: Activity
  dailyTokenBudget: number
  replyWords: number
  contextMessages: number
  autoAdvanceHours: number
  quietStart: number
  quietEnd: number
  quietWeekdaysOnly: boolean
  autoReview: boolean
  providers: Record<RealProvider, ProviderSettings>
  mentor: { provider: RealProvider; model: string }
}

export type UsageCell = { input: number; output: number; calls: number }

export type Usage = Record<string, Partial<Record<Provider, UsageCell>>>

export type State = {
  version: 1
  started: boolean
  company: Company
  people: Person[]
  channels: Channel[]
  messages: Message[]
  reqs: Req[]
  decisions: Decision[]
  reviews: Review[]
  scenarios: ScenarioRun[]
  settings: Settings
  usage: Usage
  lastRead: Record<string, number>
  lastAutoTick: number
  lastReviewTs: number
}

export const CEO_ID = 'ceo'
export const SYSTEM_ID = 'system'
export const MENTOR_ID = 'mentor'

export const DEPTS: Dept[] = [
  'exec',
  'engineering',
  'product',
  'design',
  'marketing',
  'sales',
  'success',
  'people',
  'finance',
  'ops',
]

export const DEPT_LABEL: Record<Dept, string> = {
  exec: 'Executive',
  engineering: 'Engineering',
  product: 'Product',
  design: 'Design',
  marketing: 'Marketing',
  sales: 'Sales',
  success: 'Customer Success',
  people: 'People',
  finance: 'Finance',
  ops: 'Operations',
}

export const LEVELS: Level[] = ['ic', 'senior', 'lead', 'manager', 'director', 'vp', 'cxo']

export const LEVEL_LABEL: Record<Level, string> = {
  ic: 'IC',
  senior: 'Senior IC',
  lead: 'Lead',
  manager: 'Manager',
  director: 'Director',
  vp: 'VP',
  cxo: 'C-level',
}

export const LEVEL_RANK: Record<Level, number> = {
  ic: 0,
  senior: 1,
  lead: 2,
  manager: 3,
  director: 4,
  vp: 5,
  cxo: 6,
}
