import "server-only"

import { z } from "zod"

import { PLAYBOOK } from "@/lib/playbook"

import { generateObject, generateText } from "./client"

const COMPANY_CONTEXT = `3rdLoop Solutions is an early-stage company run by a small founding team.
Its positioning is "Human on the Loop": automated SaaS speed combined with accountable human oversight
wherever accuracy, judgment, or trust matters. It sells AI tooling to businesses, enterprise CRM
implementations, and SaaS products.`

// ---------------------------------------------------------------------------
// Idea questions
// ---------------------------------------------------------------------------

export type IdeaForQuestions = {
  title: string
  target_customer: string | null
  problem: string | null
  solution: string | null
  outcome: string | null
  why_pay: string | null
  why_us: string | null
  assumptions: string | null
}

const QuestionSet = z.object({
  stages: z.array(
    z.object({
      stage: z.number().int().min(1).max(10),
      questions: z.array(z.string()),
    })
  ),
})

export async function generateIdeaQuestions(idea: IdeaForQuestions, stages: number[], existing: string[] = []) {
  const steps = PLAYBOOK.filter((s) => stages.includes(s.step))
    .map((s) => `Step ${s.step} — ${s.title}\n${s.summary}\nCovers: ${s.checklist.join("; ")}\nGate: ${s.gate}`)
    .join("\n\n")

  const result = await generateObject({
    name: "idea_questions",
    schema: QuestionSet,
    system: `${COMPANY_CONTEXT}

You are a skeptical startup advisor. Founders must answer your questions before an idea
can advance through their 10-step playbook, so every question has to earn its place:
it should expose a risky assumption, demand evidence, or force a concrete decision.
Prefer questions about past customer behaviour, numbers, and named sources over opinions.
Never ask "would customers use this?".`,
    prompt: `Idea: ${idea.title}
Target customer: ${idea.target_customer ?? "unspecified"}
Problem: ${idea.problem ?? "unspecified"}
Proposed solution: ${idea.solution ?? "unspecified"}
Expected outcome: ${idea.outcome ?? "unspecified"}
Why customers might pay: ${idea.why_pay ?? "unspecified"}
Why our team can deliver: ${idea.why_us ?? "unspecified"}
Known assumptions: ${idea.assumptions ?? "unspecified"}

Write 3–5 questions specific to THIS idea for each of these playbook steps:

${steps}
${existing.length ? `\nThe founders already have these questions — do not repeat them:\n- ${existing.join("\n- ")}` : ""}

Return one entry per step listed above.`,
  })

  return result.stages.filter((s) => stages.includes(s.stage))
}

const AnswerDraft = z.object({
  draft: z.string(),
  how_to_verify: z.array(z.string()).max(4),
})

/** Drafts an answer to one playbook question, marking unknowns instead of inventing facts. */
export async function draftIdeaAnswer({
  idea,
  stepTitle,
  question,
  answered,
}: {
  idea: IdeaForQuestions
  stepTitle: string
  question: string
  answered: { question: string; answer: string }[]
}) {
  return generateObject({
    name: "answer_draft",
    schema: AnswerDraft,
    system: `${COMPANY_CONTEXT}
3rdLoop sells in ${MARKET}.

You help founders answer hard validation questions about their idea. Write a draft answer
they can edit: specific, plain English, 2–5 sentences or a short list. Use what the founders
already wrote. Never invent facts, statistics, customer quotes, or sources: where evidence is
needed, write a placeholder in square brackets such as [number of clinics interviewed] or
[source]. Then list up to 4 concrete ways to verify or fill in the answer (who to ask, what to
measure, where to look), favouring evidence available in ${MARKET}.`,
    prompt: `Idea: ${idea.title}
Target customer: ${idea.target_customer ?? "unspecified"}
Problem: ${idea.problem ?? "unspecified"}
Solution: ${idea.solution ?? "unspecified"}
Outcome: ${idea.outcome ?? "unspecified"}
Why customers might pay: ${idea.why_pay ?? "unspecified"}
Why our team: ${idea.why_us ?? "unspecified"}
Assumptions: ${idea.assumptions ?? "unspecified"}

${answered.length ? `What the founders have already answered:\n${answered.map((a) => `- Q: ${a.question}\n  A: ${a.answer}`).join("\n")}\n\n` : ""}Playbook step: ${stepTitle}
Question to answer: ${question}`,
  })
}

