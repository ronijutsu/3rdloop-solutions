// Seeds realistic demo data across every module (Philippine market, amounts in ₱).
// All companies and people are fictional. Run after the demo users exist:
//   pnpm db:seed            (users + data; skips data if already seeded)
//   pnpm db:seed -- --reset (removes the demo data first)
import { createClient } from "@supabase/supabase-js"

import { DEMO_USERS } from "../src/lib/demo-users.ts"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (e.g. in .env.local).")
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// Every seeded idea carries this marker so the data can be found and removed again.
const MARKER = "[demo]"

/** Awaits a Supabase query and throws with context on error. Inserts without .select() resolve to null. */
async function must<T>(
  query: PromiseLike<{ data: T; error: { message: string } | null }>,
  what: string
): Promise<NonNullable<T>> {
  const { data, error } = await query
  if (error) throw new Error(`${what}: ${error.message}`)
  return data as NonNullable<T>
}

// Local calendar dates (toISOString() would shift to UTC, e.g. the 1st becomes the 31st in UTC+8).
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return ymd(d)
}
const monthStart = (offset: number) => {
  const d = new Date()
  return ymd(new Date(d.getFullYear(), d.getMonth() + offset, 1))
}

// ---------------------------------------------------------------------------

const { data: profiles } = await db.from("profiles").select("id, email, full_name")
const idOf = (email: string) => {
  const p = profiles?.find((x) => x.email === email)
  if (!p) throw new Error(`Missing demo user ${email}. Run the user seed first.`)
  return p.id
}
for (const u of DEMO_USERS) idOf(u.email)
const admin = idOf("admin@3rdloop.demo")
const fiona = idOf("founder@3rdloop.demo")
const sam = idOf("cofounder@3rdloop.demo")
const maya = idOf("member@3rdloop.demo")

const { data: existing } = await db.from("ideas").select("id").like("assumptions", `%${MARKER}%`)

const DEMO_FOLDERS = ["Interviews", "Pitch & proposals", "Research", "Contracts"]
const DEMO_DOCUMENTS = ["Pilot proposal: Maginhawa Dental Group", "Interview notes: clinic managers"]

/** Removes only rows this script created (marked with MARKER or known demo names). */
async function removeDemoData() {
  const ideaIds = (existing ?? []).map((i) => i.id)
  const { data: files } = await db.from("uploads").select("storage_path").like("storage_path", "demo/%")
  if (files?.length) await db.storage.from("documents").remove(files.map((f) => f.storage_path))
  await db.from("uploads").delete().like("storage_path", "demo/%")
  // Children first; folders the team has since filled are left alone (delete is restricted).
  for (const name of DEMO_FOLDERS) await db.from("file_folders").delete().eq("name", name).eq("created_by", admin)
  await db.from("budgets").delete().like("notes", `%${MARKER}%`)
  await db.from("decisions").delete().like("options_considered", `%${MARKER}%`)
  await db.from("projects").delete().like("description", `%${MARKER}%`)
  await db.from("projects").delete().in("idea_id", ideaIds).like("name", "% — MVP")
  await db.from("documents").delete().in("title", DEMO_DOCUMENTS).in("idea_id", ideaIds)
  await db.from("problems").delete().like("description", `%${MARKER}%`)
  await db.from("surveys").delete().like("description", `%${MARKER}%`)
  await db.from("ideas").delete().in("id", ideaIds)
  await db.from("deals").delete().like("notes", `%${MARKER}%`)
  await db.from("contacts").delete().like("notes", `%${MARKER}%`)
  await db.from("companies").delete().like("notes", `%${MARKER}%`)
  await db.from("leads").delete().like("summary", `%${MARKER}%`)
  await db.from("roadmap_items").delete().like("description", `%${MARKER}%`)
  await db.from("objectives").delete().like("description", `%${MARKER}%`)
  await db.from("network_contacts").delete().like("notes", `%${MARKER}%`)
  await db.from("resources").delete().like("description", `%${MARKER}%`)
  await db.from("transactions").delete().like("description", `%${MARKER}%`)
  await db.from("content_items").delete().like("body", `%${MARKER}%`)
}

if (existing?.length) {
  if (!process.argv.includes("--reset")) {
    console.log("Demo data already present. Use --reset to recreate it.")
    process.exit(0)
  }
  console.log("Removing previous demo data…")
  await removeDemoData()
}

// ---------------------------------------------------------------------------
// Ideas and the playbook
// ---------------------------------------------------------------------------

type Q = { stage: number; question: string; answer?: string; by?: string; source?: "ai" | "founder" }

async function seedIdea(
  idea: Record<string, string | number>,
  questions: Q[],
  stage: number,
  reviews: { stage: number; verdict: string; notes: string; by: string }[]
) {
  const row = await must(
    db
      .from("ideas")
      .insert({ ...idea, stage: 1, created_by: idea.created_by })
      .select("id")
      .single(),
    "idea"
  )
  const rows = questions.map((q, i) => ({
    idea_id: row.id,
    stage: q.stage,
    question: q.question,
    answer: q.answer ?? null,
    source: q.source ?? "ai",
    position: i,
    created_by: idea.created_by,
  }))
  const inserted = await must(db.from("idea_questions").insert(rows).select("id, answer"), "questions")
  // The answer trigger stamps the session user (none here), so attribute answers afterwards.
  for (const [i, q] of inserted.entries()) {
    if (q.answer)
      await db
        .from("idea_questions")
        .update({ answered_by: questions[i].by ?? fiona })
        .eq("id", q.id)
  }
  // Advance one step at a time so the database gate (and the Build → project trigger) run for real.
  for (let s = 2; s <= stage; s++) await must(db.from("ideas").update({ stage: s }).eq("id", row.id), `advance to ${s}`)
  if (reviews.length) {
    await must(
      db.from("idea_stage_reviews").insert(
        reviews.map((r) => ({
          idea_id: row.id,
          stage: r.stage,
          verdict: r.verdict,
          notes: r.notes,
          created_by: r.by,
        }))
      ),
      "reviews"
    )
  }
  return row.id
}

