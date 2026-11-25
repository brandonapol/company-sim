import { PERSONAS, QUIRKS } from './names.ts'
import type { Channel, Company, Dept, Person, Settings, State } from './types.ts'
import { DEPT_LABEL } from './types.ts'
import { uid } from './util.ts'

export const defaultSettings = (): Settings => ({
  activity: 'quiet',
  dailyTokenBudget: 150_000,
  replyWords: 70,
  contextMessages: 10,
  autoAdvanceHours: 0,
  quietStart: 9,
  quietEnd: 18,
  quietWeekdaysOnly: true,
  autoReview: false,
  providers: {
    anthropic: { key: '', model: 'claude-haiku-5-5', enabled: true },
    openai: { key: '', model: 'gpt-5.1-codex', enabled: true },
    xai: { key: '', model: 'grok-4.7', enabled: true },
  },
  mentor: { provider: 'anthropic', model: 'claude-opus-5-5' },
})

const channel = (id: string, name: string, topic: string, extra: Partial<Channel> = {}): Channel => ({
  id,
  name,
  kind: 'channel',
  topic,
  dept: null,
  personId: null,
  leadership: false,
  ...extra,
})

export const deptChannel = (dept: Dept): Channel =>
  channel(`dept-${dept}`, dept, `${DEPT_LABEL[dept]} team`, { dept })

export const dmChannel = (person: Person, kind: 'dm' | 'interview'): Channel =>
  channel(`${kind}-${person.id}`, person.name, person.title, { kind, personId: person.id })

export const baseChannels = (): Channel[] => [
  channel('general', 'general', 'Company-wide'),
  channel('leadership', 'leadership', 'Decisions, strategy and the hard conversations', { leadership: true }),
  channel('hiring', 'hiring', 'Open roles and new joiners'),
  channel('mentor', 'Mentor', 'Your coach. Reads everything, reports only to you.', { kind: 'mentor' }),
]

export const emptyCompany = (): Company => ({
  name: '',
  product: 'Quark',
  pitch: '',
  ceoName: '',
  cash: 500_000,
  mrr: 5_000,
  baseGrowthPct: 3,
  otherBurn: 6_000,
  week: 1,
})

export const emptyState = (): State => ({
  version: 1,
  started: false,
  company: emptyCompany(),
  people: [],
  channels: baseChannels(),
  messages: [],
  reqs: [],
  decisions: [],
  reviews: [],
  scenarios: [],
  settings: defaultSettings(),
  usage: {},
  lastRead: {},
  lastAutoTick: 0,
  lastReviewTs: 0,
})

export type Cofounder = { name: string; title: string; salary: number }

export const cofounderPerson = (cofounder: Cofounder): Person => ({
  id: uid(),
  name: cofounder.name,
  title: cofounder.title,
  dept: 'exec',
  level: 'cxo',
  managerId: null,
  salary: cofounder.salary,
  provider: 'mock',
  persona: PERSONAS[1] as string,
  quirk: QUIRKS[3] as string,
  background: 'Co-founder. Has been building the product from day one and knows where every body is buried.',
  strengths: [],
  concerns: [],
  status: 'active',
  hiredWeek: 1,
  reqId: null,
})