export const JevAnalysis = z.object({
  summary: z.string(),
  options: z.array(z.object({ option: z.string(), pros: z.array(z.string()), cons: z.array(z.string()) })).max(4),
  risks: z
    .array(z.object({ risk: z.string(), likelihood: z.enum(["low", "medium", "high"]), mitigation: z.string() }))
    .max(5),
  missing_evidence: z.array(z.string()).max(5),
  questions_to_resolve: z.array(z.string()).max(5),
  recommendation: z.object({
    stance: z.enum(["approve", "reject", "defer"]),
    confidence: z.enum(["low", "medium", "high"]),
    reasoning: z.string(),
  }),
})
export type JevAnalysis = z.infer<typeof JevAnalysis>

/** Jev: a candid, evidence-first advisor for a founders' decision. */
export async function analyzeDecision(context: string, focus?: string) {
  return generateObject({
    name: "jev_analysis",
    schema: JevAnalysis,
    system: `You are Jev, the decision advisor for the founders of 3rdLoop Solutions.
${COMPANY_CONTEXT}
3rdLoop operates in ${MARKET}; amounts are in Philippine pesos (₱).

Your job is to make the founders' decision better, not to make it for them. Be candid and specific:
- Summarise what is actually being decided in one or two sentences.
- Lay out the realistic options (including "do nothing" or "defer" when relevant) with concrete pros and cons.
- Name the biggest risks, how likely they are, and a practical mitigation for each.
- Say what evidence is missing and which questions must be answered before deciding.
- Give a recommendation (approve, reject, or defer) with your confidence and reasoning.
Ground everything in the context provided. Never invent facts, numbers, or customer statements;
when something is unknown, say so and put it under missing evidence. Follow the company's playbook
principles: research before building, customer commitment before assuming demand.`,
    prompt: `${context}${focus ? `\n\nThe founders asked Jev to focus on: ${focus}` : ""}`,
  })
}

// ---------------------------------------------------------------------------
// Document drafting
// ---------------------------------------------------------------------------

export async function draftDocument({
  instructions,
  title,
  currentHtml,
  mode,
}: {
  instructions: string
  title: string
  currentHtml: string
  mode: "replace" | "append"
}) {
  const html = await generateText({
    system: `${COMPANY_CONTEXT}

You draft internal business documents: sales scripts, outreach sequences, proposals,
research briefs, SOPs. Write clear, specific, plain English. Use placeholders like
{{Company}} where details are unknown rather than inventing facts.

Output ONLY an HTML fragment using these tags: h1, h2, h3, p, ul, ol, li, strong, em,
blockquote, table, thead, tbody, tr, th, td, hr, a. No <html>, <body>, markdown, or code fences.`,
    prompt: `Document title: ${title || "Untitled"}

${currentHtml.trim() ? `Current document content:\n${currentHtml}\n\n` : ""}${
      mode === "append"
        ? "Write a new section to add at the end of the document (do not repeat existing content)."
        : "Write the complete document."
    }

Instructions: ${instructions}`,
  })
  return html
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim()
}

// ---------------------------------------------------------------------------
// Lead generation
// ---------------------------------------------------------------------------

// 3rdLoop sells only to businesses operating in the Philippines.
export const MARKET = "the Philippines"