const dental = await seedIdea(
  {
    title: "AI intake assistant for Metro Manila dental clinics",
    target_customer: "Dental clinics with 2–10 branches in Metro Manila",
    problem: "New-patient calls and Messenger inquiries after clinic hours go unanswered, so patients book elsewhere",
    solution: "An AI receptionist on phone and Messenger that books appointments, with staff reviewing every booking",
    outcome: "Recover at least 20% of after-hours inquiries as booked appointments",
    why_pay:
      "Each new patient is worth ₱8,000–₱25,000 in first-year treatment; a part-time night receptionist costs more",
    why_us: "We have built booking automations before and can run the human-review desk ourselves at the start",
    assumptions: `Clinics trust AI with patient messages if a human confirms. Patients accept Messenger booking. ${MARKER}`,
    created_by: fiona,
  },
  [
    {
      stage: 1,
      question: "Which clinics exactly: how many branches, and who decides on tools?",
      answer:
        "2–10 branch groups in Makati, Pasig, and Quezon City. The owner-dentist or operations manager decides; office managers influence.",
    },
    {
      stage: 1,
      question: "Is the hypothesis specific enough to test?",
      answer: "Yes: 'recover 20% of after-hours inquiries as bookings' is measurable from Messenger and call logs.",
      source: "founder",
    },
    {
      stage: 2,
      question: "How many dental clinic groups of this size operate in Metro Manila?",
      answer:
        "Working estimate: [number] from PDA member listings and Google Maps counts in 5 cities. Needs verification.",
      by: sam,
    },
    {
      stage: 2,
      question: "Do clinics already pay for front-desk or messaging tools?",
      answer:
        "7 of 9 clinics we spoke to pay for a clinic-management system; 3 pay a virtual assistant for Messenger replies.",
      by: sam,
    },
    {
      stage: 2,
      question: "Is there enough demand and purchasing power to investigate further?",
      answer: "Yes. Budget exists (VA spend of ₱15–25k/month) and the problem showed up in every interview.",
      source: "founder",
    },
    {
      stage: 3,
      question: "Which tools do clinics use today, and what do they complain about?",
      answer:
        "Clinic-management systems handle schedules but not inquiries. Generic chatbots give wrong prices; staff distrust them.",
    },
    {
      stage: 3,
      question: "Is there a clear gap we can exploit?",
      answer: "Yes: nobody offers booking with a human reviewer who fixes AI mistakes before the patient sees them.",
      source: "founder",
    },
    {
      stage: 4,
      question: "When did the clinic last lose a patient because nobody replied after hours?",
      answer: "4 of 6 interviewed clinics could name a lost patient from the past two weeks.",
      by: maya,
    },
    { stage: 4, question: "Who approves spending on a tool like this, and what budget line would it come from?" },
    {
      stage: 4,
      question: "Does the problem occur frequently, cause meaningful pain, and have an identifiable budget?",
    },
    { stage: 5, question: "Which one competitive weakness will we exploit?" },
    { stage: 6, question: "Which three clinics would commit to a paid two-week pilot?" },
    { stage: 7, question: "What is the smallest workflow that still books a real appointment?" },
    { stage: 8, question: "Can a real clinic receive the promised outcome through the product?" },
    { stage: 9, question: "Are clinics repeatedly using, paying for, and recommending the product?" },
    { stage: 10, question: "Is there evidence of retention and repeatable sales?" },
  ],
  4,
  [
    { stage: 1, verdict: "go", notes: "Clear, measurable hypothesis.", by: fiona },
    { stage: 2, verdict: "go", notes: "Clinics already spend on VAs for this.", by: sam },
    { stage: 3, verdict: "go", notes: "Gap: human review of AI bookings.", by: fiona },
  ]
)

const freight = await seedIdea(
  {
    title: "Human-reviewed invoice processing for freight forwarders",
    target_customer: "Freight forwarders and customs brokers in Manila and Cebu with 10–80 staff",
    problem: "Staff re-type supplier invoices and bills of lading into accounting and customs systems every day",
    solution: "AI extraction of invoice and BL data, checked by a reviewer before posting",
    outcome: "Cut manual encoding time by half with no increase in errors",
    why_pay: "Encoders cost ₱18–25k/month each and errors cause customs penalties",
    why_us: "One founder ran operations at a forwarder for five years",
    assumptions: `Forwarders will share documents with a third party. ${MARKER}`,
    created_by: sam,
  },
  [
    {
      stage: 1,
      question: "Is the hypothesis specific enough to test?",
      answer: "Yes: halve encoding time, measured on one team's weekly volume.",
      source: "founder",
      by: sam,
    },
    { stage: 2, question: "How many forwarders of this size are accredited in Manila and Cebu?" },
    { stage: 2, question: "Is there enough demand and purchasing power to investigate further?" },
    { stage: 3, question: "Is there a clear gap we can exploit?" },
    {
      stage: 4,
      question: "Does the problem occur frequently, cause meaningful pain, and have an identifiable budget?",
    },
    { stage: 5, question: "Do we have a clear reason for customers to switch?" },
    { stage: 6, question: "Have several qualified customers committed time, data, reputation, or money?" },
    { stage: 7, question: "Is the MVP spec complete with clear acceptance criteria?" },
    { stage: 8, question: "Can a real customer receive the promised outcome through the product?" },
    { stage: 9, question: "Are customers repeatedly using, paying for, and recommending the product?" },
    { stage: 10, question: "Is there evidence of retention and repeatable sales?" },
  ],
  2,
  [{ stage: 1, verdict: "go", notes: "Strong operator insight.", by: sam }]
)

const crmIdea = await seedIdea(
  {
    title: "CRM migration service for Cebu insurance agencies",
    target_customer: "Insurance agencies in Cebu with 5–30 agents running on spreadsheets",
    problem: "Renewals are missed because client and policy data lives in scattered spreadsheets",
    solution: "Fixed-price CRM migration with automated renewal reminders, cleaned data reviewed by our team",
    outcome: "No missed renewals in the first 90 days after migration",
    why_pay: "One missed commercial renewal costs more than the migration fee",
    why_us: "We have migrated CRMs for three agencies already",
    assumptions: `Agencies will pay a one-time fee plus a small monthly retainer. ${MARKER}`,
    created_by: fiona,
  },
  Array.from({ length: 10 }, (_, i) => i + 1).flatMap((stage) =>
    stage <= 7
      ? [
          {
            stage,
            question: [
              "Is the hypothesis specific enough to test?",
              "Is there enough demand and purchasing power to investigate further?",
              "Is there a clear gap we can exploit?",
              "Does the problem occur frequently, cause meaningful pain, and have an identifiable budget?",
              "Do we have a clear reason for customers to switch?",
              "Have several qualified customers committed time, data, reputation, or money?",
              "Is the MVP spec complete with clear acceptance criteria?",
            ][stage - 1],
            answer: [
              "Yes: zero missed renewals in 90 days is measurable from the policy list.",
              "Yes: 40+ agencies in Metro Cebu fit the profile; most use spreadsheets.",
              "Yes: big CRM vendors don't do the data clean-up; freelancers don't handle renewals.",
              "Yes: every agency interviewed missed at least one renewal last quarter; owners control budget.",
              "Fixed price, done in two weeks, renewals guaranteed tracked.",
              "Yes: two agencies paid a ₱15,000 deposit for the pilot.",
              "Yes: migration checklist, renewal reminders, and weekly review report agreed with pilots.",
            ][stage - 1],
            source: "founder" as const,
          },
        ]
      : [{ stage, question: `Step ${stage} validation question`, source: "founder" as const }]
  ),
  8,
  [
    { stage: 6, verdict: "go", notes: "Two paid deposits collected.", by: fiona },
    { stage: 7, verdict: "go", notes: "MVP spec agreed with both pilot agencies.", by: sam },
  ]
)
console.log("ideas ✓ (the Build-stage idea opened its MVP project automatically)")

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------

