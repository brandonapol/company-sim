import type { Company, Person } from './types.ts'

const WEEKS_PER_MONTH = 52 / 12
const PAYROLL_LOAD = 1.25
const GTM = ['marketing', 'sales', 'success']
const BUILD = ['engineering', 'product', 'design']

export type Finance = {
  headcount: number
  payroll: number
  burn: number
  netBurn: number
  runwayMonths: number | null
  growthPct: number
}

const active = (people: Person[]) => people.filter((p) => p.status === 'active')

export const monthlyGrowthPct = (company: Company, people: Person[]) => {
  const staff = active(people)
  const gtm = staff.filter((p) => GTM.includes(p.dept)).length
  const build = staff.filter((p) => BUILD.includes(p.dept)).length
  return company.baseGrowthPct + Math.min(Math.sqrt(gtm) * 1.5, 9) + Math.min(Math.sqrt(build) * 0.8, 5)
}

export const finance = (company: Company, people: Person[]): Finance => {
  const staff = active(people)
  const payroll = (staff.reduce((sum, p) => sum + p.salary, 0) / 12) * PAYROLL_LOAD
  const burn = payroll + company.otherBurn
  const netBurn = burn - company.mrr
  return {
    headcount: staff.length + 1,
    payroll,
    burn,
    netBurn,
    runwayMonths: netBurn <= 0 ? null : Math.max(company.cash, 0) / netBurn,
    growthPct: monthlyGrowthPct(company, people),
  }
}

export const advanceWeek = (company: Company, people: Person[]): Company => {
  const f = finance(company, people)
  return {
    ...company,
    week: company.week + 1,
    cash: company.cash - f.netBurn / WEEKS_PER_MONTH,
    mrr: company.mrr * Math.pow(1 + f.growthPct / 100, 1 / WEEKS_PER_MONTH),
  }
}

export const runwayLabel = (f: Finance) =>
  f.runwayMonths === null ? 'profitable' : f.runwayMonths >= 60 ? '5y+' : `${f.runwayMonths.toFixed(1)} mo`