export const SEGMENT_BRIEFS: Record<string, string> = {
  ai_tooling:
    "Philippine businesses with manual, repetitive, document- or communication-heavy workflows that AI tooling with human review could automate (e.g. clinics, logistics and freight forwarders, BPO support teams, law and accounting firms, real estate brokerages, e-commerce sellers).",
  enterprise_crm:
    "Mid-market and enterprise companies in the Philippines with complex sales processes, legacy or fragmented CRM setups, or signs of CRM migration/implementation needs (e.g. banks, insurers, developers, distributors).",
  saas: "Small and mid-size Philippine businesses likely to buy a SaaS subscription for workflow automation, especially teams showing growth, hiring, or tooling pain.",
  other: "Businesses in the Philippines that match the search description.",
}

// What 3rdLoop sells. A company that sells any of this is a competitor, never a lead.
const VENDOR_CATEGORIES =
  "AI tools or agents, chatbots, automation, CRM software or CRM implementation, SaaS products, software development, IT services, digital/marketing agencies, or consultancies that offer these"

const SearchPlan = z.object({
  customer_type: z.string(),
  queries: z.array(z.string()).min(1).max(3),
})

/**
 * Turns a founder's description ("dental clinics that need AI intake") into web
 * searches for the customer businesses themselves, not for vendors selling the solution.
 */
export async function planLeadSearch(query: string, segment: string) {
  const plan = await generateObject({
    name: "lead_search_plan",
    schema: SearchPlan,
    system: `${COMPANY_CONTEXT}

You turn a founder's description of ideal customers into web search queries that find
those CUSTOMER businesses' own websites — the companies that would BUY from 3rdLoop.
3rdLoop sells only in ${MARKET}: every query must target businesses located there. Name a
Philippine city or region (e.g. Makati, BGC Taguig, Quezon City, Pasig, Cebu City, Davao,
Iloilo, Cagayan de Oro) or "Philippines" in every query, even if the founder named another country.

Critical: the description often mentions what 3rdLoop sells ("need AI", "CRM", "automation").
Never put those solution words in the queries — searching for them returns vendors that SELL
${VENDOR_CATEGORIES}. Search for the kind of business, what it does, and where it is instead.

Write 2–3 short queries, like a person typing into a search engine. Plain words only: no search
operators, quotes, or minus signs (exclusions are added automatically).`,
    prompt: `Founder's description: "${query}"
Target profile: ${SEGMENT_BRIEFS[segment] ?? SEGMENT_BRIEFS.other}

Example: "dental clinics that still take bookings by phone and need AI" →
customer_type "dental clinics in Metro Manila",
queries ["dental clinic Makati appointment", "dental clinic Quezon City Philippines"]`,
  })
  return { ...plan, queries: plan.queries.map((q) => `${stripOperators(q)} ${LEAD_EXCLUSIONS}`) }
}

// Keeps vendor, job, and directory pages out of prospect searches.
const LEAD_EXCLUSIONS = '-software -agency -"AI solutions" -CRM -consulting -jobs -directory'

const LeadAnalysis = z.object({
  leads: z.array(
    z.object({
      source_url: z.string(),
      company_name: z.string(),
      website: z.string(),
      industry: z.string(),
      location: z.string(),
      summary: z.string(),
      relationship: z.enum(["prospect", "vendor", "outside_market", "not_a_company"]),
      pain_signals: z.array(z.string()),
      suggested_offer: z.string(),
      fit_score: z.number().int().min(0).max(100),
    })
  ),
})

