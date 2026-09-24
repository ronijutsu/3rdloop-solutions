"use client"

import { ArrowRightLeftIcon, ExternalLinkIcon, SearchIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import type { LeadSearchEvent } from "@/app/api/leads/search/route"
import { useCan } from "@/components/permissions-provider"
import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { SEGMENTS, segmentLabel } from "@/lib/constants"
import { readEvents } from "@/lib/ndjson"
import { fromNow, labelize } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"

import { convertLead, setLeadStatus } from "./actions"

type Lead = Database["public"]["Tables"]["leads"]["Row"]
type Search = Database["public"]["Tables"]["lead_searches"]["Row"]

const EXAMPLES = [
  { query: "freight forwarders and customs brokers in Metro Manila", segment: "ai_tooling" },
  { query: "insurance agencies in Cebu still using spreadsheets for clients", segment: "enterprise_crm" },
  { query: "growing real estate brokerages in BGC and Makati", segment: "saas" },
]

export function LeadFinder({
  leads,
  searches,
  ready,
  canRun,
}: {
  leads: Lead[]
  searches: Search[]
  ready: { ai: boolean; crawler: boolean }
  canRun: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [segment, setSegment] = useState("ai_tooling")
  const [seeds, setSeeds] = useState("")
  const [limit, setLimit] = useState("8")
  const [progress, setProgress] = useState<string | null>(null)
  const [filter, setFilter] = useState("active")
  const [, startTransition] = useTransition()

  const canSearch = ready.ai && ready.crawler

  async function run() {
    const seedUrls = seeds
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.startsWith("http") ? s : `https://${s}`))
    setProgress("Starting…")
    try {
      const response = await fetch("/api/leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, segment, seedUrls, limit: Number(limit) || 8 }),
      })
      await readEvents<LeadSearchEvent>(response, (event) => {
        if (event.type === "status") setProgress(event.message)
        if (event.type === "error") throw new Error(event.message)
        if (event.type === "done") {
          toast.success(`Found ${event.found} prospect${event.found === 1 ? "" : "s"}`, {
            description: [
              `${event.added} new lead${event.added === 1 ? "" : "s"} added`,
              event.found > event.added && `${event.found - event.added} already known`,
              event.vendors > 0 && `${event.vendors} vendor${event.vendors === 1 ? "" : "s"} filtered out`,
              event.outsideMarket > 0 && `${event.outsideMarket} outside the Philippines skipped`,
            ]
              .filter(Boolean)
              .join(" · "),
          })
        }
      })
    } catch (error) {
      toast.error("Lead search failed", { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setProgress(null)
      startTransition(() => router.refresh())
    }
  }

  const visible = leads.filter((l) =>
    filter === "active" ? l.status === "new" || l.status === "qualified" : filter === "all" ? true : l.status === filter
  )

  return (
    <div className="flex flex-col gap-6">
      {canRun && !canSearch && (
        <Alert>
          <AlertTitle>Lead search needs setup</AlertTitle>
          <AlertDescription>
            {!ready.ai && "Set OPENROUTER_API_KEY. "}
            {!ready.crawler && "Start crawl4ai (pnpm crawler) and set CRAWL4AI_URL. "}
            See the README for details.
          </AlertDescription>
        </Alert>
      )}

      {canRun && (
        <Card>
          <CardHeader>
            <CardTitle>Find leads</CardTitle>
            <CardDescription>
              Describe the Philippine businesses that would buy from you. AI turns that into searches for those
              businesses, crawl4ai reads each site, and vendors or companies outside the Philippines are filtered out.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-[1fr_200px_120px]">
                <Field>
                  <FieldLabel htmlFor="lead-query">Who are you looking for?</FieldLabel>
                  <Input
                    id="lead-query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. dental clinic chains in Metro Manila that take bookings by phone"
                  />
                  <FieldDescription className="flex flex-wrap gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <Button
                        key={ex.query}
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setQuery(ex.query)
                          setSegment(ex.segment)
                        }}
                      >
                        {ex.query}
                      </Button>
                    ))}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="lead-segment">Segment</FieldLabel>
                  <SimpleSelect id="lead-segment" options={SEGMENTS} value={segment} onValueChange={setSegment} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="lead-limit">Max sites</FieldLabel>
                  <Input
                    id="lead-limit"
                    type="number"
                    min={1}
                    max={20}
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="lead-seeds">Specific websites (optional)</FieldLabel>
                <Textarea
                  id="lead-seeds"
                  rows={2}
                  value={seeds}
                  onChange={(e) => setSeeds(e.target.value)}
                  placeholder="acme.com  example.co — skip web search and crawl these directly"
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6 justify-between gap-4">
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {progress}
            </span>
            <Button onClick={run} disabled={!canSearch || progress !== null || query.trim().length < 3}>
              {progress ? <Spinner data-icon="inline-start" /> : <SearchIcon data-icon="inline-start" />}
              {progress ? "Working…" : "Find leads"}
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(String(v))}>
          <TabsList>
            <TabsTrigger value="active">To review</TabsTrigger>
            <TabsTrigger value="converted">Converted</TabsTrigger>
            <TabsTrigger value="discarded">Discarded</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        {searches.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Last search: “{searches[0].query}” · {labelize(searches[0].status)} · {fromNow(searches[0].created_at)}
            {searches[0].error && ` · ${searches[0].error}`}
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No leads here</EmptyTitle>
            <EmptyDescription>Run a search above to find businesses that fit.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  )
}

