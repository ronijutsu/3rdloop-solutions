"use client"

import { CameraIcon, ExternalLinkIcon, QuoteIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { fromNow } from "@/lib/format"

import { captureProblemSource } from "./actions"

/** A link that opens the page scrolled to, and highlighting, the quoted words (URL text fragment). */
export function quoteLink(url: string, quote: string | null) {
  const words = (quote ?? "")
    .replace(/^[“"']|[”"']$/g, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .split(/\s+/)
    .slice(0, 8)
    .join(" ")
  if (!words) return url
  return `${url}${url.includes("#") ? "" : "#"}:~:text=${encodeURIComponent(words)}`
}

const siteName = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function ProblemSource({
  problemId,
  url,
  title,
  evidence,
  screenshotUrl,
  screenshotTakenAt,
  editable,
}: {
  problemId: string
  url: string
  title: string | null
  evidence: string | null
  screenshotUrl: string | null
  screenshotTakenAt: string | null
  editable: boolean
}) {
  const [open, setOpen] = useState(false)
  const [capturing, startCapture] = useTransition()

  function capture() {
    startCapture(async () => {
      const result = await captureProblemSource(problemId)
      if (!result.ok) toast.error("No screenshot captured", { description: result.error })
      else toast.success("Source screenshot captured")
    })
  }

  return (
    // Clicks here shouldn't open the row's edit dialog.
    <div className="mt-1.5 flex items-start gap-3" onClick={(e) => e.stopPropagation()}>
      {screenshotUrl && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 overflow-hidden rounded-md border transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={`View screenshot of ${siteName(url)}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage */}
          <img src={screenshotUrl} alt="" className="h-14 w-24 object-cover object-top" loading="lazy" />
        </button>
      )}
      <div className="flex min-w-0 flex-col gap-1 text-xs">
        <span className="truncate text-muted-foreground" title={url}>
          {title ? `${title} · ` : ""}
          {siteName(url)}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLinkIcon className="size-3" />
            Open source
          </a>
          {evidence && (
            <a
              href={quoteLink(url, evidence)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              title="Opens the page scrolled to the quote, highlighted (Chrome, Edge, Safari)"
            >
              <QuoteIcon className="size-3" />
              Open quote
            </a>
          )}
          {editable && !screenshotUrl && (
            <button
              type="button"
              onClick={capture}
              disabled={capturing}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {capturing ? <Spinner className="size-3" /> : <CameraIcon className="size-3" />}
              {capturing ? "Capturing…" : "Capture screenshot"}
            </button>
          )}
        </div>
      </div>

      {screenshotUrl && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle className="truncate">{title || siteName(url)}</DialogTitle>
              <DialogDescription className="truncate">
                {url}
                {screenshotTakenAt && ` · captured ${fromNow(screenshotTakenAt)}`}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/40">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage */}
              <img src={screenshotUrl} alt={`Screenshot of ${siteName(url)}`} className="w-full" />
            </div>
            {evidence && (
              <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground italic">“{evidence}”</blockquote>
            )}
            <DialogFooter className="gap-2">
              {editable && (
                <Button variant="ghost" disabled={capturing} onClick={capture}>
                  {capturing ? <Spinner data-icon="inline-start" /> : <CameraIcon data-icon="inline-start" />}
                  Recapture
                </Button>
              )}
              <Button variant="outline" render={<a href={url} target="_blank" rel="noreferrer" />}>
                <ExternalLinkIcon data-icon="inline-start" />
                Open source
              </Button>
              {evidence && (
                <Button render={<a href={quoteLink(url, evidence)} target="_blank" rel="noreferrer" />}>
                  <QuoteIcon data-icon="inline-start" />
                  Open at the quote
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