export async function analyzeLeads(
  pages: { url: string; title?: string; markdown: string }[],
  query: string,
  segment: string,
  customerType?: string
) {
  const corpus = pages
    .map((p, i) => `<page index="${i}" url="${p.url}" title="${p.title ?? ""}">\n${p.markdown}\n</page>`)
    .join("\n\n")

  const result = await generateObject({
    name: "lead_analysis",
    schema: LeadAnalysis,
    system: `${COMPANY_CONTEXT}

You qualify sales leads from crawled website content. A lead is a business that could BUY
from 3rdLoop. Classify every page's company:
- "prospect": an operating business in ${MARKET} in the target market that would use these services
  (for example a clinic, logistics firm, law practice, retailer, manufacturer).
- "outside_market": a real business, but not located or operating in ${MARKET}. 3rdLoop only
  sells in ${MARKET}; use the address, phone prefix (+63), city names, or .ph domain as evidence.
- "vendor": a company that itself SELLS ${VENDOR_CATEGORIES}. These are competitors, never leads,
  even if they serve the same industry (for example "AI receptionist for dentists" is a vendor).
- "not_a_company": directories, listicles, articles, marketplaces, job boards, or aggregator pages.

For prospects only: base every claim on the page text and write "Unknown" when not stated.
Pain signals must be concrete observations from the page (e.g. "new-patient requests only via
phone during office hours", "hiring 3 data-entry clerks"). Score fit 0–100 for how much this
business would benefit from what 3rdLoop sells. For vendors and non-companies use fit 0,
empty pain signals, and an empty suggested offer.`,
    prompt: `Founder's search: "${query}"${customerType ? `\nLooking for: ${customerType}` : ""}
Target profile: ${SEGMENT_BRIEFS[segment] ?? SEGMENT_BRIEFS.other}

Analyse each page and return one entry per page.

${corpus}`,
  })

  return {
    prospects: result.leads.filter((l) => l.relationship === "prospect"),
    vendors: result.leads.filter((l) => l.relationship === "vendor").length,
    outsideMarket: result.leads.filter((l) => l.relationship === "outside_market").length,
    skipped: result.leads.filter((l) => l.relationship === "not_a_company").length,
  }
}

// ---------------------------------------------------------------------------
// Problem research
// ---------------------------------------------------------------------------

const ProblemSearchPlan = z.object({ queries: z.array(z.string()).min(1).max(3) })

/** Plans searches that surface people complaining about a problem (not vendors selling fixes). */
const PROBLEM_EXCLUSIONS = '-"free trial" -pricing -software'

export async function planProblemSearch(topic: string) {
  const plan = await generateObject({
    name: "problem_search_plan",
    schema: ProblemSearchPlan,
    system: `You research real customer problems for founders in ${MARKET}.
Write 2–3 short web search queries phrased the way a frustrated person would describe the problem
(for example "clinic never replies to messages" rather than "after-hours answering service"), to find
people describing it in their own words:
forum threads, Reddit posts (e.g. r/Philippines, r/phinvest, r/PHJobs, r/buhaydigital), Facebook group
discussions, app or Google reviews, and news about the pain. Prefer Philippine sources and phrasing
(English or Taglish). Avoid queries that return vendors or product pages. Plain words only: no
search operators, quotes, or minus signs (exclusions are added automatically).`,
    prompt: `Idea or problem to research: ${topic}`,
  })
  // Aim the searches at places people complain in their own words, not at vendors' marketing pages.
  const [first, second = first] = plan.queries.map(stripOperators)
  return {
    queries: [
      `${first} site:reddit.com`,
      `${second} site:reddit.com`,
      `${first} complaints OR reviews OR forum ${PROBLEM_EXCLUSIONS}`,
    ],
  }
}

function normaliseUrl(url: string) {
  try {
    const u = new URL(url.trim())
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase()
  } catch {
    return url.trim().toLowerCase()
  }
}

/** Models sometimes emit dangling operators; exclusions are appended in code instead. */
function stripOperators(query: string) {
  return query
    .replace(/\s-\S*/g, " ")
    .replace(/\s+-$/, "")
    .replace(/\s+/g, " ")
    .trim()
}

const FoundProblems = z.object({
  problems: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        who_has_it: z.string(),
        evidence: z.string(),
        source_url: z.string(),
        source_type: z.enum(["reddit", "forum", "review", "social", "other"]),
        frequency: z.number().int().min(1).max(5),
        severity: z.number().int().min(1).max(5),
        willingness_to_pay: z.number().int().min(1).max(5),
      })
    )
    .max(10),
})