function LeadCard({ lead }: { lead: Lead }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const can = useCan()
  const score = lead.fit_score ?? 0

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={score >= 70 ? "default" : score >= 40 ? "secondary" : "outline"}>Fit {score}</Badge>
          <Badge variant="outline">{segmentLabel(lead.segment)}</Badge>
          {lead.status !== "new" && <Badge variant="secondary">{labelize(lead.status)}</Badge>}
        </div>
        <CardTitle className="mt-2">{lead.company_name}</CardTitle>
        <CardDescription>
          {[lead.industry, lead.location].filter((v) => v && v !== "Unknown").join(" · ") || "—"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {lead.summary && <p>{lead.summary}</p>}
        {lead.pain_signals.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="font-medium">Pain signals</span>
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {lead.pain_signals.map((signal) => (
                <li key={signal} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  {signal}
                </li>
              ))}
            </ul>
          </div>
        )}
        {lead.suggested_offer && (
          <p>
            <span className="font-medium">Suggested offer:</span> {lead.suggested_offer}
          </p>
        )}
      </CardContent>
      <CardFooter className="mt-auto flex-wrap gap-2">
        {lead.website && (
          <Button variant="ghost" size="sm" render={<a href={lead.website} target="_blank" rel="noreferrer" />}>
            <ExternalLinkIcon data-icon="inline-start" />
            Website
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          {lead.status === "converted" ? (
            <Button variant="outline" size="sm" render={<Link href="/crm/companies" />}>
              View in CRM
            </Button>
          ) : !can("leads.edit") ? null : (
            <>
              {lead.status !== "discarded" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => startTransition(async () => void (await setLeadStatus(lead.id, "discarded")))}
                >
                  <XIcon data-icon="inline-start" />
                  Discard
                </Button>
              )}
              {can("crm.edit") && (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await convertLead(lead.id)
                      if (!r.ok) {
                        toast.error("Couldn't convert", { description: r.error })
                        return
                      }
                      toast.success(`${lead.company_name} added to CRM`)
                      if (r.data?.dealId) router.push(`/crm/deals/${r.data.dealId}`)
                    })
                  }
                >
                  {pending ? <Spinner data-icon="inline-start" /> : <ArrowRightLeftIcon data-icon="inline-start" />}
                  Add to CRM
                </Button>
              )}
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
