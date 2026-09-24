// The 10-step SaaS playbook every idea moves through.
// Idea → Research → Validate → Sell → Build → Measure → Improve → Scale

export type PlaybookStep = {
  step: number
  title: string
  phase: "Idea" | "Research" | "Validate" | "Build" | "Scale"
  summary: string
  checklist: string[]
  gate: string
  output?: string
}

export const PLAYBOOK: PlaybookStep[] = [
  {
    step: 1,
    title: "Capture the idea as a hypothesis",
    phase: "Idea",
    summary:
      "We believe [customer] has [problem] and will pay for [solution] because it produces [measurable outcome].",
    checklist: [
      "Target customer",
      "Problem you believe exists",
      "Proposed solution",
      "Expected customer outcome",
      "Why customers might pay",
      "Why your team can deliver it",
      "Major assumptions that could make it fail",
    ],
    gate: "Is the hypothesis specific enough to test?",
    output: "One-page product hypothesis",
  },
  {
    step: 2,
    title: "Research the market",
    phase: "Research",
    summary:
      "Determine whether the market is real, reachable, and commercially attractive. Separate facts from assumptions and cite every important claim.",
    checklist: [
      "Market size and growth",
      "Customer segments",
      "Industry trends",
      "Existing budgets",
      "Laws and regulatory requirements",
      "Geographic opportunities",
      "Buying behaviour",
      "Market barriers",
      "Relevant technologies",
      "Search and community activity",
    ],
    gate: "Is there enough demand and purchasing power to investigate further?",
  },
  {
    step: 3,
    title: "Research competitors and alternatives",
    phase: "Research",
    summary:
      "Existing successful competitors validate demand. The opportunity lies in what they do poorly, whom they ignore, or what the market has outgrown.",
    checklist: [
      "Direct SaaS competitors",
      "Indirect products and new AI entrants",
      "Agencies, consultants, internal employees",
      "Manual workflows, spreadsheets, doing nothing",
      "Positioning, pricing, onboarding, sales model",
      "Reviews: strengths and common complaints",
      "Why customers leave or refuse to switch",
    ],
    gate: "Is there a clear gap we can exploit?",
    output: "Competitor matrix and opportunity-gap report",
  },
  {
    step: 4,
    title: "Interview potential customers",
    phase: "Validate",
    summary:
      "Interview 10–20 people from the intended segment about past behaviour. Never ask “Would you use my idea?”",
    checklist: [
      "When did the problem last occur?",
      "How do you currently solve it?",
      "How much time or money does it cost?",
      "Which products have you tried — what worked, what frustrated you?",
      "Why have you not switched?",
      "Who approves purchases?",
      "What outcome would justify paying?",
    ],
    gate: "Does the problem occur frequently, cause meaningful pain, and have an identifiable budget?",
  },
  {
    step: 5,
    title: "Define the opportunity and differentiation",
    phase: "Validate",
    summary:
      "Choose one ICP, one problem, one outcome, one competitive weakness, and one defensible advantage. “Human on the Loop” must produce a measurable result, not a slogan.",
    checklist: [
      "One ideal customer profile",
      "One high-priority problem",
      "One primary outcome",
      "One competitive weakness to exploit",
      "One defensible advantage",
    ],
    gate: "Do we have a clear reason for customers to switch?",
    output: "Positioning statement and reason to switch",
  },
  {
    step: 6,
    title: "Validate demand before building",
    phase: "Validate",
    summary:
      "Run the smallest sales experiment and ask for a meaningful commitment: paid pilot, deposit, LOI, onboarding, sample data, or a decision-maker intro.",
    checklist: [
      "Landing page / mock-up / clickable prototype / demo video",
      "Pilot proposal or pricing page",
      "Consultation booking form",
      "Commitments collected (time, data, reputation, money)",
    ],
    gate: "Have several qualified customers committed time, data, reputation, or money?",
  },
  {
    step: 7,
    title: "Scope the smallest valuable product",
    phase: "Build",
    summary:
      "Map the shortest complete journey: Register → Provide input → Core workflow → Receive outcome → Approve or act → Return.",
    checklist: [
      "Build now: necessary to produce the outcome",
      "Perform manually: human team handles it initially",
      "Integrate: use an established service",
      "Build later: valuable but unnecessary for validation",
      "Remove: unconnected to customer value",
    ],
    gate: "Is the MVP spec complete with clear acceptance criteria?",
    output: "MVP specification with acceptance criteria",
  },
  {
    step: 8,
    title: "Build and launch the MVP",
    phase: "Build",
    summary: "Build in roughly 2–6 weeks with only essential foundations, then release to a small controlled group.",
    checklist: [
      "Authentication and access controls",
      "Core workflow",
      "Payments or pilot billing",
      "Admin controls, analytics, error monitoring",
      "Customer support and feedback collection",
      "Human-review workflow",
    ],
    gate: "Can a real customer receive the promised outcome through the product?",
  },
  {
    step: 9,
    title: "Sell, onboard, and improve weekly",
    phase: "Scale",
    summary:
      "Personally onboard the first 10–20 customers. Every week: interview users, fix the biggest obstacle, ship one improvement, measure behaviour change.",
    checklist: [
      "Qualified leads and conversion rate",
      "Activation rate and time to first value",
      "Retention (weekly / monthly)",
      "Paid conversion, MRR, churn",
      "Human-review frequency",
      "Cost to serve each customer",
    ],
    gate: "Are customers repeatedly using, paying for, and recommending the product?",
  },
  {
    step: 10,
    title: "Standardize and scale",
    phase: "Scale",
    summary:
      "Scale only with evidence of retention and repeatable sales. Document the machine, then invest in marketing, sales, partnerships, and new markets.",
    checklist: [
      "ICP, lead channels, sales script, demo process",
      "Onboarding and human-review criteria",
      "Support, analytics, security, incident procedures",
    ],
    gate: "Is there evidence of retention and repeatable sales?",
  },
]

export const BUILD_STEP = 8

export function stepInfo(step: number) {
  return PLAYBOOK[Math.min(Math.max(step, 1), 10) - 1]
}
