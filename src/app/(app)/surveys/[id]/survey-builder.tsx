"use client"

import { ArrowLeftIcon, CopyIcon, ExternalLinkIcon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatDate } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"

import {
  addSurveyQuestion,
  aiAppendQuestions,
  deleteSurvey,
  removeSurveyQuestion,
  setSurveyStatus,
  updateSurveyQuestion,
} from "../actions"

type Tables = Database["public"]["Tables"]
type Question = Tables["survey_questions"]["Row"]
type Response = Tables["survey_responses"]["Row"]
type Kind = "text" | "long_text" | "single" | "multi" | "scale"

const KINDS = [
  { value: "text", label: "Short answer" },
  { value: "long_text", label: "Paragraph" },
  { value: "single", label: "Single choice" },
  { value: "multi", label: "Multiple choice" },
  { value: "scale", label: "Scale 1–5" },
]

export function SurveyBuilder({
  survey,
  questions,
  responses,
  siteUrl,
  aiEnabled,
  editable,
}: {
  survey: Tables["surveys"]["Row"]
  questions: Question[]
  responses: Response[]
  siteUrl: string
  aiEnabled: boolean
  editable: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [audience, setAudience] = useState("")
  const shareUrl = `${siteUrl}/s/${survey.id}`

  return (
    <>
      <Button variant="ghost" size="sm" className="self-start" render={<Link href="/surveys" />}>
        <ArrowLeftIcon data-icon="inline-start" />
        All surveys
      </Button>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{survey.title}</h1>
          {survey.description && <p className="text-sm text-muted-foreground">{survey.description}</p>}
        </div>
        {editable && (
          <div className="flex items-center gap-2">
            <ToggleGroup
              value={[survey.status]}
              onValueChange={(v) =>
                v[0] &&
                startTransition(async () => {
                  const r = await setSurveyStatus(survey.id, v[0] as "draft" | "active" | "closed")
                  if (!r.ok) toast.error("Couldn't update status", { description: r.error })
                })
              }
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="draft">Draft</ToggleGroupItem>
              <ToggleGroupItem value="active">Live</ToggleGroupItem>
              <ToggleGroupItem value="closed">Closed</ToggleGroupItem>
            </ToggleGroup>
            <ConfirmDialog
              title="Delete this survey?"
              description="All questions and responses are deleted too. This can't be undone."
              onConfirm={() => deleteSurvey(survey.id)}
              trigger={
                <Button variant="ghost" size="icon-sm">
                  <Trash2Icon />
                  <span className="sr-only">Delete survey</span>
                </Button>
              }
            />
          </div>
        )}
      </div>

      <InputGroup className="max-w-xl">
        <InputGroupInput readOnly value={shareUrl} aria-label="Public survey link" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl)
              toast.success("Link copied")
            }}
          >
            <CopyIcon />
            <span className="sr-only">Copy link</span>
          </InputGroupButton>
          <InputGroupButton size="icon-xs" render={<a href={shareUrl} target="_blank" rel="noreferrer" />}>
            <ExternalLinkIcon />
            <span className="sr-only">Open survey</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {survey.status !== "active" && (
        <p className="-mt-3 text-xs text-muted-foreground">The link only accepts responses while the survey is Live.</p>
      )}

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
          <TabsTrigger value="results">Results ({responses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4 flex flex-col gap-4">
          {editable && aiEnabled && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Draft questions with AI</CardTitle>
                <CardDescription>
                  Follows the playbook: past behaviour, current solutions, cost, budget owner.
                </CardDescription>
                <CardAction className="flex gap-2">
                  <Input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="Audience"
                    className="w-48"
                    aria-label="Audience"
                  />
                  <Button
                    disabled={!aiEnabled || pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await aiAppendQuestions(survey.id, audience)
                        if (!r.ok) toast.error("Couldn't draft questions", { description: r.error })
                        else toast.success(`Added ${r.data?.count} questions`)
                      })
                    }
                  >
                    {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                    Generate
                  </Button>
                </CardAction>
              </CardHeader>
            </Card>
          )}
          {questions.map((q, i) => (
            <QuestionEditor key={q.id} question={q} index={i} editable={editable} />
          ))}
          {editable && (
            <Button
              variant="outline"
              className="self-start"
              disabled={pending}
              onClick={() => startTransition(async () => void (await addSurveyQuestion(survey.id, questions.length)))}
            >
              <PlusIcon data-icon="inline-start" />
              Add question
            </Button>
          )}
        </TabsContent>

        <TabsContent value="results" className="mt-4 flex flex-col gap-4">
          {responses.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No responses yet</EmptyTitle>
                <EmptyDescription>Set the survey Live and share the link.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {questions.map((q) => (
                <ResultSummary key={q.id} question={q} responses={responses} />
              ))}
              <Card>
                <CardHeader>
                  <CardTitle>Respondents</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responses.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.respondent_name ?? "Anonymous"}</TableCell>
                          <TableCell>{r.respondent_email ?? "—"}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatDate(r.created_at, "MMM d, h:mm a")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}

