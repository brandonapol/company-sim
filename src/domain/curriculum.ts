import type { Dept } from './types.ts'

export type Stage = {
  index: number
  name: string
  min: number
  max: number
  theme: string
  ceoJob: string
}

export type Topic =
  | 'Strategy'
  | 'Marketing'
  | 'Sales'
  | 'Finance'
  | 'People'
  | 'Org design'
  | 'Leadership'
  | 'Operations'
  | 'Governance'

export type Scenario = {
  id: string
  stage: number
  topic: Topic
  title: string
  raisedBy: Dept
  kickoff: string
  primer: string
  frameworks: string[]
  rubric: string
}

export const STAGES: Stage[] = [
  {
    index: 0,
    name: 'Founders',
    min: 2,
    max: 10,
    theme: 'From doing the work to hiring for it',
    ceoJob: 'Find who the product is for, keep the company alive, and make the first few hires count.',
  },
  {
    index: 1,
    name: 'Team',
    min: 11,
    max: 25,
    theme: 'First managers, first real process',
    ceoJob: 'Stop being the hub of every decision. Set goals, build a management layer, give real feedback.',
  },
  {
    index: 2,
    name: 'Org',
    min: 26,
    max: 50,
    theme: 'Managing managers',
    ceoJob: 'Design the org, hire executives, and make culture explicit because you can no longer transmit it in person.',
  },
  {
    index: 3,
    name: 'Company',
    min: 51,
    max: 100,
    theme: 'Systems, executives and a board',
    ceoJob: 'Run the company through an exec team and a planning system. Your product is now the organization.',
  },
  {
    index: 4,
    name: 'Scale',
    min: 101,
    max: 500,
    theme: 'Building an institution',
    ceoJob: 'Strategy, capital allocation, the exec team, and the few things only the CEO can do.',
  },
]

export const stageForHeadcount = (headcount: number): Stage =>
  STAGES.find((stage) => headcount <= stage.max) ?? (STAGES[STAGES.length - 1] as Stage)