await must(
  db.from("problems").insert([
    {
      title: "Clinic inquiries on Messenger go unanswered overnight",
      description: `Patients message clinics at night and book with whoever replies first. ${MARKER}`,
      who_has_it: "Multi-branch dental and derma clinics in Metro Manila",
      evidence: "“Pag walang sumagot sa Messenger, lipat na lang ako sa ibang clinic.” (interview, patient)",
      source_type: "interview",
      frequency: 5,
      severity: 4,
      willingness_to_pay: 4,
      status: "promoted",
      idea_id: dental,
      created_by: fiona,
    },
    {
      title: "Forwarders re-type the same invoice data into three systems",
      description: `Encoders copy invoice lines into accounting, customs, and client reports. ${MARKER}`,
      who_has_it: "Freight forwarders with 10–80 staff",
      evidence: "“Half of my encoders' day is copy-paste.” (interview, operations head)",
      source_type: "interview",
      frequency: 5,
      severity: 3,
      willingness_to_pay: 4,
      status: "promoted",
      idea_id: freight,
      created_by: sam,
    },
    {
      title: "Small BPO teams lose track of client SLAs in shared spreadsheets",
      description: `Team leads find breached SLAs only at month-end reporting. ${MARKER}`,
      who_has_it: "BPO teams of 20–100 seats serving foreign SMEs",
      source_type: "observation",
      frequency: 4,
      severity: 3,
      willingness_to_pay: 3,
      status: "validating",
      created_by: maya,
    },
    {
      title: "Real estate brokers chase buyer documents over Viber",
      description: `Loan and reservation requirements get lost across chats. ${MARKER}`,
      who_has_it: "Real estate brokerages in BGC and Makati",
      source_type: "social",
      frequency: 4,
      severity: 3,
      willingness_to_pay: 2,
      status: "spotted",
      created_by: maya,
    },
    {
      title: "Accounting firms scramble every BIR filing deadline",
      description: `Client documents arrive late and incomplete right before deadlines. ${MARKER}`,
      who_has_it: "Accounting firms with 5–20 staff",
      source_type: "forum",
      frequency: 3,
      severity: 4,
      willingness_to_pay: 3,
      status: "spotted",
      created_by: fiona,
    },
  ]),
  "problems"
)
console.log("problems ✓")

// ---------------------------------------------------------------------------
// Decisions and votes
// ---------------------------------------------------------------------------

async function decision(
  row: Record<string, unknown>,
  votes: { by: string; choice: "approve" | "reject" | "abstain"; comment?: string }[]
) {
  const d = await must(
    db
      .from("decisions")
      .insert({ ...row, options_considered: `${row.options_considered ?? ""}\n${MARKER}`.trim() })
      .select("id")
      .single(),
    "decision"
  )
  for (const v of votes) {
    await must(
      db
        .from("decision_votes")
        .insert({ decision_id: d.id, voter_id: v.by, choice: v.choice, comment: v.comment ?? null }),
      "vote"
    )
  }
  return d.id
}

await decision(
  {
    title: "Run a paid two-week pilot with three dental clinics?",
    description: "Offer the AI intake assistant at ₱9,500 for two weeks, credited to the first month if they continue.",
    options_considered: "Free pilot (faster yes, weaker signal) vs paid pilot (slower, real commitment).",
    idea_id: dental,
    created_by: fiona,
  },
  [
    { by: fiona, choice: "approve", comment: "Paid pilots are the playbook's step 6 signal." },
    { by: sam, choice: "approve", comment: "Agree, and keep the human review desk staffed." },
  ]
)
await decision(
  {
    title: "Hire a part-time reviewer for AI-drafted bookings?",
    description: "₱22,000/month for a part-time reviewer during the pilot, 6pm–12am.",
    options_considered: "Founders cover nights vs part-time hire vs VA agency.",
    idea_id: dental,
    closes_at: new Date(Date.now() + 5 * 864e5).toISOString(),
    created_by: sam,
  },
  [{ by: sam, choice: "approve", comment: "We can't cover nights ourselves for long." }]
)
await decision(
  {
    title: "Pause the freight invoice idea until Q1?",
    description: "Focus both founders on the dental pilot and the Cebu CRM migrations this quarter.",
    created_by: fiona,
  },
  []
)
console.log("decisions ✓")

// ---------------------------------------------------------------------------
// Finance: transactions and budgets
// ---------------------------------------------------------------------------

const tx: Record<string, unknown>[] = []
for (let m = 5; m >= 0; m--) {
  const d = new Date()
  d.setMonth(d.getMonth() - m)
  const on = (dayOfMonth: number) => {
    return ymd(new Date(d.getFullYear(), d.getMonth(), Math.min(dayOfMonth, 28)))
  }
  const grow = 5 - m
  tx.push(
    {
      occurred_on: on(3),
      kind: "expense",
      category: "Software",
      amount: 6500,
      description: `Workspace and tools ${MARKER}`,
      recurring: "monthly",
    },
    {
      occurred_on: on(5),
      kind: "expense",
      category: "Infrastructure",
      amount: 3200 + grow * 400,
      description: `Hosting and database ${MARKER}`,
      recurring: "monthly",
    },
    {
      occurred_on: on(8),
      kind: "expense",
      category: "AI / API",
      amount: 0,
      description: `OpenRouter (free models) ${MARKER}`,
    },
    {
      occurred_on: on(15),
      kind: "expense",
      category: "Contractors",
      amount: 18000 + grow * 2000,
      description: `Part-time developer ${MARKER}`,
    },
    {
      occurred_on: on(20),
      kind: "expense",
      category: "Marketing",
      amount: 4000 + grow * 1500,
      description: `LinkedIn and events ${MARKER}`,
    }
  )
  if (grow >= 2)
    tx.push({
      occurred_on: on(10),
      kind: "income",
      category: "Consulting",
      amount: 35000,
      description: `CRM migration, Cebu agency ${MARKER}`,
    })
  if (grow >= 3)
    tx.push({
      occurred_on: on(18),
      kind: "income",
      category: "Pilot fees",
      amount: 9500 * (grow - 2),
      description: `Dental pilot fees ${MARKER}`,
    })
  if (grow >= 4)
    tx.push({
      occurred_on: on(1),
      kind: "income",
      category: "Revenue",
      amount: 12000,
      description: `Monthly retainer, insurance agency ${MARKER}`,
      recurring: "monthly",
    })
}
await must(
  db.from("transactions").insert(
    tx
      .filter((t) => Number(t.amount) > 0)
      // Multi-row inserts send NULL for missing keys instead of using column defaults.
      .map((t) => ({ recurring: "none", ...t, created_by: fiona }))
  ),
  "transactions"
)