function QuestionEditor({ question, index, editable }: { question: Question; index: number; editable: boolean }) {
  const [prompt, setPrompt] = useState(question.prompt)
  const [optionsText, setOptionsText] = useState(question.options.join("\n"))
  const [, startTransition] = useTransition()
  const hasOptions = question.kind === "single" || question.kind === "multi"

  const save = (values: Parameters<typeof updateSurveyQuestion>[1]) =>
    startTransition(async () => {
      const r = await updateSurveyQuestion(question.id, values)
      if (!r.ok) toast.error("Couldn't save question", { description: r.error })
    })

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <span className="pt-2 text-sm font-medium text-muted-foreground">{index + 1}.</span>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={() => prompt !== question.prompt && save({ prompt })}
            rows={1}
            readOnly={!editable}
            className="min-h-9 flex-1"
            aria-label={`Question ${index + 1}`}
          />
          <SimpleSelect
            className="md:w-44"
            disabled={!editable}
            options={KINDS}
            value={question.kind}
            onValueChange={(kind) => save({ kind: kind as Kind })}
          />
        </div>
        {hasOptions && (
          <Field>
            <FieldLabel htmlFor={`opts-${question.id}`}>Options (one per line)</FieldLabel>
            <Textarea
              id={`opts-${question.id}`}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              onBlur={() =>
                save({
                  options: optionsText
                    .split("\n")
                    .map((o) => o.trim())
                    .filter(Boolean),
                })
              }
              rows={3}
              readOnly={!editable}
            />
          </Field>
        )}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              size="sm"
              disabled={!editable}
              checked={question.required}
              onCheckedChange={(required) => save({ required })}
            />
            Required
          </label>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startTransition(async () => void (await removeSurveyQuestion(question.id)))}
            >
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ResultSummary({ question, responses }: { question: Question; responses: Response[] }) {
  const answers = responses
    .map((r) => (r.answers as Record<string, unknown>)[question.id])
    .filter((a) => a !== undefined && a !== null && a !== "")

  let body: React.ReactNode
  if (question.kind === "single" || question.kind === "multi" || question.kind === "scale") {
    const choices = question.kind === "scale" ? ["1", "2", "3", "4", "5"] : question.options
    const counts = new Map(choices.map((c) => [c, 0]))
    for (const a of answers)
      for (const v of Array.isArray(a) ? a : [a]) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1)
    const avg =
      question.kind === "scale" && answers.length
        ? (answers.reduce<number>((s, a) => s + Number(a), 0) / answers.length).toFixed(1)
        : null
    body = (
      <div className="flex flex-col gap-2">
        {avg && (
          <p className="text-sm">
            Average: <span className="font-medium">{avg}</span> / 5
          </p>
        )}
        {[...counts].map(([choice, count]) => (
          <div key={choice} className="grid grid-cols-[minmax(0,12rem)_1fr_3rem] items-center gap-3 text-sm">
            <span className="truncate">{choice}</span>
            <Progress value={answers.length ? (count / answers.length) * 100 : 0} aria-label={choice} />
            <span className="text-right text-muted-foreground tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    )
  } else {
    body = (
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto text-sm">
        {answers.map((a, i) => (
          <li key={i} className="rounded-md bg-muted/50 p-2 whitespace-pre-wrap">
            {String(a)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{question.prompt}</CardTitle>
        <CardDescription>
          <Badge variant="outline">{answers.length} answers</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