/** Extracts concrete, evidenced problems from crawled pages. */
export async function extractProblems(topic: string, pages: { url: string; title?: string; markdown: string }[]) {
  const corpus = pages
    .map((p, i) => `<page index="${i}" url="${p.url}" title="${p.title ?? ""}">\n${p.markdown}\n</page>`)
    .join("\n\n")
  const result = await generateObject({
    name: "found_problems",
    schema: FoundProblems,
    system: `${COMPANY_CONTEXT}
You mine real problems from web pages for founders working in ${MARKET}.

Only report a problem when a page shows a real person or business experiencing it. For each:
- title: the problem in one sentence, from the sufferer's point of view (not a solution).
- description: what happens, how often, and the consequence, based on the page.
- who_has_it: the specific kind of person or business.
- evidence: a short VERBATIM excerpt (max ~40 words) copied from the page or snippet. Never paraphrase
  or invent. Some sources are search snippets (a sentence or two from a Reddit thread or forum post):
  those count as first-hand evidence when the author describes their own experience.
- source_url: the url of the page it came from.
- frequency, severity, willingness_to_pay: 1–5 estimates from the evidence (3 when unclear).
Also include closely related pains the same kind of customer describes (e.g. for "clinics not
replying", also hard-to-book appointments or no way to reach the clinic); start their description
with "Related:". Skip vendor marketing, generic listicles, and unrelated topics. Merge duplicates.
Return an empty list only if the sources contain no first-hand pain at all.`,
    prompt: `Topic: ${topic}\n\n${corpus}`,
  })
  // Keep only problems whose source is one of the given pages, so every quote can be checked.
  // Models often trim query strings, trailing slashes, or "www", so compare normalised URLs.
  const bySource = new Map(pages.map((p) => [normaliseUrl(p.url), p]))
  return result.problems.flatMap((p) => {
    const source = bySource.get(normaliseUrl(p.source_url))
    return source ? [{ ...p, source_url: source.url, source_title: source.title ?? "" }] : []
  })
}

// ---------------------------------------------------------------------------
// Surveys
// ---------------------------------------------------------------------------

const SurveyDraft = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      kind: z.enum(["text", "long_text", "single", "multi", "scale"]),
      options: z.array(z.string()),
      required: z.boolean(),
    })
  ),
})

export async function draftSurveyQuestions({ goal, audience }: { goal: string; audience: string }) {
  const result = await generateObject({
    schema: SurveyDraft,
    system: `${COMPANY_CONTEXT}

You design customer-discovery surveys following the playbook rule: ask about past behaviour,
current solutions, cost of the problem, who approves purchases, and what outcome would justify
paying. Never ask hypothetical "would you use/buy" questions. 6–10 questions. Use "scale" for
1–5 ratings (options empty), "single"/"multi" with 3–6 options, "text"/"long_text" otherwise.`,
    prompt: `Survey goal: ${goal}\nAudience: ${audience}`,
  })
  return result.questions
}

// ---------------------------------------------------------------------------
// Problem hunter
// ---------------------------------------------------------------------------

const ProblemToIdea = z.object({
  title: z.string(),
  target_customer: z.string(),
  problem: z.string(),
  solution: z.string(),
  outcome: z.string(),
  why_pay: z.string(),
  why_us: z.string(),
  assumptions: z.string(),
})

export async function problemToHypothesis(problem: {
  title: string
  description: string | null
  who_has_it: string | null
}) {
  return generateObject({
    schema: ProblemToIdea,
    system: `${COMPANY_CONTEXT}\nTurn an observed customer problem into a one-page product hypothesis (playbook step 1). Be concrete and measurable; list the riskiest assumptions honestly.`,
    prompt: `Problem: ${problem.title}\nDetails: ${problem.description ?? "—"}\nWho has it: ${problem.who_has_it ?? "—"}`,
  })
}