async function budget(monthOffset: number, lines: [string, number][], voters: string[], title: string) {
  const d = await decision(
    {
      title,
      description: lines.map(([c, a]) => `• ${c}: ₱${a.toLocaleString("en-PH")}`).join("\n"),
      created_by: fiona,
    },
    []
  )
  const b = await must(
    db
      .from("budgets")
      .insert({ month: monthStart(monthOffset), decision_id: d, notes: `Demo budget. ${MARKER}`, created_by: fiona })
      .select("id")
      .single(),
    "budget"
  )
  await must(
    db.from("budget_lines").insert(lines.map(([category, amount]) => ({ budget_id: b.id, category, amount }))),
    "budget lines"
  )
  // Votes last: the second approval passes the decision and the database activates the budget.
  for (const by of voters) {
    await must(db.from("decision_votes").insert({ decision_id: d, voter_id: by, choice: "approve" }), "budget vote")
  }
}

const lines: [string, number][] = [
  ["Contractors", 30000],
  ["Software", 7000],
  ["Infrastructure", 6000],
  ["Marketing", 10000],
]
await budget(0, lines, [fiona, sam], "Approve this month's budget")
await budget(
  1,
  [...lines.slice(0, 3), ["Marketing", 15000], ["Salaries", 22000]],
  [fiona],
  "Approve next month's budget (adds a part-time reviewer)"
)
console.log("finance ✓")

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------

const companies = await must(
  db
    .from("companies")
    .insert(
      [
        {
          name: "Maginhawa Dental Group",
          website: "https://example.com/maginhawa-dental",
          industry: "Dental clinics",
          segment: "ai_tooling",
          size: "4 branches",
          location: "Quezon City",
        },
        {
          name: "Bayside Smile Studio",
          website: "https://example.com/bayside-smile",
          industry: "Dental clinics",
          segment: "ai_tooling",
          size: "2 branches",
          location: "Pasay",
        },
        {
          name: "Tala Freight & Customs",
          website: "https://example.com/tala-freight",
          industry: "Freight forwarding",
          segment: "ai_tooling",
          size: "45 staff",
          location: "Parañaque",
        },
        {
          name: "Sugbo Shield Insurance Agency",
          website: "https://example.com/sugbo-shield",
          industry: "Insurance",
          segment: "enterprise_crm",
          size: "18 agents",
          location: "Cebu City",
        },
        {
          name: "Lahi Realty Partners",
          website: "https://example.com/lahi-realty",
          industry: "Real estate",
          segment: "saas",
          size: "30 brokers",
          location: "Taguig",
        },
        {
          name: "Kalinaw Accounting Services",
          website: "https://example.com/kalinaw",
          industry: "Accounting",
          segment: "saas",
          size: "12 staff",
          location: "Mandaluyong",
        },
      ].map((c) => ({ ...c, notes: `Demo company. ${MARKER}`, created_by: fiona }))
    )
    .select("id, name"),
  "companies"
)
const company = (name: string) => companies.find((c) => c.name.startsWith(name))!.id
const contacts = await must(
  db
    .from("contacts")
    .insert(
      [
        ["Dra. Carmela Reyes", "Owner-dentist", "Maginhawa", "carmela@example.com"],
        ["Jun Villanueva", "Operations manager", "Bayside", "jun@example.com"],
        ["Rhea Bautista", "Head of operations", "Tala", "rhea@example.com"],
        ["Anton Lim", "Agency principal", "Sugbo", "anton@example.com"],
        ["Bea Soriano", "Managing broker", "Lahi", "bea@example.com"],
      ].map(([full_name, title, co, email]) => ({
        full_name,
        title,
        email,
        company_id: company(co),
        phone: "+63 917 000 0000",
        notes: MARKER,
        created_by: fiona,
      }))
    )
    .select("id, full_name"),
  "contacts"
)
const contact = (name: string) => contacts.find((c) => c.full_name.includes(name))!.id

const { data: pipelines } = await db.from("pipelines").select("id, name, pipeline_stages(id, name)")
const stage = (pipeline: string, stageName: string) => {
  const p = pipelines!.find((x) => x.name === pipeline)!
  return { pipeline_id: p.id, stage_id: p.pipeline_stages.find((s) => s.name === stageName)!.id }
}
const deals = await must(
  db
    .from("deals")
    .insert(
      [
        {
          ...stage("AI Tooling Clients", "Proposal / Pilot"),
          title: "Maginhawa: AI intake pilot",
          value: 28500,
          company_id: company("Maginhawa"),
          contact_id: contact("Carmela"),
          expected_close: day(10),
        },
        {
          ...stage("AI Tooling Clients", "Discovery call"),
          title: "Bayside: after-hours booking",
          value: 19000,
          company_id: company("Bayside"),
          contact_id: contact("Jun"),
          expected_close: day(25),
        },
        {
          ...stage("AI Tooling Clients", "Qualified"),
          title: "Tala: invoice extraction",
          value: 60000,
          company_id: company("Tala"),
          contact_id: contact("Rhea"),
          expected_close: day(45),
        },
        {
          ...stage("Enterprise CRM", "Won"),
          title: "Sugbo Shield: CRM migration",
          value: 85000,
          company_id: company("Sugbo"),
          contact_id: contact("Anton"),
          expected_close: day(-20),
        },
        {
          ...stage("Enterprise CRM", "Negotiation"),
          title: "Sugbo Shield: renewal retainer",
          value: 144000,
          company_id: company("Sugbo"),
          contact_id: contact("Anton"),
          expected_close: day(14),
        },
        {
          ...stage("SaaS Customers", "Lead"),
          title: "Lahi Realty: document chaser",
          value: 36000,
          company_id: company("Lahi"),
          contact_id: contact("Bea"),
          expected_close: day(60),
        },
        {
          ...stage("SaaS Customers", "Lost"),
          title: "Kalinaw: filing reminders",
          value: 24000,
          company_id: company("Kalinaw"),
          expected_close: day(-10),
        },
      ].map((d) => ({ ...d, owner_id: fiona, notes: `Demo deal. ${MARKER}` }))
    )
    .select("id, title"),
  "deals"
)
const dealId = (t: string) => deals.find((d) => d.title.startsWith(t))!.id
await must(
  db.from("activities").insert([
    {
      deal_id: dealId("Maginhawa"),
      kind: "meeting",
      body: "Demo with Dra. Reyes and two office managers. They want Messenger first, phone later.",
      created_by: fiona,
    },
    {
      deal_id: dealId("Maginhawa"),
      kind: "task",
      body: "Send pilot proposal with the ₱9,500 two-week price",
      due_at: new Date(Date.now() + 2 * 864e5).toISOString(),
      created_by: fiona,
    },
    {
      deal_id: dealId("Tala"),
      kind: "call",
      body: "Rhea confirmed ~1,200 invoices a month across 6 encoders.",
      created_by: sam,
    },
    {
      deal_id: dealId("Sugbo Shield: renewal"),
      kind: "email",
      body: "Sent retainer terms: ₱12,000/month, 12 months.",
      created_by: fiona,
    },
  ]),
  "activities"
)
console.log("CRM ✓")

