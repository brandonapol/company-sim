import { SCENARIOS, scenarioById, stageForHeadcount } from './curriculum.ts'
import { activePeople, headcount } from './engine.ts'
import { finance, runwayLabel } from './finance.ts'
import { CEO_ID, DEPT_LABEL, LEVEL_LABEL, LEVEL_RANK, MENTOR_ID, SYSTEM_ID } from './types.ts'
import type { Channel, Message, Person, Req, State } from './types.ts'
import { money } from './util.ts'

const authorLabel = (state: State, authorId: string) => {
  if (authorId === CEO_ID) return `${state.company.ceoName} (CEO)`
  if (authorId === SYSTEM_ID) return 'System'
  if (authorId === MENTOR_ID) return 'Mentor'
  const person = state.people.find((p) => p.id === authorId)
  return person ? `${person.name} (${person.title})` : 'Former employee'
}

export const transcript = (state: State, messages: Message[]) =>
  messages.map((m) => `${authorLabel(state, m.authorId)}: ${m.text}`).join('\n')

export const recentMessages = (state: State, channelId: string, limit: number) =>
  state.messages.filter((m) => m.channelId === channelId).slice(-limit)

export const companyBrief = (state: State) => {
  const { company } = state
  const staff = activePeople(state.people)
  const f = finance(company, state.people)
  const stage = stageForHeadcount(f.headcount)
  const byDept = Object.entries(
    staff.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.dept]: (acc[p.dept] ?? 0) + 1 }), {}),
  )
    .map(([dept, n]) => `${DEPT_LABEL[dept as keyof typeof DEPT_LABEL]} ${n}`)
    .join(', ')
  const leaders = [...staff]
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level])
    .slice(0, 12)
    .map((p) => `${p.name} (${p.title})`)
    .join('; ')
  const decisions = state.decisions
    .slice(-5)
    .map((d) => `- Week ${d.week}: ${d.title}: ${d.decision}`)
    .join('\n')
  return [
    `Company: ${company.name}. Product: ${company.product}.`,
    `About: ${company.pitch}`,
    `CEO: ${company.ceoName}. Week ${company.week} of the simulation. Stage: ${stage.name} (${stage.theme}).`,
    `Headcount ${f.headcount} including the CEO${byDept ? ` (${byDept})` : ''}.`,
    `Finances: cash ${money(company.cash)}, MRR ${money(company.mrr)}, monthly burn ${money(f.burn)}, runway ${runwayLabel(f)}.`,
    leaders ? `Key people: ${leaders}.` : '',
    decisions ? `Recent CEO decisions:\n${decisions}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

const styleRules = (words: number) =>
  `Write the way people write in Slack: plain text, no markdown headings or bullet lists, no name prefix, no stage directions, at most about ${words} words. Never mention being an AI or a simulation.`

export const employeeSystem = (state: State, person: Person) => {
  const manager = state.people.find((p) => p.id === person.managerId)
  return [
    `You are ${person.name}, ${person.title} (${LEVEL_LABEL[person.level]}, ${DEPT_LABEL[person.dept]}) at ${state.company.name}. You report to ${manager ? manager.name : `${state.company.ceoName}, the CEO`}.`,
    `This is a management practice simulation. The CEO is a real person learning to lead a growing company, so the most useful thing you can do is behave like a real, competent colleague and not like an assistant. Hold opinions grounded in your function, protect your team's priorities, bring specifics (numbers, trade-offs, proposals), push back when you disagree, and ask for decisions, clarity or resources when a real employee would. If the CEO is vague, say what you need to act. Do not flatter.`,
    `Your personality: ${person.persona}`,
    `A private tendency you never state outright but that shows in how you behave: ${person.quirk}`,
    person.background ? `Your background: ${person.background}` : '',
    styleRules(state.settings.replyWords),
    '',
    companyBrief(state),
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export const candidateSystem = (state: State, person: Person, req: Req | undefined) =>
  [
    `You are ${person.name}, a candidate interviewing with ${state.company.ceoName}, CEO of ${state.company.name}, for the role of ${person.title}${req ? ` (${LEVEL_LABEL[req.level]}, budgeted around ${money(req.salary)})` : ''}.`,
    `This is an interview practice simulation for the CEO. Answer like a real candidate: specific stories, real numbers, and ordinary human self-presentation. You may ask the CEO questions about the company, role, runway and expectations, and you are also evaluating them.`,
    `Background: ${person.background}`,
    `Strengths: ${person.strengths.join('; ')}`,
    `Personality: ${person.persona}`,
    `A real weakness you do not volunteer. If the CEO asks probing, specific follow-up questions it becomes visible in your answers; if they stay superficial it stays hidden: ${person.quirk}`,
    `Your salary expectation is about ${money(person.salary)}.`,
    styleRules(state.settings.replyWords + 40),
    '',
    `What you know about the company: ${state.company.pitch}`,
  ].join('\n')

export const replyPrompt = (state: State, channel: Channel, person: Person) =>
  [
    channel.kind === 'channel' ? `Channel #${channel.name}.` : `Direct message with the CEO.`,
    'Recent messages, oldest first:',
    transcript(state, recentMessages(state, channel.id, state.settings.contextMessages)),
    '',
    `Write ${person.name}'s next message. Respond to the latest message; if others have already made your point, add something new or disagree instead of repeating it.`,
  ].join('\n')

export const unpromptedPrompt = (state: State, channel: Channel, person: Person) =>
  [
    `Channel #${channel.name}. Recent messages, oldest first:`,
    transcript(state, recentMessages(state, channel.id, Math.min(state.settings.contextMessages, 6))) || '(quiet)',
    '',
    `It is week ${state.company.week}. Post one unprompted message as ${person.name}. Choose exactly one: a concrete progress update with a number in it, a new idea for ${state.company.product}, a risk you are worried about, a decision or resource you need from the CEO, or friction with another team. Make it specific to where the company is right now and do not repeat anything above.`,
  ].join('\n')

export const candidatesPrompt = (state: State, req: Req) =>
  [
    companyBrief(state),
    '',
    `The CEO opened a role: ${req.title} (${LEVEL_LABEL[req.level]}, ${DEPT_LABEL[req.dept]}), budget about ${money(req.salary)} per year.`,
    req.notes ? `What the CEO says they want: ${req.notes}` : 'The CEO gave no description of what they want from this hire.',
    '',
    'Invent three realistic, clearly different candidates with a real trade-off between them (for example: strong but too senior and expensive, promising but unproven, great on paper with a hidden flaw). None should be an obviously right or wrong choice.',
    'Return only JSON: an array of three objects with keys name (string), background (two sentences), strengths (array of 2-3 short strings), concerns (array of 1-2 short strings an interviewer could see on the resume), hiddenWeakness (one sentence, only discoverable by good interviewing), persona (one sentence on how they communicate), salaryAsk (number, USD per year).',
  ].join('\n')

export const mentorSystem = (state: State) =>
  [
    `You are a mentor and executive coach to ${state.company.ceoName}, a first-time CEO using a simulated company to practice scaling from 2 people to several hundred. You have scaled companies through every stage and you teach the practical core of an MBA: strategy, finance, marketing, sales, operations, org design, people and leadership.`,
    `Be direct, specific and kind. Quote or point to what the CEO actually said or did. Name frameworks when they help and explain them in a sentence. Prioritize: one or two things that matter most beat a long list. The CEO has told you they do not know what they do not know, so point out the questions they did not think to ask. Do not flatter and do not pad.`,
    '',
    companyBrief(state),
  ].join('\n')

export const mentorChatPrompt = (state: State, channel: Channel) => {
  const last = state.reviews[state.reviews.length - 1]
  return [
    last ? `Your most recent written review (week ${last.week}): ${last.headline} Practice assignment: ${last.practice}` : '',
    'Conversation with the CEO, oldest first:',
    transcript(state, recentMessages(state, channel.id, 16)),
    '',
    'Write your next reply as the mentor in plain text, under about 220 words.',
  ]
    .filter(Boolean)
    .join('\n')
}

const REVIEW_MESSAGE_LIMIT = 70

export const reviewPrompt = (state: State) => {
  const since = state.lastReviewTs
  const channelName = (id: string) => {
    const c = state.channels.find((ch) => ch.id === id)
    return c ? (c.kind === 'channel' ? `#${c.name}` : c.kind === 'interview' ? `interview: ${c.name}` : `DM: ${c.name}`) : id
  }
  const activity = state.messages
    .filter((m) => m.ts > since && state.channels.find((c) => c.id === m.channelId)?.kind !== 'mentor')
    .slice(-REVIEW_MESSAGE_LIMIT)
    .map((m) => `[week ${m.week} ${channelName(m.channelId)}] ${transcript(state, [m])}`)
    .join('\n')
  const decisions = state.decisions
    .filter((d) => d.ts > since)
    .map((d) => {
      const scenario = d.scenarioId ? scenarioById(d.scenarioId) : undefined
      return [
        `- Week ${d.week}: ${d.title}`,
        `  Decision: ${d.decision}`,
        `  Rationale given: ${d.rationale || '(none)'}`,
        scenario ? `  What good looks like for this situation: ${scenario.rubric}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')
  const open = state.scenarios
    .filter((r) => r.status === 'active')
    .map((r) => {
      const s = scenarioById(r.id)
      return s ? `- ${s.title} (raised week ${r.startedWeek}, still undecided)` : ''
    })
    .filter(Boolean)
    .join('\n')
  const reqs = state.reqs
    .map((r) => `- ${r.title} x${r.count} (${r.mode}, ${r.status}, opened week ${r.openedWeek}${r.notes ? `, brief: ${r.notes}` : ', no brief written'})`)
    .join('\n')
  const stage = stageForHeadcount(headcount(state.people))
  const upcoming = SCENARIOS.filter((s) => s.stage === stage.index && !state.scenarios.some((r) => r.id === s.id))
    .map((s) => s.title)
    .join('; ')
  const previous = state.reviews[state.reviews.length - 1]
  return [
    `Review the CEO's work since your last review. Current stage: ${stage.name}. The CEO's job at this stage: ${stage.ceoJob}`,
    previous ? `Your last review's practice assignment was: ${previous.practice}` : 'This is your first review.',
    '',
    'Everything said in the company since the last review, oldest first:',
    activity || '(no activity)',
    '',
    'Decisions the CEO recorded:',
    decisions || '(none recorded)',
    '',
    'Situations raised and still waiting for a decision:',
    open || '(none)',
    '',
    'Hiring requisitions:',
    reqs || '(none)',
    upcoming ? `\nTopics at this stage the CEO has not faced yet: ${upcoming}` : '',
    '',
    'Return only JSON with these keys:',
    'headline: one or two sentences, the single most important thing for the CEO to hear.',
    'scores: object with integer 1-5 for each of strategy, communication, delegation, people, finance, decisions. Use null where there is no evidence yet. 3 means competent for this stage; be honest.',
    'wentWell: array of 1-3 specific things, each pointing to something the CEO actually said or did.',
    'blindSpots: array of 1-3 specific things the CEO did poorly, avoided or left ambiguous.',
    'missedQuestions: array of 1-3 questions an experienced CEO would have asked in these situations that this CEO did not.',
    'practice: one concrete exercise to do in the simulation next week.',
    'concept: one framework or idea to study next, with one sentence on why it applies now.',
  ]
    .filter((line) => line !== '')
    .join('\n')
}