export const SCENARIOS: Scenario[] = [
  {
    id: 'first-marketing-hire',
    stage: 0,
    topic: 'People',
    title: 'What is the first marketing hire actually for?',
    raisedBy: 'exec',
    kickoff:
      'We keep saying we need "a marketing person" for {product}. Before anyone writes a job post: what is the actual job? Demand gen, content, product marketing, brand, community? Generalist or specialist, full-time or contractor? What would they own in their first 90 days and how would we know it is working?',
    primer:
      'Hire for the bottleneck, not the title. Write the outcomes you need in 30/60/90 days first (a scorecard), then derive the role and level from it. Early on a scrappy generalist who can run experiments usually beats a senior specialist who needs a team and a budget, and a contractor can de-risk the bet before you commit salary and equity.',
    frameworks: ['Role scorecard (the "Who" method)', 'Funnel bottleneck analysis', 'Generalist vs specialist by stage', 'Contract-to-hire'],
    rubric:
      'Names the specific funnel bottleneck the hire fixes, defines measurable 90-day outcomes, picks a level and cost that fit the runway, and says what the founders will stop doing as a result.',
  },
  {
    id: 'icp-positioning',
    stage: 0,
    topic: 'Strategy',
    title: 'Who is this for, exactly?',
    raisedBy: 'exec',
    kickoff:
      'Honest question: if I had to describe the one customer {product} is perfect for, I could not do it in a sentence, and I do not think you would say the same sentence I would. Every prospect call we pitch it differently. Can we pick who we are for and, just as important, who we are not for right now?',
    primer:
      'Positioning is a choice about which customers you win by default. Define an ideal customer profile narrow enough that a salesperson could build a list from it, state the alternative they use today, and the one thing you do better for them. A beachhead you can dominate beats a big market you nibble at.',
    frameworks: ['Ideal customer profile (ICP)', 'Jobs to be done', 'April Dunford positioning', 'Beachhead market (Crossing the Chasm)'],
    rubric:
      'Commits to a specific segment and explicitly excludes others, names the competitive alternative and the differentiated value, and accepts the trade-off instead of keeping every option open.',
  },
  {
    id: 'pricing',
    stage: 0,
    topic: 'Finance',
    title: 'Pricing and packaging',
    raisedBy: 'exec',
    kickoff:
      'We set the {product} price by gut feel and have never revisited it. Two prospects this month said yes without blinking, which usually means we are too cheap. What do we charge for, how do we package it, and are we willing to lose some deals to find out?',
    primer:
      'Price on a value metric that grows as the customer gets more value (seats, usage, outcomes), not on your costs. Good-better-best packaging lets customers self-select. Test willingness to pay by actually quoting higher prices. Price is the fastest lever on unit economics and the one founders touch least.',
    frameworks: ['Value metric', 'Good-better-best packaging', 'Van Westendorp price sensitivity', 'Gross margin and unit economics'],
    rubric:
      'Chooses a value metric with reasoning, proposes a concrete test rather than a debate, considers existing customers and gross margin, and sets a date to review the result.',
  },
  {
    id: 'runway-plan',
    stage: 0,
    topic: 'Finance',
    title: 'Runway and the hiring plan',
    raisedBy: 'exec',
    kickoff:
      'I added up what the hires we have been talking about would cost. If we make all of them, our runway changes a lot. What milestones does the money have to get us to, and which hires are actually on the path to those milestones versus nice to have?',
    primer:
      'Runway is cash divided by net burn, and every hire shortens it. Tie spending to the milestones that unlock the next source of money (revenue or a round), keep a buffer because fundraising takes six months or more, and know whether you are "default alive" on current growth and burn.',
    frameworks: ['Burn rate and runway', 'Default alive vs default dead', 'Milestone-based planning', 'Burn multiple'],
    rubric:
      'Uses the actual cash, burn and runway numbers, sequences hires against milestones, keeps a fundraising buffer, and identifies what gets cut first if growth disappoints.',
  },
  {
    id: 'cofounder-roles',
    stage: 0,
    topic: 'Leadership',
    title: 'Who decides what between founders',
    raisedBy: 'exec',
    kickoff:
      'Can we talk about how you and I make decisions? Last week we both gave a contractor different direction on the same thing. As we add people that gets expensive. I would like us to write down who owns which calls, and what happens when we disagree.',
    primer:
      'Cofounder ambiguity is cheap at two people and corrosive at ten. Assign a single directly responsible individual to each domain, agree which decisions need both of you, and decide in advance how ties break. Discuss it while things are calm.',
    frameworks: ['Directly responsible individual (DRI)', 'RACI / decision rights', 'Type 1 vs Type 2 decisions', 'Disagree and commit'],
    rubric:
      'Gives clear ownership by domain, defines a tie-break, handles the conversation with respect rather than defensiveness, and makes it visible to the rest of the team.',
  },
  {
    id: 'big-customer-custom-work',
    stage: 0,
    topic: 'Sales',
    title: 'The big customer who wants custom work',
    raisedBy: 'sales',
    kickoff:
      'A prospect would become our largest customer by far, maybe a third of revenue, but only if we build a custom integration and a couple of features only they need. It would take roughly two months of engineering. Do we take it?',
    primer:
      'Large early customers validate you and can also turn you into their outsourced dev shop. Weigh revenue concentration, whether the work generalizes to your ICP, and what it displaces on the roadmap. You can often reshape the deal: charge for the work, make it a design partnership, or build the generalizable 60 percent.',
    frameworks: ['Revenue concentration risk', 'Product vs services revenue', 'Opportunity cost', 'Design partner agreements'],
    rubric:
      'Evaluates fit with the chosen ICP and roadmap cost, proposes terms rather than a plain yes or no, and considers concentration risk and what the team is told.',
  },
  {
    id: 'first-manager',
    stage: 1,
    topic: 'Org design',
    title: 'Your first manager: promote or hire?',
    raisedBy: 'engineering',
    kickoff:
      'The team has grown to the point where you cannot be everyone\'s manager anymore, and 1:1s are slipping. Do we promote our strongest individual contributor into the manager job, or hire an experienced manager from outside? People are already speculating.',
    primer:
      'Management is a different job, not a promotion for being great at the old one. A manager\'s output is the output of their team. Promoting from within keeps context and trust but risks losing your best IC and gaining a mediocre manager; hiring outside brings skill but risks rejection by the team. Either way, offer a real IC growth track so management is not the only way up.',
    frameworks: ['High Output Management (manager leverage)', 'Peter principle', 'Dual career ladders', 'Span of control (5-8)'],
    rubric:
      'Treats management as a distinct skill, checks whether the candidate wants it, defines the role and support, protects an IC track, and plans how the choice is communicated.',
  },
  {
    id: 'underperformer',
    stage: 1,
    topic: 'People',
    title: 'The early employee who is not scaling',
    raisedBy: 'product',
    kickoff:
      'This is awkward to raise. One of our earliest people, someone everyone likes, has been missing commitments for a couple of months and others are quietly covering. Nobody has said anything to them directly. What do you want to do?',
    primer:
      'Delay is the most common failure: the team already knows, and your inaction tells them what standards really are. Give direct, specific feedback with clear expectations and a timeframe, look honestly for a role that fits, and if it does not work, part ways generously and quickly. Fair process matters as much to the people watching as to the person involved.',
    frameworks: ['Situation-Behavior-Impact feedback', 'Radical Candor', 'Performance improvement plan', 'Fair process'],
    rubric:
      'Commits to a direct conversation soon, with specific examples and a clear expectation and timeline, considers role fit and generosity, and recognizes the message inaction sends to the team.',
  },
  {
    id: 'okrs-planning',
    stage: 1,
    topic: 'Operations',
    title: 'Everyone is busy, nothing is finishing',
    raisedBy: 'product',
    kickoff:
      'I counted fourteen "top priorities" across the team this quarter. Everyone is flat out and almost nothing shipped end to end. We need some way of deciding what matters for the next three months and what we are explicitly not doing.',
    primer:
      'A plan is mostly a list of things you will not do. Pick one company-level metric that captures value delivered, set three or so objectives with measurable results per quarter, and review them on a fixed cadence. Goals describe outcomes, not task lists, and teams should write their own in response to the company ones.',
    frameworks: ['OKRs', 'North Star metric', 'Quarterly planning cadence', 'Stop-doing list'],
    rubric:
      'Cuts priorities to a small number with measurable outcomes, names what is deprioritized, sets a review cadence, and involves the team in setting goals instead of dictating tasks.',
  },
  {
    id: 'counteroffer',
    stage: 1,
    topic: 'People',
    title: 'A key engineer has an outside offer',
    raisedBy: 'engineering',
    kickoff:
      'One of our strongest engineers told me they have an offer for about 30 percent more. They would rather stay but feel underpaid. If we match it, word will get around. If we do not, we may lose them at a bad time. What is our answer?',
    primer:
      'One-off counteroffers buy a few months and teach everyone that the way to get a raise is to interview. Decide a compensation philosophy (which market percentile, how equity fits), build simple bands by level, and fix people who are genuinely out of band. Then ask why they were looking; it is rarely only money.',
    frameworks: ['Compensation philosophy and bands', 'Pay equity', 'Total compensation (cash + equity)', 'Stay interviews'],
    rubric:
      'Separates the individual case from the systemic one, avoids a panicked match that sets a precedent, proposes bands or a philosophy, and explores the non-money reasons.',
  },
  {
    id: 'first-sales-hire',
    stage: 1,
    topic: 'Sales',
    title: 'From founder-led sales to a sales team',
    raisedBy: 'sales',
    kickoff:
      'Right now most deals close because you personally get on the call. That does not scale, and I am not sure a new rep could repeat what you do. Should we hire salespeople now, and what has to be true first?',
    primer:
      'Hire reps when the founder-led motion is repeatable: a defined ICP, a documented process, known objections and a predictable cycle. Hire two reps, not one, so you can tell rep problems from process problems. Watch CAC payback and the LTV to CAC ratio; a senior sales leader comes after the first reps prove the playbook.',
    frameworks: ['Sales playbook and stages', 'CAC payback', 'LTV:CAC (target 3:1+)', 'Hire reps in pairs'],
    rubric:
      'Checks repeatability before scaling, plans to document the process, sets realistic quota and ramp expectations, and uses unit economics to size the investment.',
  },
  {
    id: 'communication-cadence',
    stage: 1,
    topic: 'Operations',
    title: 'People are finding things out by accident',
    raisedBy: 'people',
    kickoff:
      'Two people told me this week they learned about a decision that affected their work from a customer. When we were six everyone just knew. That is over. What is our operating rhythm: which meetings, what gets written down, and how do decisions get announced?',
    primer:
      'Communication does not scale by osmosis past about ten people. Build a small operating cadence: weekly 1:1s, a weekly leadership meeting with a fixed agenda, a regular all-hands, and written decisions that state what, why and who owns it. Repeat the strategy until you are sick of it; that is about when people start hearing it.',
    frameworks: ['Operating cadence', '1:1s', 'Decision logs / written culture', 'All-hands and AMAs'],
    rubric:
      'Designs a lightweight cadence rather than many meetings, commits to written decisions, clarifies who communicates what, and sees repetition as the CEO\'s job.',
  },
  {
    id: 'org-design',
    stage: 2,
    topic: 'Org design',
    title: 'You have too many direct reports',
    raisedBy: 'people',
    kickoff:
      'You currently have more direct reports than anyone can manage well, and three of them have said they do not get enough of your time. We need an actual org structure. Who reports to you, which functions need a leader, and which leaders do we already have versus need to hire?',
    primer:
      'Structure follows strategy: organize around what the company most needs to be good at. Most companies at this size are functional. Keep your span to about five to eight, be clear whether each leader is a stretch promotion or a hire, and accept that every structure has a cost you must manage on purpose.',
    frameworks: ['Functional vs divisional structure', 'Span of control', 'Structure follows strategy', 'Stretch promotion vs external hire'],
    rubric:
      'Produces a concrete structure tied to strategy, reduces the CEO\'s span, is honest about which leaders are ready, and plans the conversations with people who gain a boss.',
  },
  {
    id: 'hire-executive',
    stage: 2,
    topic: 'People',
    title: 'Hiring your first real executive',
    raisedBy: 'exec',
    kickoff:
      'We agree go-to-market needs a senior leader. The recruiter is sending candidates from much bigger companies with impressive logos. How do we tell who will actually work here, at this size, and how do we avoid a very expensive mistake?',
    primer:
      'Hire for the next 18 months, not the next five years. Big-company executives often managed a machine someone else built; you need someone who can build it. Define the outcomes first, interview for how they did the work and with what resources, do deep backchannel references, and plan their first 90 days. A bad exec hire costs a year.',
    frameworks: ['Stage fit', 'Outcome scorecard', 'Backchannel references', 'Executive onboarding plan'],
    rubric:
      'Defines outcomes before meeting candidates, tests for stage fit and hands-on ability, insists on references, and thinks about integration with existing team members.',
  },
  {
    id: 'brilliant-jerk',
    stage: 2,
    topic: 'Leadership',
    title: 'The high performer who is hurting the team',
    raisedBy: 'people',
    kickoff:
      'Our top performer by output is also the person three colleagues have now complained about: dismissive in reviews, takes credit, people avoid working with them. Their manager is afraid to act because the numbers are so good. Our stated values say we care about how people work together. Do they?',
    primer:
      'Culture is what you tolerate and whom you promote, not what is on the wall. Values only become real when they cost you something. Give the person clear feedback and a short window to change, and be prepared to act; keeping them tells everyone else that results excuse behavior.',
    frameworks: ['Values as hiring and firing criteria', 'Performance x values matrix', 'Psychological safety', 'The No Asshole Rule'],
    rubric:
      'Treats behavior as a performance issue, gives direct feedback with consequences, supports the manager, and is willing to lose the individual to protect the standard.',
  },
  {
    id: 'series-a',
    stage: 2,
    topic: 'Finance',
    title: 'Raising the next round',
    raisedBy: 'finance',
    kickoff:
      'On current burn we should either raise in the next two quarters or change the plan. Investors will ask what the money is for and what it gets us to. What is our story, how much do we raise, and how much of the company are we willing to sell?',
    primer:
      'Raise for 18 to 24 months to reach milestones that justify the next round. Investors buy a narrative backed by metrics: growth, retention, efficiency. Typical priced rounds sell 15 to 25 percent. Run a tight parallel process, know your walk-away terms, and remember a board seat is a long relationship.',
    frameworks: ['Use of funds and milestones', 'Dilution and the cap table', 'Retention and net revenue retention', 'Running a fundraising process'],
    rubric:
      'States a clear narrative with milestones, sizes the round from a plan rather than a wish, understands dilution and control trade-offs, and has a plan B if the raise is slow.',
  },
  {
    id: 'process-vs-speed',
    stage: 2,
    topic: 'Operations',
    title: 'Incidents, quality and "too much process"',
    raisedBy: 'engineering',
    kickoff:
      'We had our third customer-facing incident this month, and each one traced back to nobody clearly owning a handoff. Half the team wants proper process. The other half says process is how startups die. Where do you land?',
    primer:
      'Process is a response to a recurring, expensive problem; add the minimum that prevents the repeat. Give every recurring thing an owner, run blameless postmortems that produce one or two fixes, and prune process regularly. The goal is to keep speed as you grow.',
    frameworks: ['Blameless postmortems', 'DRIs and ownership', 'Minimum viable process', 'Leading vs lagging indicators'],
    rubric:
      'Avoids both extremes, targets process at the specific failure, assigns ownership, and installs a learning loop rather than blame.',
  },
  {
    id: 'board-bad-quarter',
    stage: 3,
    topic: 'Governance',
    title: 'Telling the board about a bad quarter',
    raisedBy: 'finance',
    kickoff:
      'We are going to miss the quarter by a meaningful margin. The board meeting is in three weeks. Do we tell them now or at the meeting, and what do we show them besides the miss?',
    primer:
      'The rule with boards is no surprises: call each director before the meeting. Bring the miss, the diagnosis, what you have already changed and what you need from them. Boards lose confidence in CEOs who do not understand their business or who hide things, far more than in CEOs who miss.',
    frameworks: ['No-surprises rule', 'Board deck structure', 'Root cause vs symptoms', 'Reforecasting'],
    rubric:
      'Communicates early and directly, owns the miss with a real diagnosis, presents a revised plan, and uses the board as a resource rather than an audience.',
  },
  {
    id: 'reforecast-layoffs',
    stage: 3,
    topic: 'Finance',
    title: 'Burn is too high for the growth you have',
    raisedBy: 'finance',
    kickoff:
      'I reran the model with realistic growth. We hired for a plan that is not happening, and at this burn we run short before we can raise on good terms. We need to cut, possibly including people. How do you want to approach it?',
    primer:
      'If a reduction is needed, do it once and deep enough that you do not have to repeat it; serial small cuts destroy trust. Decide from the plan you can fund, be generous with those leaving, tell the truth about why, and then show the remaining team a credible path forward. The CEO owns the message.',
    frameworks: ['Scenario planning (base / downside)', 'Burn multiple', 'Cut once, cut deep', 'Layoff communication'],
    rubric:
      'Starts from a fundable plan, considers non-people cuts, commits to one decisive action, handles departing people generously, and takes personal responsibility in the communication.',
  },
  {
    id: 'exec-conflict',
    stage: 3,
    topic: 'Leadership',
    title: 'Your sales and product leaders are at war',
    raisedBy: 'product',
    kickoff:
      'Sales is promising features to close enterprise deals and escalating to you when product says no. Product says the roadmap is being run by whoever shouted last. Both leaders have asked you to back them. This is now leaking to their teams.',
    primer:
      'Recurring conflict between good executives is usually a strategy or decision-rights gap, not a personality problem. Make the strategic trade-off explicit (which segment, how much roadmap capacity is reserved for deals), define who decides, and require the exec team to act as one team first and function heads second.',
    frameworks: ['Decision rights', 'First-team principle (Lencioni)', 'Strategy as tie-breaker', 'Disagree and commit'],
    rubric:
      'Diagnoses the structural cause, makes the underlying strategic call, sets a clear decision mechanism, and holds both leaders to first-team behavior instead of picking a winner.',
  },
  {
    id: 'manager-quality',
    stage: 3,
    topic: 'People',
    title: 'One department\'s engagement scores are terrible',
    raisedBy: 'people',
    kickoff:
      'The engagement survey is in. One director\'s org is far below the rest and has lost four people in a quarter. The director delivers results and reports to an exec who says everything is fine. You are two levels away from it. What do you do?',
    primer:
      'At this size you manage through managers, so manager quality is your product. Use skip-level meetings to stay connected to reality, hold executives accountable for the health of their orgs as well as output, and invest in manager training and calibration. Intervene through the chain when you can, around it when you must.',
    frameworks: ['Skip-level meetings', 'Manager training and expectations', 'Performance calibration', 'Regretted attrition'],
    rubric:
      'Gathers first-hand information without undermining the exec, holds the exec accountable, sets expectations for managers, and addresses the system as well as the individual.',
  },
  {
    id: 'second-product',
    stage: 3,
    topic: 'Strategy',
    title: 'A second product, or more focus?',
    raisedBy: 'product',
    kickoff:
      'Growth on the core {product} business is slowing a bit and the team has a strong idea for a second product for the same customers. It would take maybe 15 percent of engineering for a year. Others argue we have not finished winning the core market. What is the call?',
    primer:
      'New bets are how you get the next act, and also how you starve the core. Compare adjacent moves by how much they reuse your customers and capabilities, fund exploration as a bounded portfolio with kill criteria, and be honest about whether core growth is slowing because the market is saturated or because execution slipped.',
    frameworks: ['Ansoff matrix', 'Three horizons / 70-20-10', 'Kill criteria', 'Core vs adjacent'],
    rubric:
      'Diagnoses why the core is slowing before deciding, bounds any investment with milestones and kill criteria, and explains the trade-off to the teams who do not get resources.',
  },
  {
    id: 'outgrown-exec',
    stage: 4,
    topic: 'Leadership',
    title: 'A loyal early executive has been outgrown by the job',
    raisedBy: 'people',
    kickoff:
      'One of your earliest leaders, who built their function from nothing, is struggling at this scale. Their peers have noticed and their team is stalling. They are deeply loyal and a culture carrier. Layer them, move them, or part ways?',
    primer:
      'Companies grow faster than most people can. The honest options are a different role that fits, a new boss above them, or a respectful exit. Avoiding the decision punishes their team. Honor the contribution, tell the truth early, and do not let loyalty set the bar for the role.',
    frameworks: ['Role vs person fit', 'Layering', 'Succession planning', 'Honoring founders-era employees'],
    rubric:
      'Decides on the needs of the role, has the direct conversation personally, treats the person with dignity and generosity, and manages the signal to other long-tenured employees.',
  },
  {
    id: 'acquisition-offer',
    stage: 4,
    topic: 'Governance',
    title: 'An acquisition offer arrives',
    raisedBy: 'finance',
    kickoff:
      'A much larger company has made an informal offer to buy us at a meaningful premium to our last round. It is real money for everyone, and it is also less than we believe we could be worth in three years. The board wants your recommendation.',
    primer:
      'You have a duty to consider serious offers and to shareholders as a whole. Compare the offer to a risk-adjusted view of the standalone plan, understand your alternatives, and remember that a process distracts the company and leaks. The best negotiating position is a business that does not need to sell.',
    frameworks: ['BATNA', 'Risk-adjusted valuation', 'Fiduciary duty', 'Strategic alternatives process'],
    rubric:
      'Weighs the offer against a realistic standalone case, considers all stakeholders and the board\'s role, controls information, and reaches a reasoned recommendation rather than an emotional one.',
  },
  {
    id: 'ceo-time',
    stage: 4,
    topic: 'Leadership',
    title: 'What only the CEO can do',
    raisedBy: 'exec',
    kickoff:
      'I audited your calendar for the last month. About 70 percent is recurring meetings and escalations. You spent almost no time with customers, on recruiting senior people, or thinking about next year. What should your job actually be now?',
    primer:
      'At scale the CEO\'s unique jobs are few: set and communicate strategy, allocate capital and people, build the executive team, shape culture, and represent the company outside. Everything else should be delegated with clear outcomes. Audit your calendar against those jobs and delete or delegate the rest.',
    frameworks: ['CEO job description', 'Delegation levels', 'Calendar audit', 'Chief of staff role'],
    rubric:
      'Names the few things only the CEO should do, makes specific delegation decisions with owners, changes the calendar, and resists holding on to comfortable operational work.',
  },
  {
    id: 'hr-investigation',
    stage: 4,
    topic: 'Governance',
    title: 'A serious complaint about a senior leader',
    raisedBy: 'people',
    kickoff:
      'We have received a formal complaint about a senior leader\'s conduct toward someone on their team. The leader is important to a critical project and is a friend of several executives. What happens next, and who needs to know?',
    primer:
      'This is where process protects everyone: follow a consistent, confidential, impartial investigation with legal counsel, protect the complainant from retaliation, and do not prejudge the outcome in either direction. Seniority must not change the process. How you handle it defines whether people believe it is safe to speak up.',
    frameworks: ['Impartial investigation process', 'Non-retaliation', 'Legal counsel and documentation', 'Need-to-know confidentiality'],
    rubric:
      'Insists on an impartial process with counsel, protects the complainant, limits information to those who need it, and refuses to let the leader\'s importance alter the handling.',
  },
  {
    id: 'annual-planning',
    stage: 4,
    topic: 'Strategy',
    title: 'Annual plan and budget',
    raisedBy: 'finance',
    kickoff:
      'Every exec has submitted a headcount request for next year. Added together they are more than double what we can afford. We need a plan and a budget, and a way to say no to good ideas. How do you want to run it?',
    primer:
      'Annual planning is capital allocation: where the next dollar and the next person create the most value. Start from strategy and a top-down financial envelope, let teams propose bottoms-up, then force trade-offs across functions. Judge the plan on growth and efficiency together and keep a reserve for what you learn mid-year.',
    frameworks: ['Top-down envelope, bottoms-up plan', 'Rule of 40', 'Capital allocation', 'Zero-based budgeting'],
    rubric:
      'Sets the envelope from strategy and financial constraints, forces explicit cross-functional trade-offs, balances growth with efficiency, and communicates the reasoning for what is not funded.',
  },
]

export const scenarioById = (id: string) => SCENARIOS.find((scenario) => scenario.id === id)