await must(
  db.from("leads").insert(
    [
      {
        company_name: "Kalye Pet Clinic Network",
        industry: "Veterinary clinics",
        location: "Quezon City",
        fit_score: 84,
        segment: "ai_tooling",
        pain_signals: ["Bookings only by phone during clinic hours", "Messenger replies take a day"],
        suggested_offer: "AI intake with human review for appointment requests",
      },
      {
        company_name: "Pampanga Cold Chain Logistics",
        industry: "Logistics",
        location: "San Fernando, Pampanga",
        fit_score: 76,
        segment: "ai_tooling",
        pain_signals: ["Hiring data encoders", "Manual delivery reports"],
        suggested_offer: "Document extraction for delivery receipts",
      },
      {
        company_name: "Iloilo Mutual Brokers",
        industry: "Insurance",
        location: "Iloilo City",
        fit_score: 71,
        segment: "enterprise_crm",
        pain_signals: ["Renewal reminders sent manually"],
        suggested_offer: "CRM migration with renewal automation",
      },
      {
        company_name: "Davao Home Finders",
        industry: "Real estate",
        location: "Davao City",
        fit_score: 58,
        segment: "saas",
        pain_signals: ["Buyer requirements collected over chat"],
        suggested_offer: "Document checklist portal",
      },
    ].map((l, i) => ({ ...l, website: `https://example.com/lead-${i + 1}`, summary: `Demo lead. ${MARKER}` }))
  ),
  "leads"
)
console.log("leads ✓")

// ---------------------------------------------------------------------------
// Survey with responses
// ---------------------------------------------------------------------------

const survey = await must(
  db
    .from("surveys")
    .insert({
      title: "How clinics handle after-hours patient inquiries",
      description: `A short survey for clinic managers about inquiries outside office hours. ${MARKER}`,
      status: "active",
      idea_id: dental,
      created_by: fiona,
    })
    .select("id")
    .single(),
  "survey"
)
const sq = await must(
  db
    .from("survey_questions")
    .insert(
      [
        { survey_id: survey.id, position: 0, prompt: "What is your role at the clinic?", kind: "text", required: true },
        {
          survey_id: survey.id,
          position: 1,
          prompt: "When did you last miss a new-patient inquiry after hours?",
          kind: "single",
          options: ["This week", "This month", "In the last 3 months", "Not that I know of"],
          required: true,
        },
        {
          survey_id: survey.id,
          position: 2,
          prompt: "Where do inquiries come in?",
          kind: "multi",
          options: ["Phone", "Facebook Messenger", "Viber", "Walk-in", "Website form"],
          required: true,
        },
        {
          survey_id: survey.id,
          position: 3,
          prompt: "How painful are missed inquiries for your clinic?",
          kind: "scale",
          required: true,
        },
        {
          survey_id: survey.id,
          position: 4,
          prompt: "What happens today when a message arrives after closing?",
          kind: "long_text",
        },
      ].map((q) => ({ options: [] as string[], required: false, ...q }))
    )
    .select("id, position"),
  "survey questions"
)
const q = (pos: number) => sq.find((x) => x.position === pos)!.id
const responses: [string, string, string[], string, string][] = [
  [
    "Office manager",
    "This week",
    ["Facebook Messenger", "Phone"],
    "5",
    "We reply the next morning. Some patients already booked elsewhere.",
  ],
  ["Owner-dentist", "This month", ["Facebook Messenger"], "4", "I answer from my phone at night when I can."],
  ["Front desk", "This week", ["Phone", "Viber"], "4", "Calls go to voicemail; almost nobody leaves a message."],
  [
    "Operations manager",
    "In the last 3 months",
    ["Facebook Messenger", "Website form"],
    "3",
    "A VA covers Messenger until 10pm.",
  ],
  ["Office manager", "This week", ["Facebook Messenger", "Phone", "Walk-in"], "5", ""],
  ["Clinic coordinator", "Not that I know of", ["Walk-in", "Phone"], "2", "Most of our patients walk in."],
]
await must(
  db.from("survey_responses").insert(
    responses.map(([role, last, channels, pain, story]) => ({
      survey_id: survey.id,
      answers: { [q(0)]: role, [q(1)]: last, [q(2)]: channels, [q(3)]: pain, ...(story ? { [q(4)]: story } : {}) },
    }))
  ),
  "responses"
)
console.log("survey ✓")

// ---------------------------------------------------------------------------
// Planning: roadmap, OKRs, projects
// ---------------------------------------------------------------------------

