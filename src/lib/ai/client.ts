import "server-only"

import { z } from "zod"

// All AI goes through OpenRouter, restricted to free models.
// OPENROUTER_MODELS is a comma-separated fallback chain; OpenRouter tries them in
// order (free endpoints are rate-limited and come and go). Every model is checked
// against OpenRouter's live price list before use, so a paid model can never be
// called, even if someone configures one by mistake.

const API = "https://openrouter.ai/api/v1"

// Ordered by measured quality/latency on structured output; free availability changes, so keep a long chain.
const DEFAULT_MODELS = [
  "nex-agi/nex-n2.5-pro:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/free",
  "qwen/qwen3.8-27b:free",
  "nex-agi/nex-n2.5-mini:free",
]

export class AIError extends Error {}

/** The models in a request were rate-limited, overloaded, or gone — worth trying others. */
class UnavailableError extends AIError {}

export function aiConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

export function configuredModels() {
  const raw = process.env.OPENROUTER_MODELS?.split(",")
    .map((m) => m.trim())
    .filter(Boolean)
  return raw?.length ? raw : DEFAULT_MODELS
}

// ---------------------------------------------------------------------------
// Free-model guard
// ---------------------------------------------------------------------------

type ModelInfo = { id: string; pricing?: Record<string, string>; supported_parameters?: string[] }

let catalog: { at: number; models: Map<string, ModelInfo> } | null = null

async function modelCatalog() {
  if (catalog && Date.now() - catalog.at < 60 * 60 * 1000) return catalog.models
  const response = await fetch(`${API}/models`, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new AIError(`Couldn't load the OpenRouter model list (${response.status}).`)
  const body = (await response.json()) as { data: ModelInfo[] }
  catalog = { at: Date.now(), models: new Map(body.data.map((m) => [m.id, m])) }
  return catalog.models
}

function isFree(model: ModelInfo) {
  // Every priced dimension (prompt, completion, request, image, web search, …) must be zero.
  return Object.values(model.pricing ?? {}).every((price) => Number(price) === 0)
}

/** Returns the configured models that exist and are free. Throws if none are. */
export async function freeModels(): Promise<string[]> {
  const models = await modelCatalog()
  const allowed = configuredModels().filter((id) => {
    const info = models.get(id)
    return info !== undefined && isFree(info)
  })
  if (allowed.length === 0) {
    throw new AIError(
      "None of the configured OPENROUTER_MODELS are free models available on OpenRouter. Paid models are not allowed."
    )
  }
  return allowed
}

// ---------------------------------------------------------------------------
// Chat completions
// ---------------------------------------------------------------------------

type Message = { role: "system" | "user" | "assistant"; content: string }

type Completion = {
  model?: string
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[]
  error?: { code?: number; message?: string }
}

// OpenRouter accepts at most this many models in one request's fallback list.
const MAX_MODELS_PER_REQUEST = 3

async function complete(body: Record<string, unknown>): Promise<{ text: string; model: string }> {
  if (!aiConfigured()) {
    throw new AIError("OPENROUTER_API_KEY is not set. Add it to .env.local to enable AI features.")
  }
  const models = await freeModels()

  // Try the chain in groups; move to the next group only when a whole group is unavailable.
  // Free endpoints fail transiently under load, so the whole chain gets one more pass after a pause.
  let lastError: AIError | undefined
  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await new Promise((resolve) => setTimeout(resolve, 4000))
    for (let i = 0; i < models.length; i += MAX_MODELS_PER_REQUEST) {
      try {
        return await request(body, models.slice(i, i + MAX_MODELS_PER_REQUEST))
      } catch (error) {
        if (!(error instanceof UnavailableError)) throw error
        lastError = error
      }
    }
  }
  throw lastError ?? new AIError("No free model is available right now. Try again in a minute.")
}

async function request(
  body: Record<string, unknown>,
  models: string[],
  attempt = 0
): Promise<{ text: string; model: string }> {
  const response = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "3rdLoop Solutions",
    },
    // `models` = fallback list; OpenRouter moves to the next one when a model is down or rate-limited.
    body: JSON.stringify({ ...body, model: models[0], models }),
    signal: AbortSignal.timeout(180_000),
  })

  const data = (await response.json().catch(() => ({}))) as Completion

  if (!response.ok || data.error) {
    const status = data.error?.code ?? response.status
    if ([404, 408, 429, 502, 503, 504].includes(status)) {
      // Free endpoints rate-limit aggressively; wait once if told how long, then give up on this group.
      if (status === 429 && attempt === 0) {
        const wait = Math.min(Number(response.headers.get("Retry-After")) || 5, 20)
        await new Promise((resolve) => setTimeout(resolve, wait * 1000))
        return request(body, models, attempt + 1)
      }
      throw new UnavailableError(describe(status, data.error?.message))
    }
    throw new AIError(describe(status, data.error?.message))
  }

  const choice = data.choices?.[0]
  const text = choice?.message?.content ?? ""
  // Free reasoning models sometimes spend their whole budget thinking and return nothing; try the next ones.
  if (!text.trim()) throw new UnavailableError("The free models returned an empty response. Try again.")
  if (choice?.finish_reason === "length") throw new AIError("The model's response was cut off. Try a narrower request.")
  return { text, model: data.model ?? models[0] }
}

function describe(status: number, message?: string) {
  if (status === 401) return "The OpenRouter API key was rejected."
  if (status === 402)
    return "OpenRouter refused the request for billing reasons. Only free models are used — check OPENROUTER_MODELS."
  if (status === 429) return "The free models are rate-limited right now. Wait a minute and try again."
  if (status === 403) return `OpenRouter blocked the request: ${message ?? "moderation"}`
  return `OpenRouter error (${status}): ${message ?? "unknown error"}`
}

function toJsonSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>
  delete json.$schema
  return json
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.search(/[{[]/)
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"))
  return JSON.parse(start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate)
}

/** One structured call: returns data validated against `schema`. Retries once with the validation errors. */
export async function generateObject<T extends z.ZodType>({
  system,
  prompt,
  schema,
  name = "result",
}: {
  system: string
  prompt: string
  schema: T
  name?: string
}): Promise<z.infer<T>> {
  const jsonSchema = toJsonSchema(schema)
  const messages: Message[] = [
    {
      role: "system",
      content: `${system}\n\nRespond with a single JSON object that matches this JSON Schema exactly. No prose, no code fences.\n${JSON.stringify(jsonSchema)}`,
    },
    { role: "user", content: prompt },
  ]

  for (let attempt = 0; attempt < 2; attempt++) {
    const { text } = await complete({
      messages,
      max_tokens: 16000,
      // OpenRouter prefers endpoints that honour structured outputs; the prompt carries the schema too for those that don't.
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema: jsonSchema } },
    })

    let parsed: unknown
    try {
      parsed = extractJson(text)
    } catch {
      parsed = undefined
    }
    const result = schema.safeParse(parsed)
    if (result.success) return result.data

    messages.push(
      { role: "assistant", content: text },
      {
        role: "user",
        content: `That response did not match the schema: ${
          parsed === undefined ? "it was not valid JSON" : z.prettifyError(result.error)
        }. Reply again with only the corrected JSON object.`,
      }
    )
  }
  throw new AIError("The model didn't return valid structured data. Try again, or configure a stronger free model.")
}

/** Free-form text generation (used by the document drafter). */
export async function generateText({ system, prompt }: { system: string; prompt: string }): Promise<string> {
  const { text } = await complete({
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    max_tokens: 16000,
  })
  return text
}
