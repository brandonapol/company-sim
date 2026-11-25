import { describe, expect, it } from 'vitest'
import { SCENARIOS, scenariosFor } from './curriculum.ts'
import {
  autoAdvanceDue,
  delegatedFillsThisWeek,
  inQuietHours,
  mentioned,
  nextScenario,
  overBudget,
  pickResponders,
  resolveProvider,
} from './engine.ts'
import { advanceWeek, finance } from './finance.ts'
import { baseChannels, defaultSettings, deptChannel, emptyState } from './seed.ts'
import type { Channel, Dept, Level, Person } from './types.ts'
import { dayKey, extractJson } from './util.ts'

const person = (name: string, dept: Dept, level: Level = 'ic', extra: Partial<Person> = {}): Person => ({
  id: name.toLowerCase().replace(/\s/g, '-'),
  name,
  title: `${dept} person`,
  dept,
  level,
  managerId: null,
  salary: 120_000,
  provider: 'mock',
  persona: '',
  quirk: '',
  background: '',
  strengths: [],
  concerns: [],
  status: 'active',
  hiredWeek: 1,
  reqId: null,
  ...extra,
})

const people = [
  person('Ana Lee', 'exec', 'cxo'),
  person('Bo Chen', 'marketing'),
  person('Cy Diaz', 'engineering'),
  person('Di Evans', 'engineering', 'manager'),
  person('Gone Guy', 'marketing', 'ic', { status: 'departed' }),
]

const general = baseChannels().find((c) => c.id === 'general') as Channel
const noKeys = { anthropic: false, openai: false, xai: false }
const fixed = () => 0.5

describe('pickResponders', () => {
  const input = { channel: general, text: 'thoughts?', people, recentAuthorIds: [], rng: fixed }

  it('stays silent in channels on silent mode', () => {
    expect(pickResponders({ ...input, activity: 'silent' })).toEqual([])
  })

  it('always answers an @mention, even on silent mode', () => {
    const picked = pickResponders({ ...input, text: 'hey @bo what do you think', activity: 'silent' })
    expect(picked.map((p) => p.name)).toEqual(['Bo Chen'])
  })

  it('caps replies by activity level and never repeats a person', () => {
    const picked = pickResponders({ ...input, activity: 'lively' })
    expect(picked).toHaveLength(3)
    expect(new Set(picked.map((p) => p.id)).size).toBe(3)
  })

  it('never picks departed people', () => {
    const picked = pickResponders({ ...input, text: '@gone hello', activity: 'lively' })
    expect(picked.some((p) => p.name === 'Gone Guy')).toBe(false)
  })

  it('keeps department channels to that department plus senior leaders', () => {
    const picked = pickResponders({ ...input, channel: deptChannel('engineering'), activity: 'lively' })
    expect(picked.every((p) => p.dept === 'engineering' || p.dept === 'exec')).toBe(true)
  })

  it('answers DMs regardless of activity', () => {
    const dm: Channel = { ...general, id: 'dm', kind: 'dm', personId: 'cy-diaz' }
    expect(pickResponders({ ...input, channel: dm, activity: 'silent' }).map((p) => p.name)).toEqual(['Cy Diaz'])
  })
})

describe('mentioned', () => {
  it('matches first names case-insensitively', () => {
    expect(mentioned('@ANA and @cy please', people).map((p) => p.name)).toEqual(['Ana Lee', 'Cy Diaz'])
  })
})

describe('finance', () => {
  const company = { ...emptyState().company, cash: 240_000, mrr: 10_000, otherBurn: 5_000 }

  it('computes burn and runway from payroll', () => {
    const f = finance(company, people)
    expect(f.headcount).toBe(5)
    expect(f.payroll).toBe(50_000)
    expect(f.netBurn).toBe(45_000)
    expect(f.runwayMonths).toBeCloseTo(240_000 / 45_000)
  })

  it('reports no runway limit when profitable', () => {
    expect(finance({ ...company, mrr: 500_000 }, people).runwayMonths).toBeNull()
  })

  it('moves cash down and MRR up over a week', () => {
    const next = advanceWeek(company, people)
    expect(next.week).toBe(company.week + 1)
    expect(next.cash).toBeLessThan(company.cash)
    expect(next.mrr).toBeGreaterThan(company.mrr)
  })
})