await must(
  db.from("roadmap_items").insert(
    [
      {
        title: "Dental intake pilot with 3 clinics",
        lane: "product",
        status: "in_progress",
        start_date: day(-10),
        end_date: day(20),
        idea_id: dental,
      },
      {
        title: "Human-review desk playbook",
        lane: "operations",
        status: "planned",
        start_date: day(5),
        end_date: day(35),
      },
      {
        title: "Cebu insurance outreach",
        lane: "sales",
        status: "in_progress",
        start_date: day(-20),
        end_date: day(40),
      },
      {
        title: "Case study: Sugbo Shield migration",
        lane: "marketing",
        status: "planned",
        start_date: day(15),
        end_date: day(45),
      },
      {
        title: "Freight invoice discovery interviews",
        lane: "product",
        status: "planned",
        start_date: day(60),
        end_date: day(100),
        idea_id: freight,
      },
      {
        title: "Monthly budget reviews",
        lane: "finance",
        status: "in_progress",
        start_date: day(-30),
        end_date: day(150),
      },
    ].map((r) => ({ ...r, description: `Demo roadmap item. ${MARKER}`, created_by: fiona }))
  ),
  "roadmap"
)
const period = `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`
const objectives = await must(
  db
    .from("objectives")
    .insert([
      {
        title: "Prove paying demand for human-reviewed AI intake",
        period,
        owner_id: fiona,
        status: "on_track",
        description: `Validation before we build more. ${MARKER}`,
      },
      {
        title: "Make the CRM migration service repeatable",
        period,
        owner_id: sam,
        status: "at_risk",
        description: `Standardise so migrations don't depend on founders. ${MARKER}`,
      },
    ])
    .select("id, title"),
  "objectives"
)
await must(
  db.from("key_results").insert([
    {
      objective_id: objectives[0].id,
      title: "Paid clinic pilots signed",
      start_value: 0,
      target_value: 3,
      current_value: 1,
      unit: "pilots",
    },
    {
      objective_id: objectives[0].id,
      title: "After-hours inquiries converted to bookings",
      start_value: 0,
      target_value: 20,
      current_value: 12,
      unit: "%",
    },
    {
      objective_id: objectives[0].id,
      title: "Bookings reviewed within 15 minutes",
      start_value: 0,
      target_value: 95,
      current_value: 88,
      unit: "%",
    },
    {
      objective_id: objectives[1].id,
      title: "Migrations delivered",
      start_value: 0,
      target_value: 4,
      current_value: 1,
      unit: "agencies",
    },
    {
      objective_id: objectives[1].id,
      title: "Days per migration",
      start_value: 21,
      target_value: 10,
      current_value: 16,
      unit: "days",
    },
  ]),
  "key results"
)
const pilotProject = await must(
  db
    .from("projects")
    .insert({
      name: "Dental intake pilot",
      key: "DENTAL",
      description: `Two-week paid pilot with Maginhawa and Bayside. ${MARKER}`,
      status: "active",
      idea_id: dental,
      owner_id: fiona,
      start_date: day(-21),
      due_date: day(20),
    })
    .select("id")
    .single(),
  "project"
)

// Agile history: sprint 1 is finished, sprint 2 is running, sprint 3 is planned.
const [sprint1, sprint2, sprint3] = await must(
  db
    .from("sprints")
    .insert([
      {
        project_id: pilotProject.id,
        name: "Sprint 1",
        goal: "Clinic messages reach a reviewer within 5 minutes, day and night",
        status: "completed",
        start_date: day(-21),
        end_date: day(-8),
        committed_points: 21,
        completed_points: 16,
        started_at: `${day(-21)}T09:00:00+08:00`,
        completed_at: `${day(-8)}T18:00:00+08:00`,
      },
      {
        project_id: pilotProject.id,
        name: "Sprint 2",
        goal: "Both pilot clinics book patients end to end without founder help",
        status: "active",
        start_date: day(-7),
        end_date: day(6),
        committed_points: 24,
        started_at: `${day(-7)}T09:00:00+08:00`,
      },
      {
        project_id: pilotProject.id,
        name: "Sprint 3",
        goal: "Turn the pilot into a paid monthly plan",
        status: "planned",
        start_date: day(7),
        end_date: day(20),
      },
    ])
    .select("id"),
  "sprints"
)

type SeedTask = {
  title: string
  kind: string
  points: number | null
  priority: string
  sprint: string | null
  assignees: string[]
  // Days from today: created, started, finished (null = not yet).
  created: number
  started?: number
  review?: number
  done?: number
  subtasks?: [string, boolean][]
  teams?: string[]
}
const seedTasks: SeedTask[] = [
  {
    title: "Connect clinic Messenger pages",
    kind: "story",
    points: 5,
    priority: "high",
    sprint: sprint1.id,
    assignees: [maya],
    created: -22,
    started: -21,
    done: -18,
    teams: ["Engineering"],
  },
  {
    title: "Write booking review checklist",
    kind: "task",
    points: 3,
    priority: "medium",
    sprint: sprint1.id,
    assignees: [sam, fiona],
    created: -22,
    started: -20,
    done: -17,
    teams: ["Operations"],
  },
  {
    title: "Draft replies from clinic price lists",
    kind: "story",
    points: 8,
    priority: "high",
    sprint: sprint1.id,
    assignees: [maya, sam],
    created: -22,
    started: -19,
    review: -13,
    done: -11,
    teams: ["Engineering", "Product"],
  },
  {
    title: "Fix duplicate replies on Messenger retries",
    kind: "bug",
    points: 2,
    priority: "urgent",
    sprint: sprint2.id,
    assignees: [maya],
    created: -16,
    started: -15,
    review: -9,
    done: -5,
    teams: ["Engineering"],
  },
  {
    title: "Train reviewer on clinic price lists",
    kind: "task",
    points: 5,
    priority: "high",
    sprint: sprint2.id,
    assignees: [sam],
    created: -21,
    started: -12,
    teams: ["Operations"],
    subtasks: [
      ["Share Maginhawa price list", true],
      ["Share Bayside price list", true],
      ["Shadow 10 live conversations", true],
      ["Sign-off quiz", false],
    ],
  },
  {
    title: "Daily pilot report to clinics",
    kind: "deliverable",
    points: 3,
    priority: "medium",
    sprint: sprint2.id,
    assignees: [fiona],
    created: -10,
    started: -6,
    teams: ["Operations", "Sales"],
    subtasks: [
      ["Report template", true],
      ["Automate daily numbers", false],
    ],
  },
  {
    title: "Booking confirmation back to the clinic calendar",
    kind: "story",
    points: 8,
    priority: "high",
    sprint: sprint2.id,
    assignees: [maya, sam],
    created: -9,
    started: -5,
    review: -1,
    teams: ["Engineering"],
  },
  {
    title: "Measure after-hours conversion",
    kind: "spike",
    points: 3,
    priority: "high",
    sprint: sprint2.id,
    assignees: [fiona],
    created: -9,
    started: -3,
    done: -1,
    teams: ["Product"],
  },
  {
    title: "Escalation path for urgent dental pain",
    kind: "story",
    points: 3,
    priority: "urgent",
    sprint: sprint2.id,
    assignees: [sam],
    created: -7,
    teams: ["Operations"],
  },
  {
    title: "Collect pilot testimonials",
    kind: "task",
    points: 2,
    priority: "low",
    sprint: sprint3.id,
    assignees: [fiona],
    created: -6,
    teams: ["Marketing"],
  },
  {
    title: "Pricing page for the monthly plan",
    kind: "story",
    points: 5,
    priority: "medium",
    sprint: sprint3.id,
    assignees: [],
    created: -4,
    teams: ["Marketing", "Product"],
  },
  {
    title: "Billing via GCash and bank transfer",
    kind: "story",
    points: 8,
    priority: "high",
    sprint: sprint3.id,
    assignees: [maya],
    created: -4,
    teams: ["Engineering", "Finance"],
  },
  {
    title: "Weekly clinic check-in",
    kind: "chore",
    points: 1,
    priority: "medium",
    sprint: null,
    assignees: [fiona, sam],
    created: -3,
    teams: ["Sales"],
  },
  {
    title: "Explore Viber Business as a second channel",
    kind: "spike",
    points: null,
    priority: "low",
    sprint: null,
    assignees: [],
    created: -2,
    teams: ["Product"],
  },
]
const at = (offset: number, hour = 10) =>
  new Date(`${day(offset)}T${String(hour).padStart(2, "0")}:00:00+08:00`).toISOString()
