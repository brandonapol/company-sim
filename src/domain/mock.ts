import { PERSONAS, QUIRKS, randomName } from './names.ts'
import type { Character } from './character.ts'
import type { Person, Req, Review, State } from './types.ts'
import { pick } from './util.ts'
import type { Rng } from './util.ts'

const REPLIES = [
  'Honestly I need more to go on. What outcome are we optimizing for here, and by when?',
  'I can make that work, but something else has to come off my plate. Which of my current priorities drops?',
  'I disagree a bit. We tried something close to this last month and the numbers did not move. Can we run a two-week test before committing?',
  'That is clear, thanks. I will write up a one-pager with owners and dates by Friday.',
  'Who is the decision-maker on this? I have heard two different answers this week.',
  'Works for me. The risk I would flag is that we are assuming customers want this without having asked five of them.',
]

const UNPROMPTED = [
  'Quick update: we shipped the onboarding fix and activation is up about 4 points week over week. Too early to call it, but encouraging.',
  'Idea: three customers asked for the same export feature this month. I think a small version is a week of work. Worth prioritizing?',
  'Flagging a risk: I am the only person who knows how our billing setup works. If I am out, nobody can fix it.',
  'I need a decision from you: do we spend the remaining budget on the conference or on paid acquisition tests? I cannot do both.',
  'Some friction to surface: sales keeps promising dates that nobody on the build side agreed to.',
]

const CANDIDATE = [
  'Happy to go deeper. At my last company I owned that end to end, and we grew the number from roughly 200 to 900 in a year. What does success look like here in the first 90 days?',
  'Good question. Honestly that project did not go well at first, and I learned to get alignment before building. Can you tell me how decisions get made between you and your co-founder?',
  'I would start by talking to ten customers before changing anything. What is your runway, if you do not mind me asking?',
]

export const mockReply = (rng: Rng) => `${pick(REPLIES, rng)} (mock reply: add an API key in Settings for real ones)`

export const mockUnprompted = (rng: Rng) => pick(UNPROMPTED, rng)

export const mockCandidateReply = (rng: Rng) => pick(CANDIDATE, rng)

export const mockMentor = () =>
  'I am running in mock mode, so I cannot actually read your work yet. Add an API key in Settings and I will give you real feedback on how you are leading.'

export type CandidateDraft = {
  name: string
  background: string
  strengths: string[]
  concerns: string[]
  hiddenWeakness: string
  persona: string
  salaryAsk: number
  character?: Partial<Record<keyof Character, unknown>>
}

export const mockCandidates = (req: Req, people: Person[], rng: Rng): CandidateDraft[] => {
  const taken = new Set(people.map((p) => p.name))
  const shapes = [
    {
      background: `Eight years in ${req.dept} at a much larger company, most recently leading a team of six.`,
      strengths: ['Has seen what good looks like at scale', 'Polished communicator'],
      concerns: ['May expect a team and budget we do not have'],
      factor: 1.25,
    },
    {
      background: `Three years in ${req.dept} at an early-stage startup that folded. Did a bit of everything.`,
      strengths: ['Scrappy and hands-on', 'Comfortable with ambiguity'],
      concerns: ['Has never seen the function done well by someone senior'],
      factor: 0.9,
    },
    {
      background: `Career switcher with five years in consulting and one year in ${req.dept}.`,
      strengths: ['Structured thinker', 'Strong analytical skills'],
      concerns: ['Limited direct experience in the role'],
      factor: 1,
    },
  ]
  return shapes.map((shape) => {
    const name = randomName(taken, rng)
    taken.add(name)
    return {
      name,
      background: shape.background,
      strengths: shape.strengths,
      concerns: shape.concerns,
      hiddenWeakness: pick(QUIRKS, rng),
      persona: pick(PERSONAS, rng),
      salaryAsk: Math.round((req.salary * shape.factor) / 1000) * 1000,
    }
  })
}

export const mockReview = (state: State): Omit<Review, 'id' | 'week' | 'ts'> => ({
  headline: 'Mock mode: this is a placeholder review. Add an API key in Settings to get real coaching.',
  scores: {},
  wentWell: [`You have posted ${state.messages.filter((m) => m.authorId === 'ceo').length} messages so far.`],
  blindSpots: ['No real analysis available without a model.'],
  missedQuestions: [],
  practice: 'Record a decision on the open situation, with your reasoning written down.',
  concept: 'Decision logs: writing down what you decided and why, so you can learn from it later.',
})
