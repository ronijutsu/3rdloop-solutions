"use client"

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleIcon,
  FileTextIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  VoteIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { useCan } from "@/components/permissions-provider"
import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatDate, fromNow, labelize } from "@/lib/format"
import { BUILD_STEP, PLAYBOOK, stepInfo } from "@/lib/playbook"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

import {
  addQuestion,
  aiHelpAnswer,
  answerQuestion,
  completeStep,
  deleteIdea,
  deleteQuestion,
  dismissSuggestion,
  generateMoreQuestions,
  moveToStage,
  recordStageReview,
  setIdeaStatus,
  setQuestionRequired,
  updateHypothesis,
} from "../actions"
import { HYPOTHESIS_QUESTIONS } from "../hypothesis-form"

type Idea = Database["public"]["Tables"]["ideas"]["Row"]
type Question = Database["public"]["Tables"]["idea_questions"]["Row"] & {
  answerer: { full_name: string | null } | null
}
type Review = Database["public"]["Tables"]["idea_stage_reviews"]["Row"] & {
  author: { full_name: string | null } | null
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "parked", label: "Parked" },
  { value: "killed", label: "Killed" },
  { value: "scaled", label: "Scaled" },
]

export function IdeaWorkspace({
  idea,
  questions,
  reviews,
  decisions,
  documents,
  selectedStep,
  aiEnabled,
}: {
  idea: Idea
  questions: Question[]
  reviews: Review[]
  decisions: { id: string; title: string; status: string }[]
  documents: { id: string; title: string; updated_at: string }[]
  selectedStep: number
  aiEnabled: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editingHypothesis, setEditingHypothesis] = useState(false)
  const can = useCan()
  const editable = can("ideas.edit")

  // Steps after the current one stay locked until the current step is completed.
  const viewing = Math.min(selectedStep, idea.stage)
  const step = stepInfo(viewing)
  const stepQuestions = questions.filter((q) => q.stage === viewing)
  const openFor = (s: number) => questions.filter((q) => q.stage === s && q.required && !q.answer).length
  const blockingBeforeNext = questions.filter((q) => q.stage <= idea.stage && q.required && !q.answer).length
  const emptyStepsBeforeNext = PLAYBOOK.filter(
    (s) => s.step <= idea.stage && !questions.some((q) => q.stage === s.step)
  ).length
  const canAdvance = idea.stage < 10 && blockingBeforeNext === 0 && emptyStepsBeforeNext === 0
  const buildLocked = idea.stage < BUILD_STEP
  const openBeforeBuild = questions.filter((q) => q.stage < BUILD_STEP && q.required && !q.answer).length

  function goToStep(s: number) {
    router.replace(`/ideas/${idea.id}?step=${s}`, { scroll: false })
  }

  function advance() {
    startTransition(async () => {
      const result = await completeStep(idea.id, "go", "")
      if (!result.ok) {
        toast.error("Can't advance yet", { description: result.error })
        return
      }
      const next = result.data?.stage ?? idea.stage
      const projectId = result.data?.projectId
      if (projectId) {
        toast.success("Build unlocked: project created", {
          description: `“${idea.title} — MVP” is in Projects with the MVP checklist as tasks.`,
          action: { label: "Open project", onClick: () => router.push(`/projects/${projectId}`) },
        })
      } else {
        toast.success(`Moved to step ${next}`, { description: stepInfo(next).title })
      }
      goToStep(next)
    })
  }

  function back() {
    startTransition(async () => {
      const result = await moveToStage(idea.id, idea.stage - 1)
      if (!result.ok) {
        toast.error("Couldn't go back", { description: result.error })
        return
      }
      goToStep(idea.stage - 1)
    })
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="self-start" render={<Link href="/ideas" />}>
          <ArrowLeftIcon data-icon="inline-start" />
          All ideas
        </Button>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                Step {idea.stage} of 10 · {stepInfo(idea.stage).phase}
              </Badge>
              {!buildLocked && <Badge>Build unlocked</Badge>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{idea.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <SimpleSelect
              options={STATUS_OPTIONS}
              value={idea.status}
              className="w-32"
              disabled={!editable}
              onValueChange={(status) =>
                startTransition(async () => {
                  const r = await setIdeaStatus(idea.id, status as Idea["status"])
                  if (!r.ok) toast.error("Couldn't update status", { description: r.error })
                })
              }
            />
            {can("decisions.create") && (
              <Button variant="outline" render={<Link href={`/decisions?idea=${idea.id}`} />}>
                <VoteIcon data-icon="inline-start" />
                Put to vote
              </Button>
            )}
            {editable && (
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="ghost" size="icon" />}>
                  <Trash2Icon />
                  <span className="sr-only">Delete idea</span>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this idea?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All questions, answers, and stage reviews are deleted too. Consider marking it “Killed” instead to
                      keep the learning.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => startTransition(() => deleteIdea(idea.id))}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hypothesis</CardTitle>
          <CardDescription className="text-base leading-relaxed text-foreground">
            We believe <Blank value={idea.target_customer} /> has <Blank value={idea.problem} /> and will pay for{" "}
            <Blank value={idea.solution} /> because it produces <Blank value={idea.outcome} />.
          </CardDescription>
          {editable && (
            <CardAction>
              <Button variant="outline" size="sm" onClick={() => setEditingHypothesis(true)}>
                <PencilIcon data-icon="inline-start" />
                Edit
              </Button>
            </CardAction>
          )}
        </CardHeader>
      </Card>

      {/* Stepper: completed and current steps are clickable, later steps are locked. */}
      <nav aria-label="Playbook steps" className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-max gap-2">
          {PLAYBOOK.map((s) => {
            const done = s.step < idea.stage
            const current = s.step === idea.stage
            const locked = s.step > idea.stage
            const open = openFor(s.step)
            return (
              <li key={s.step} className="flex">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => goToStep(s.step)}
                  aria-current={s.step === viewing ? "step" : undefined}
                  title={locked ? `Complete step ${idea.stage} to unlock` : undefined}
                  className={cn(
                    "flex h-full w-36 flex-col justify-start gap-1 rounded-lg border p-3 text-left text-xs transition-colors",
                    !locked && "hover:bg-muted",
                    locked && "cursor-not-allowed opacity-50",
                    s.step === viewing && "border-primary ring-2 ring-primary/20",
                    current && "bg-primary/5"
                  )}
                >
                  <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    {done ? (
                      <CheckCircle2Icon className="size-3.5 text-primary" />
                    ) : locked ? (
                      <LockIcon className="size-3.5" />
                    ) : (
                      <CircleIcon className="size-3.5 fill-primary text-primary" />
                    )}
                    Step {s.step}
                    {!locked && open > 0 && (
                      <Badge variant="outline" className="ml-auto">
                        {open}
                      </Badge>
                    )}
                  </span>
                  <span className="line-clamp-2 font-medium text-foreground">{s.title}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardDescription>
                Step {step.step} · {step.phase}
              </CardDescription>
              <CardTitle className="text-lg">{step.title}</CardTitle>
              <CardDescription>{step.summary}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {step.checklist.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              {step.output && (
                <p className="text-sm">
                  <span className="font-medium">Output:</span> {step.output}
                </p>
              )}
              <p className="text-sm">
                <span className="font-medium">Decision:</span> {step.gate}
              </p>
            </CardContent>
          </Card>

          <QuestionList
            ideaId={idea.id}
            stage={viewing}
            questions={stepQuestions}
            aiEnabled={aiEnabled}
            editable={editable}
          />
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Gate</CardTitle>
              <CardDescription>
                Currently at step {idea.stage}: {stepInfo(idea.stage).title}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {idea.stage < 10 && !canAdvance && (
                <Alert variant="destructive">
                  <LockIcon />
                  <AlertTitle>Step {idea.stage + 1} is locked</AlertTitle>
                  <AlertDescription>
                    {emptyStepsBeforeNext > 0
                      ? `${emptyStepsBeforeNext} step(s) have no questions yet.`
                      : `${blockingBeforeNext} required question${blockingBeforeNext === 1 ? "" : "s"} still unanswered.`}
                  </AlertDescription>
                </Alert>
              )}
              {buildLocked && (
                <p className="text-sm text-muted-foreground">
                  Building (step {BUILD_STEP}) stays locked until every required question in steps 1–{BUILD_STEP - 1} is
                  answered.{" "}
                  <span className="font-medium text-foreground">
                    {openBeforeBuild === 0 ? "All answered so far." : `${openBeforeBuild} to go.`}
                  </span>
                </p>
              )}
            </CardContent>
            {editable && (
              <CardFooter className="gap-2">
                <Button variant="outline" disabled={pending || idea.stage <= 1} onClick={back}>
                  Back
                </Button>
                <Button className="flex-1" disabled={pending || !canAdvance} onClick={advance}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  {idea.stage >= 10 ? "Final step" : `Advance to step ${idea.stage + 1}`}
                  {idea.stage < 10 && <ArrowRightIcon data-icon="inline-end" />}
                </Button>
              </CardFooter>
            )}
          </Card>

          <ReviewPanel
            ideaId={idea.id}
            stage={viewing}
            reviews={reviews.filter((r) => r.stage === viewing)}
            editable={editable}
          />

          <Card>
            <CardHeader>
              <CardTitle>Linked work</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div className="flex flex-col gap-2">
                <span className="font-medium">Decisions</span>
                {decisions.length === 0 && <span className="text-muted-foreground">None yet.</span>}
                {decisions.map((d) => (
                  <Link
                    key={d.id}
                    href={`/decisions/${d.id}`}
                    className="flex items-center justify-between gap-2 hover:underline"
                  >
                    <span className="truncate">{d.title}</span>
                    <Badge variant="outline">{labelize(d.status)}</Badge>
                  </Link>
                ))}
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <span className="font-medium">Documents</span>
                {documents.length === 0 && <span className="text-muted-foreground">None yet.</span>}
                {documents.map((d) => (
                  <Link key={d.id} href={`/documents/${d.id}`} className="flex items-center gap-2 hover:underline">
                    <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{d.title}</span>
                  </Link>
                ))}
                {can("documents.edit") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    render={<Link href={`/documents/new?idea=${idea.id}`} />}
                  >
                    <PlusIcon data-icon="inline-start" />
                    New document
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={editingHypothesis} onOpenChange={setEditingHypothesis}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit hypothesis</DialogTitle>
            <DialogDescription>
              Keep it testable. Update it as research proves or disproves assumptions.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(fd) =>
              startTransition(async () => {
                const r = await updateHypothesis(idea.id, fd)
                if (!r.ok) toast.error("Couldn't save", { description: r.error })
                else setEditingHypothesis(false)
              })
            }
            className="flex flex-col gap-6"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="h-title">Title</FieldLabel>
                <Input id="h-title" name="title" defaultValue={idea.title} required />
              </Field>
              {HYPOTHESIS_QUESTIONS.map((q) => (
                <Field key={q.name}>
                  <FieldLabel htmlFor={`h-${q.name}`}>{q.label}</FieldLabel>
                  <Textarea id={`h-${q.name}`} name={q.name} rows={2} defaultValue={idea[q.name] ?? ""} />
                </Field>
              ))}
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingHypothesis(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Blank({ value }: { value: string | null }) {
  return value ? (
    <strong className="font-medium">{value}</strong>
  ) : (
    <span className="rounded bg-muted px-1.5 text-muted-foreground">[missing]</span>
  )
}

function QuestionList({
  ideaId,
  stage,
  questions,
  aiEnabled,
  editable,
}: {
  ideaId: string
  stage: number
  questions: Question[]
  aiEnabled: boolean
  editable: boolean
}) {
  const [draft, setDraft] = useState("")
  const [pending, startTransition] = useTransition()
  const answered = questions.filter((q) => q.answer).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Questions for step {stage}</CardTitle>
        <CardDescription>
          {questions.length === 0
            ? "No questions yet. This step can't be passed until it has at least one."
            : `${answered} of ${questions.length} answered. Required questions block advancing.`}
        </CardDescription>
        {editable && aiEnabled && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await generateMoreQuestions(ideaId, stage)
                  if (!r.ok) toast.error("Couldn't generate questions", { description: r.error })
                  else toast.success(`Added ${r.data?.count ?? 0} questions`)
                })
              }
            >
              {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
              Ask AI for more
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {questions.length === 0 && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No questions for this step</EmptyTitle>
              <EmptyDescription>
                {editable ? "Add one below or ask AI to generate them." : "Nothing to answer yet."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {questions.map((q) => (
          <QuestionItem key={q.id} question={q} editable={editable} aiEnabled={aiEnabled} />
        ))}
        {editable && (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            action={() =>
              startTransition(async () => {
                const r = await addQuestion(ideaId, stage, draft)
                if (!r.ok) toast.error("Couldn't add question", { description: r.error })
                else setDraft("")
              })
            }
          >
            <Input
              placeholder="Add your own question for this step…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="New question"
            />
            <Button type="submit" variant="secondary" disabled={pending || !draft.trim()}>
              <PlusIcon data-icon="inline-start" />
              Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function QuestionItem({
  question,
  editable,
  aiEnabled,
}: {
  question: Question
  editable: boolean
  aiEnabled: boolean
}) {
  const [value, setValue] = useState(question.answer ?? "")
  const [pending, startTransition] = useTransition()
  const [helping, startHelp] = useTransition()
  const dirty = value.trim() !== (question.answer ?? "").trim()

  function aiHelp() {
    startHelp(async () => {
      const r = await aiHelpAnswer(question.id)
      if (!r.ok) toast.error("AI Help failed", { description: r.error })
      else toast.success("AI suggestion ready", { description: "Review it below the answer." })
    })
  }

  function applyDraft() {
    const draft = question.ai_suggestion ?? ""
    // Keep anything the founder already wrote; the draft goes underneath for them to merge.
    setValue((current) => (current.trim() ? `${current.trim()}\n\n${draft}` : draft))
    toast.success("Draft copied into your answer", { description: "Fill in the [placeholders], then save." })
  }

  function save() {
    startTransition(async () => {
      const r = await answerQuestion(question.id, value)
      if (!r.ok) toast.error("Couldn't save answer", { description: r.error })
      else toast.success("Answer saved")
    })
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4",
        !question.answer && question.required && "border-dashed"
      )}
    >
      <div className="flex items-start gap-3">
        {question.answer ? (
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
        ) : (
          <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <p className="flex-1 text-sm font-medium">{question.question}</p>
        <Badge variant="outline" className="shrink-0">
          {question.source === "ai" ? (
            <>
              <SparklesIcon data-icon="inline-start" />
              AI
            </>
          ) : (
            "Founder"
          )}
        </Badge>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={editable ? "Answer with evidence: numbers, sources, interview notes…" : "Not answered yet"}
        readOnly={!editable}
        rows={value ? 4 : 2}
        aria-label={`Answer: ${question.question}`}
      />

      {question.ai_suggestion && (
        <div className="flex flex-col gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <SparklesIcon className="size-3.5" />
            AI suggestion
            {question.ai_suggested_at && (
              <span className="font-normal text-muted-foreground">· {fromNow(question.ai_suggested_at)}</span>
            )}
          </p>
          <p className="whitespace-pre-wrap">{question.ai_suggestion}</p>
          {question.ai_tips.length > 0 && (
            <div className="text-xs">
              <p className="mb-1 font-medium">How to verify</p>
              <ul className="flex list-disc flex-col gap-0.5 pl-4 text-muted-foreground">
                {question.ai_tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
          {editable && (
            <div className="flex flex-wrap gap-2">
              <Button size="xs" onClick={applyDraft}>
                Use this draft
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  startTransition(async () => {
                    const r = await dismissSuggestion(question.id)
                    if (!r.ok) toast.error("Couldn't dismiss", { description: r.error })
                    else toast.success("Suggestion dismissed")
                  })
                }
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-2">
          <Switch
            size="sm"
            disabled={!editable}
            checked={question.required}
            onCheckedChange={(checked) =>
              startTransition(async () => {
                const r = await setQuestionRequired(question.id, checked)
                if (!r.ok) toast.error("Couldn't update question", { description: r.error })
                else toast.success(checked ? "Marked as required" : "Marked as optional")
              })
            }
          />
          Required
        </label>
        {question.answered_at && (
          <span>
            Answered by {question.answerer?.full_name ?? "a founder"} {fromNow(question.answered_at)}
          </span>
        )}
        {editable && (
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteQuestion(question.id)
                  if (!r.ok) toast.error("Couldn't remove question", { description: r.error })
                  else toast.success("Question removed")
                })
              }
            >
              Remove
            </Button>
            {aiEnabled && (
              <Button variant="outline" size="sm" disabled={helping} onClick={aiHelp}>
                {helping ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                {helping ? "Drafting…" : question.ai_suggestion ? "New suggestion" : "AI Help"}
              </Button>
            )}
            <Button size="sm" disabled={!dirty || pending} onClick={save}>
              {pending && <Spinner data-icon="inline-start" />}
              Save answer
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewPanel({
  ideaId,
  stage,
  reviews,
  editable,
}: {
  ideaId: string
  stage: number
  reviews: Review[]
  editable: boolean
}) {
  const [verdict, setVerdict] = useState<"go" | "no_go" | "revisit">("go")
  const [notes, setNotes] = useState("")
  const [pending, startTransition] = useTransition()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step {stage} review</CardTitle>
        <CardDescription>Record the go / no-go call and why.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editable && (
          <>
            <ToggleGroup
              value={[verdict]}
              onValueChange={(v) => v[0] && setVerdict(v[0] as typeof verdict)}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="go">Go</ToggleGroupItem>
              <ToggleGroupItem value="revisit">Revisit</ToggleGroupItem>
              <ToggleGroupItem value="no_go">No-go</ToggleGroupItem>
            </ToggleGroup>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reasoning and evidence"
              rows={2}
              aria-label="Review notes"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await recordStageReview(ideaId, stage, verdict, notes)
                  if (!r.ok) toast.error("Couldn't save review", { description: r.error })
                  else setNotes("")
                })
              }
            >
              Record review
            </Button>
          </>
        )}
        {editable && reviews.length > 0 && <Separator />}
        {!editable && reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
        {reviews.map((r) => (
          <div key={r.id} className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={r.verdict === "go" ? "default" : r.verdict === "no_go" ? "destructive" : "secondary"}>
                {labelize(r.verdict)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {r.author?.full_name ?? "Founder"} · {formatDate(r.created_at)}
              </span>
            </div>
            {r.notes && <p className="text-muted-foreground">{r.notes}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