const statusOf = (t: SeedTask) =>
  t.done !== undefined ? "done" : t.review !== undefined ? "review" : t.started !== undefined ? "in_progress" : "todo"

const insertedTasks = await must(
  db
    .from("tasks")
    .insert(
      seedTasks.map((t, position) => ({
        project_id: pilotProject.id,
        title: t.title,
        kind: t.kind,
        story_points: t.points,
        priority: t.priority,
        status: statusOf(t),
        sprint_id: t.sprint,
        teams: t.teams ?? [],
        position,
        created_by: fiona,
        frequency: t.kind === "chore" ? "weekly" : "once",
        reporting_period: t.kind === "deliverable" ? "Pilot weeks 1–2" : null,
        start_date: t.started !== undefined ? day(t.started) : null,
        due_date: t.sprint === sprint2.id ? day(6) : t.sprint === sprint3.id ? day(20) : null,
        body:
          t.title === "Train reviewer on clinic price lists"
            ? {
                type: "doc",
                content: [
                  { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Why" }] },
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Drafts quote prices from each clinic's own list. The reviewer must catch a wrong price before a patient sees it.",
                      },
                    ],
                  },
                  { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Done when" }] },
                  {
                    type: "bulletList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: "Reviewer passes the sign-off quiz (9/10)" }],
                          },
                        ],
                      },
                      {
                        type: "listItem",
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: "Zero price errors across two nights of live traffic" }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              }
            : null,
      }))
    )
    .select("id, title"),
  "tasks"
)
const taskId = (title: string) => insertedTasks.find((t) => t.title === title)!.id

// Backdate lifecycle timestamps and rebuild the activity log so the charts have a real history.
for (const t of seedTasks) {
  const id = taskId(t.title)
  await must(
    db
      .from("tasks")
      .update({
        created_at: at(t.created, 9),
        started_at: t.started !== undefined ? at(t.started) : null,
        completed_at: t.done !== undefined ? at(t.done, 17) : null,
      })
      .eq("id", id),
    "task dates"
  )
}
const ids = insertedTasks.map((t) => t.id)
await must(db.from("task_activity").delete().in("task_id", ids), "reset activity")
await must(
  db
    .from("task_assignees")
    .insert(seedTasks.flatMap((t) => t.assignees.map((profile_id) => ({ task_id: taskId(t.title), profile_id })))),
  "assignees"
)
// Sub-tasks are full tasks under their parent (same project and sprint), owned by the parent's first assignee.
const children = await must(
  db
    .from("tasks")
    .insert(
      seedTasks.flatMap((t) =>
        (t.subtasks ?? []).map(([title, done], position) => ({
          project_id: pilotProject.id,
          parent_id: taskId(t.title),
          title,
          status: done ? "done" : "todo",
          position,
          created_by: fiona,
        }))
      )
    )
    .select("id, parent_id"),
  "subtasks"
)
await must(
  db.from("task_assignees").insert(
    children.flatMap((c) => {
      const owner = seedTasks.find((t) => taskId(t.title) === c.parent_id)?.assignees[0]
      return owner ? [{ task_id: c.id, profile_id: owner }] : []
    })
  ),
  "subtask assignees"
)
// Progress follows sub-tasks via trigger; tasks without a checklist get a rough figure from their status.
for (const t of seedTasks.filter((x) => !x.subtasks)) {
  const progress = { todo: 0, in_progress: 40, review: 80, done: 100 }[statusOf(t)]
  await db.from("tasks").update({ progress }).eq("id", taskId(t.title))
}
await must(db.from("task_activity").delete().in("task_id", ids), "reset activity")
const activity = seedTasks.flatMap((t) => {
  const id = taskId(t.title)
  const base = { task_id: id, project_id: pilotProject.id }
  const rows: {
    task_id: string
    project_id: string
    actor_id: string
    action: string
    detail: Record<string, string>
    created_at: string
  }[] = [
    {
      ...base,
      actor_id: fiona,
      action: "created",
      detail: { title: t.title, status: "todo" },
      created_at: at(t.created, 9),
    },
    ...t.assignees.map((a) => ({
      ...base,
      actor_id: fiona,
      action: "assigned",
      detail: { name: profiles?.find((p) => p.id === a)?.full_name ?? "someone" },
      created_at: at(t.created, 9),
    })),
  ]
  const move = (to: string, from: string, when: number, hour: number) =>
    rows.push({
      ...base,
      actor_id: t.assignees[0] ?? fiona,
      action: "changed",
      detail: { field: "status", from, to },
      created_at: at(when, hour),
    })
  let current = "todo"
  if (t.started !== undefined) {
    move("in_progress", current, t.started, 10)
    current = "in_progress"
  }
  if (t.review !== undefined) {
    move("review", current, t.review, 15)
    current = "review"
  }
  if (t.done !== undefined) move("done", current, t.done, 17)
  return rows
})
await must(db.from("task_activity").insert(activity), "activity")
await must(
  db.from("task_notes").insert({
    task_id: taskId("Train reviewer on clinic price lists"),
    author_id: sam,
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Bayside changed their cleaning price last week — updated list is in the attachments folder. Quiz on Friday.",
            },
          ],
        },
      ],
    },
    body_html:
      "<p>Bayside changed their cleaning price last week — updated list is in the attachments folder. Quiz on Friday.</p>",
    created_at: at(-2, 11),
  }),
  "note"
)
console.log("planning ✓")

// ---------------------------------------------------------------------------
// Network, resources, content
// ---------------------------------------------------------------------------

