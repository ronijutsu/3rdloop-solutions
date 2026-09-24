"use client"

import { RadarIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import type { ProblemResearchEvent } from "@/app/api/problems/research/route"
import { SimpleSelect } from "@/components/simple-select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { readEvents } from "@/lib/ndjson"

type Idea = { id: string; title: string; problem: string | null; target_customer: string | null }

/** Researches real, evidenced problems on the web (crawl4ai) for an idea or a stated problem. */
export function ProblemResearch({ ideas, ready }: { ideas: Idea[]; ready: boolean }) {
  const router = useRouter()
  const [topic, setTopic] = useState("")
  const [ideaId, setIdeaId] = useState("")
  const [progress, setProgress] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function pickIdea(id: string) {
    setIdeaId(id)
    const idea = ideas.find((i) => i.id === id)
    // Seed the topic from the idea's hypothesis so research starts from the stated problem.
    if (idea && !topic.trim()) {
      setTopic(
        [idea.problem, idea.target_customer && `for ${idea.target_customer}`].filter(Boolean).join(" ") || idea.title
      )
    }
  }

  async function research() {
    setProgress("Starting…")
    try {
      const response = await fetch("/api/problems/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, ideaId: ideaId || null }),
      })
      await readEvents<ProblemResearchEvent>(response, (event) => {
        if (event.type === "status") setProgress(event.message)
        if (event.type === "error") throw new Error(event.message)
        if (event.type === "done") {
          if (event.found === 0)
            toast.info("No evidenced problems found", { description: "Try a more specific topic." })
          else
            toast.success(`Found ${event.found} problem${event.found === 1 ? "" : "s"} with evidence`, {
              description: `${event.added} added to the list. Review the quotes before promoting any.`,
            })
        }
      })
    } catch (error) {
      toast.error("Research failed", { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setProgress(null)
      startTransition(() => router.refresh())
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Research problems on the web</CardTitle>
        <CardDescription>
          Describe an idea or problem. crawl4ai reads forums, Reddit, reviews, and community posts (Philippines first),
          and AI pulls out real problems with a verbatim quote as evidence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid gap-4 md:grid-cols-[1fr_16rem]">
          <Field>
            <FieldLabel htmlFor="research-topic">Idea or problem</FieldLabel>
            <Textarea
              id="research-topic"
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. small clinics in Metro Manila losing patients because nobody answers the phone after hours"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="research-idea">Related idea (optional)</FieldLabel>
            <SimpleSelect
              id="research-idea"
              options={ideas.map((i) => ({ value: i.id, label: i.title }))}
              value={ideaId}
              onValueChange={pickIdea}
              allowEmpty
              placeholder="None"
            />
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="mt-6 justify-between gap-4">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {progress ?? (!ready && "Needs OPENROUTER_API_KEY and crawl4ai (pnpm crawler).")}
        </span>
        <Button onClick={research} disabled={!ready || progress !== null || topic.trim().length < 5}>
          {progress ? <Spinner data-icon="inline-start" /> : <RadarIcon data-icon="inline-start" />}
          {progress ? "Researching…" : "Research problems"}
        </Button>
      </CardFooter>
    </Card>
  )
}
