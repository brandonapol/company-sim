import { describe, expect, it } from 'vitest'
import { ARCHETYPES, characterSheet, generateCharacter, mergeCharacter } from './character.ts'
import { archetypesIn, ensureCharacters, generatePerson } from './names.ts'
import { candidateSystem, employeeSystem } from './prompts.ts'
import { emptyState } from './seed.ts'
import type { Person } from './types.ts'

const seeded = (seed: number) => {
  const next = { value: seed }
  return () => {
    next.value = (next.value * 1664525 + 1013904223) % 4294967296
    return next.value / 4294967296
  }
}

const hire = (people: Person[], rng: () => number): Person =>
  generatePerson(
    {
      title: 'Software Engineer',
      dept: 'engineering',
      level: 'ic',
      salary: 100_000,
      managerId: null,
      provider: 'mock',
      week: 1,
      reqId: null,
    },
    new Set(people.map((p) => p.name)),
    archetypesIn(people, 'engineering'),
    rng,
  )

describe('archetype library', () => {
  it('gives every archetype a distinct name, voice and two samples', () => {
    expect(new Set(ARCHETYPES.map((a) => a.name)).size).toBe(ARCHETYPES.length)
    expect(new Set(ARCHETYPES.map((a) => a.voice)).size).toBe(ARCHETYPES.length)
    expect(ARCHETYPES.every((a) => a.samples.length === 2 && a.careers.length >= 2)).toBe(true)
  })
})

describe('generateCharacter', () => {
  it('is deterministic for a given random source', () => {
    expect(generateCharacter('marketing', 'ic', new Set(), seeded(7))).toEqual(
      generateCharacter('marketing', 'ic', new Set(), seeded(7)),
    )
  })

  it('never makes a senior leader a new grad', () => {
    const rng = seeded(11)
    const leaders = Array.from({ length: 200 }, () => generateCharacter('engineering', 'vp', new Set(), rng))
    expect(leaders.some((c) => c.archetype === 'The new grad')).toBe(false)
    expect(leaders.every((c) => c.age >= 36)).toBe(true)
  })

  it('mostly picks archetypes that fit the department', () => {
    const rng = seeded(3)
    const fits = new Set(ARCHETYPES.filter((a) => a.fits.includes('sales')).map((a) => a.name))
    const picked = Array.from({ length: 300 }, () => generateCharacter('sales', 'ic', new Set(), rng))
    expect(picked.filter((c) => fits.has(c.archetype)).length).toBeGreaterThan(200)
  })
})

describe('a growing team', () => {
  it('does not fill a department with one personality', () => {
    const rng = seeded(42)
    const team = Array.from({ length: 8 }).reduce<Person[]>((acc) => [...acc, hire(acc, rng)], [])
    expect(new Set(team.map((p) => p.character.archetype)).size).toBeGreaterThanOrEqual(5)
    expect(new Set(team.map((p) => p.name)).size).toBe(8)
  })
})

describe('prompts', () => {
  const state = { ...emptyState(), company: { ...emptyState().company, name: 'Acme', ceoName: 'Brandon' } }
  const person = hire([], seeded(5))

  it('puts the voice, history and samples in front of the model', () => {
    const system = employeeSystem(state, person)
    expect(system).toContain(person.character.voice)
    expect(system).toContain(person.character.career)
    expect(system).toContain(person.character.samples[0])
    expect(system).toContain('avoid assistant habits')
  })

  it('gives two different people different instructions', () => {
    const rng = seeded(9)
    const first = hire([], rng)
    const second = hire([first], rng)
    expect(first.character.archetype).not.toBe(second.character.archetype)
    expect(characterSheet(first.character)).not.toBe(characterSheet(second.character))
  })

  it('gives candidates a character too', () => {
    const candidate: Person = { ...person, status: 'candidate' }
    expect(candidateSystem(state, candidate, undefined)).toContain(person.character.voice)
  })
})

describe('mergeCharacter', () => {
  const base = generateCharacter('design', 'ic', new Set(), seeded(1))

  it('keeps the generated character when the model returns nothing usable', () => {
    expect(mergeCharacter(undefined, base)).toEqual(base)
    expect(mergeCharacter({ age: 'old', voice: '  ', samples: 'nope' }, base)).toEqual(base)
  })

  it('takes a model-written voice with its own samples', () => {
    const merged = mergeCharacter({ voice: 'Clipped. Military.', samples: ['Copy that.', 7, ''], age: 51 }, base)
    expect(merged.voice).toBe('Clipped. Military.')
    expect(merged.samples).toEqual(['Copy that.'])
    expect(merged.age).toBe(51)
    expect(merged.archetype).toBe('One of a kind')
    expect(merged.career).toBe(base.career)
  })
})

describe('ensureCharacters', () => {
  it('gives saved people from before characters existed a character, and leaves others alone', () => {
    const current = hire([], seeded(2))
    const old = { ...hire([], seeded(4)), character: undefined } as unknown as Person
    const [kept, upgraded] = ensureCharacters([current, old], seeded(6))
    expect(kept).toBe(current)
    expect(upgraded?.character.voice).toBeTruthy()
  })
})