await must(
  db.from("network_contacts").insert(
    [
      {
        full_name: "Paolo Santos",
        organization: "Kapwa Ventures (fictional)",
        role: "Partner",
        relationship: "investor",
        strength: 3,
        last_contacted: day(-40),
        next_follow_up: day(-2),
      },
      {
        full_name: "Ligaya Cruz",
        organization: "Metro Clinic Owners Circle",
        role: "Organizer",
        relationship: "partner",
        strength: 4,
        last_contacted: day(-8),
        next_follow_up: day(7),
      },
      {
        full_name: "Dr. Ramon Dizon",
        organization: "Independent",
        role: "Dental practice advisor",
        relationship: "advisor",
        strength: 4,
        last_contacted: day(-15),
        next_follow_up: day(0),
      },
      {
        full_name: "Karen Uy",
        organization: "Startup mentor network",
        role: "Mentor",
        relationship: "mentor",
        strength: 5,
        last_contacted: day(-5),
        next_follow_up: day(21),
      },
      {
        full_name: "Miguel Tan",
        organization: "Cebu Insurance Brokers Association",
        role: "Board member",
        relationship: "partner",
        strength: 2,
        last_contacted: day(-60),
        next_follow_up: day(-5),
      },
    ].map((n) => ({ ...n, email: "contact@example.com", notes: `Demo contact. ${MARKER}`, created_by: fiona }))
  ),
  "network"
)
await must(
  db.from("resources").insert(
    [
      { title: "The Mom Test (customer interviews)", url: "https://www.momtestbook.com/", category: "playbook" },
      { title: "Y Combinator Startup Library", url: "https://www.ycombinator.com/library", category: "article" },
      {
        title: "Data Privacy Act of 2012 (RA 10173)",
        url: "https://privacy.gov.ph/data-privacy-act/",
        category: "legal",
      },
      { title: "OpenRouter free models", url: "https://openrouter.ai/models?max_price=0", category: "tool" },
      { title: "crawl4ai documentation", url: "https://docs.crawl4ai.com/", category: "tool" },
    ].map((r) => ({ ...r, description: `Demo resource. ${MARKER}`, created_by: fiona }))
  ),
  "resources"
)
await must(
  db.from("content_items").insert(
    [
      {
        title: "Why clinics lose patients after 6pm",
        channel: "linkedin",
        status: "published",
        publish_date: day(-12),
        url: "https://example.com/post-1",
      },
      {
        title: "What a human reviewer catches that AI misses",
        channel: "linkedin",
        status: "scheduled",
        publish_date: day(3),
      },
      {
        title: "Case study: zero missed renewals in 90 days",
        channel: "blog",
        status: "drafting",
        publish_date: day(18),
      },
      { title: "Founders' notes: our first paid pilot", channel: "newsletter", status: "idea", publish_date: day(25) },
      { title: "Messenger booking walkthrough", channel: "youtube", status: "review", publish_date: day(10) },
    ].map((c) => ({ ...c, body: `Demo content. ${MARKER}`, owner_id: fiona }))
  ),
  "content"
)
console.log("network, resources, content ✓")

// ---------------------------------------------------------------------------
// Documents and files
// ---------------------------------------------------------------------------

const { data: template } = await db
  .from("document_templates")
  .select("id, body_html")
  .eq("name", "Pilot Proposal")
  .maybeSingle()
await must(
  db.from("documents").insert([
    {
      title: "Pilot proposal: Maginhawa Dental Group",
      category: "proposal",
      idea_id: dental,
      template_id: template?.id ?? null,
      content: {
        html: (template?.body_html ?? "<h1>Pilot proposal</h1>")
          .replaceAll("{{Company}}", "Maginhawa Dental Group")
          .replaceAll("{{N}}", "2")
          .replaceAll("{{price}}", "₱9,500"),
      },
      created_by: fiona,
      updated_by: fiona,
    },
    {
      title: "Interview notes: clinic managers",
      category: "research",
      idea_id: dental,
      content: {
        html: "<h1>Interview notes: clinic managers</h1><p>Six interviews, Makati and Quezon City.</p><ul><li>4 of 6 lost a patient to slow replies in the past two weeks.</li><li>Messenger is the main after-hours channel.</li><li>Owners want to approve every AI reply at first.</li></ul>",
      },
      created_by: maya,
      updated_by: maya,
    },
  ]),
  "documents"
)

const root = await must(
  db
    .from("file_folders")
    .insert([
      { name: "Pitch & proposals", created_by: admin },
      { name: "Research", created_by: admin },
      { name: "Contracts", created_by: admin },
    ])
    .select("id, name"),
  "folders"
)
const folder = (name: string) => root.find((f) => f.name === name)!.id
const interviews = await must(
  db
    .from("file_folders")
    .insert({ name: "Interviews", parent_id: folder("Research"), created_by: admin })
    .select("id")
    .single(),
  "subfolder"
)

// A tiny but valid one-page PDF and an SVG chart, so previews have something to show.
const pdf = (() => {
  const text = "3rdLoop Solutions - Pilot one-pager (demo)"
  const stream = `BT /F1 20 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return out
})()
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#f6f8f8"/><text x="32" y="48" font-family="sans-serif" font-size="20" fill="#0f3d3e">After-hours inquiries answered (demo)</text>${[22, 35, 48, 61, 74].map((h, i) => `<rect x="${60 + i * 110}" y="${320 - h * 3.5}" width="64" height="${h * 3.5}" rx="4" fill="#00857a"/>`).join("")}</svg>`

const files: { name: string; body: string; type: string; folder_id: string }[] = [
  { name: "Pilot one-pager.pdf", body: pdf, type: "application/pdf", folder_id: folder("Pitch & proposals") },
  { name: "Inquiry chart.svg", body: svg, type: "image/svg+xml", folder_id: folder("Research") },
  {
    name: "Clinic interview summary.pdf",
    body: pdf.replace("Pilot one-pager", "Interview summary"),
    type: "application/pdf",
    folder_id: interviews.id,
  },
]
for (const f of files) {
  const path = `demo/${crypto.randomUUID()}/${f.name}`
  await must(
    db.storage.from("documents").upload(path, new Blob([f.body], { type: f.type }), { contentType: f.type }),
    `upload ${f.name}`
  )
  await must(
    db.from("uploads").insert({
      name: f.name,
      storage_path: path,
      mime_type: f.type,
      size_bytes: new TextEncoder().encode(f.body).length,
      folder_id: f.folder_id,
      idea_id: dental,
      uploaded_by: admin,
    }),
    `record ${f.name}`
  )
}
console.log("documents and files ✓")
console.log(
  `\nDemo data ready. The ${crmIdea ? "Cebu CRM idea" : "Build-stage idea"} is at step 8 with its MVP project.`
)