describe('curriculum', () => {
  it('starts with the first marketing hire and stays within the current stage', () => {
    expect(nextScenario([], people, 'Quark')?.id).toBe('first-marketing-hire')
  })

  it('moves to later stages once the current one is exhausted', () => {
    const done = SCENARIOS.filter((s) => s.stage === 0).map((s) => ({
      id: s.id,
      status: 'decided' as const,
      startedWeek: 1,
      decidedWeek: 1,
      channelId: 'leadership',
    }))
    expect(nextScenario(done, people, 'Quark')?.stage).toBe(1)
  })

  it('only raises the Quark-specific situations when the product is Quark', () => {
    expect(scenariosFor('Quark').some((s) => s.id === 'quark-revenue-model')).toBe(true)
    expect(scenariosFor('Something else').some((s) => s.onlyProduct)).toBe(false)
  })

  it('has unique scenario ids', () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length)
  })
})

describe('cost and pacing controls', () => {
  it('falls back to mock when no provider has a key', () => {
    expect(resolveProvider('anthropic', defaultSettings(), noKeys)).toBe('mock')
  })

  it('uses another keyed provider when the preferred one is unavailable', () => {
    const settings = defaultSettings()
    const withKey = { ...settings, providers: { ...settings.providers, xai: { ...settings.providers.xai, key: 'k' } } }
    expect(resolveProvider('anthropic', withKey, noKeys)).toBe('xai')
  })

  it('stops at the daily token budget', () => {
    const now = Date.now()
    const state = { ...emptyState(), usage: { [dayKey(now)]: { anthropic: { input: 140_000, output: 10_000, calls: 9 } } } }
    expect(overBudget(state, now)).toBe(true)
    expect(overBudget({ ...state, usage: {} }, now)).toBe(false)
  })

  it('respects quiet hours on weekdays only', () => {
    const settings = defaultSettings()
    expect(inQuietHours(settings, new Date(2026, 10, 25, 11))).toBe(true)
    expect(inQuietHours(settings, new Date(2026, 10, 25, 20))).toBe(false)
    expect(inQuietHours(settings, new Date(2026, 10, 28, 11))).toBe(false)
  })

  it('handles quiet hours that wrap past midnight', () => {
    const settings = { ...defaultSettings(), quietStart: 22, quietEnd: 7, quietWeekdaysOnly: false }
    expect(inQuietHours(settings, new Date(2026, 10, 25, 23))).toBe(true)
    expect(inQuietHours(settings, new Date(2026, 10, 25, 12))).toBe(false)
  })

  it('never auto-advances unless switched on, due, and outside quiet hours', () => {
    const evening = new Date(2026, 10, 25, 20).getTime()
    const midday = new Date(2026, 10, 25, 11).getTime()
    const base = { ...emptyState(), started: true, lastAutoTick: evening - 5 * 3_600_000 }
    const on = { ...base, settings: { ...base.settings, autoAdvanceHours: 4 } }
    expect(autoAdvanceDue(base, evening)).toBe(false)
    expect(autoAdvanceDue(on, evening)).toBe(true)
    expect(autoAdvanceDue({ ...on, lastAutoTick: midday - 5 * 3_600_000 }, midday)).toBe(false)
    expect(autoAdvanceDue({ ...on, lastAutoTick: evening - 3_600_000 }, evening)).toBe(false)
  })

  it('fills delegated roles after two weeks, three at a time', () => {
    expect(delegatedFillsThisWeek(4, 5, 10)).toBe(0)
    expect(delegatedFillsThisWeek(4, 6, 10)).toBe(3)
    expect(delegatedFillsThisWeek(4, 7, 2)).toBe(2)
  })
})

describe('extractJson', () => {
  it('pulls JSON out of fenced or chatty model output', () => {
    expect(extractJson<{ a: number }>('Sure!\n```json\n{"a": 1}\n```')).toEqual({ a: 1 })
    expect(extractJson('no json here')).toBeNull()
  })
})
