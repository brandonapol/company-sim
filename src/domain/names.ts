import type { Dept, Level, Person, Provider } from './types.ts'
import { pick, uid } from './util.ts'
import type { Rng } from './util.ts'

const FIRST = [
  'Amara',
  'Ben',
  'Carmen',
  'Dev',
  'Elena',
  'Farid',
  'Grace',
  'Hiro',
  'Imani',
  'Jonas',
  'Kavya',
  'Liam',
  'Mei',
  'Nico',
  'Olu',
  'Priya',
  'Quinn',
  'Rosa',
  'Sven',
  'Tala',
  'Uma',
  'Viktor',
  'Wren',
  'Xavier',
  'Yara',
  'Zane',
  'Anika',
  'Mateo',
  'Noor',
  'Tomas',
  'Leila',
  'Kofi',
  'Ingrid',
  'Rafael',
  'Sana',
  'Declan',
  'Mina',
  'Andre',
]

const LAST = [
  'Abara',
  'Bergstrom',
  'Castillo',
  'Desai',
  'Eklund',
  'Farouk',
  'Gallagher',
  'Hayashi',
  'Ivanov',
  'Jensen',
  'Kaplan',
  'Lindqvist',
  'Mbeki',
  'Nakamura',
  'Okafor',
  'Petrov',
  'Quintero',
  'Rahman',
  'Silva',
  'Tanaka',
  'Ueda',
  'Vasquez',
  'Whitfield',
  'Xu',
  'Yilmaz',
  'Zhou',
  'Moreau',
  'Novak',
  'Oyelaran',
  'Park',
  'Reyes',
  'Shah',
]

export const PERSONAS = [
  'Blunt and fast. Says the uncomfortable thing first, then offers a fix.',
  'Thoughtful and data-driven. Wants a number before committing to an opinion.',
  'Warm, relationship-first. Reads the room and worries about morale.',
  'Ambitious and impatient. Pushes for scope and headcount, tends to think big.',
  'Skeptical craftsperson. Cares about quality and hates rushed decisions.',
  'Scrappy operator. Prefers a cheap experiment this week over a perfect plan next month.',
  'Structured planner. Likes written proposals, owners and dates.',
  'Customer-obsessed. Quotes real customer conversations constantly.',
  'Quiet but sharp. Speaks rarely, and usually to point out the thing everyone missed.',
  'Upbeat seller of ideas. Great energy, sometimes light on downside thinking.',
]

export const QUIRKS = [
  'Overcommits and under-flags risk until it is late.',
  'Avoids direct conflict; raises issues sideways or in DMs rather than in the channel.',
  'Territorial about their function and wary of other teams making decisions in it.',
  'Quietly unsure whether the CEO has a clear strategy and tests for it with pointed questions.',
  'Wants a promotion and frames many things in terms of scope and title.',
  'Burning out a little; gets terse when new priorities are added without removing old ones.',
  'Strong opinions held too tightly; needs to be asked for evidence.',
  'Defers to the CEO too easily unless explicitly invited to disagree.',
  'Excellent at the craft, weak at communicating status unless asked.',
  'Compares everything to how their last (bigger) company did it.',
]

const TITLE: Record<Dept, string> = {
  exec: 'Chief of Staff',
  engineering: 'Software Engineer',
  product: 'Product Manager',
  design: 'Product Designer',
  marketing: 'Marketing Manager',
  sales: 'Account Executive',
  success: 'Customer Success Manager',
  people: 'People Partner',
  finance: 'Finance Analyst',
  ops: 'Operations Associate',
}

export const defaultTitle = (dept: Dept) => TITLE[dept]

export const randomName = (taken: Set<string>, rng: Rng): string => {
  const name = `${pick(FIRST, rng)} ${pick(LAST, rng)}`
  return taken.has(name) ? randomName(taken, rng) : name
}

export type PersonSeed = {
  title: string
  dept: Dept
  level: Level
  salary: number
  managerId: string | null
  provider: Provider
  week: number
  reqId: string | null
}

export const generatePerson = (seed: PersonSeed, taken: Set<string>, rng: Rng): Person => ({
  id: uid(),
  name: randomName(taken, rng),
  title: seed.title,
  dept: seed.dept,
  level: seed.level,
  managerId: seed.managerId,
  salary: seed.salary,
  provider: seed.provider,
  persona: pick(PERSONAS, rng),
  quirk: pick(QUIRKS, rng),
  background: '',
  strengths: [],
  concerns: [],
  status: 'active',
  hiredWeek: seed.week,
  reqId: seed.reqId,
})
