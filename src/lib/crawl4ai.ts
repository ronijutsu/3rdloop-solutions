import "server-only"

// Minimal client for the crawl4ai Docker server (https://github.com/unclecode/crawl4ai).
// Run it with `pnpm crawler` (see docker-compose.yml).

export type CrawledPage = { url: string; markdown: string; title?: string }

type Link = { href?: string; text?: string }
type RawResult = {
  url: string
  success?: boolean
  screenshot?: string | null
  markdown?: string | { raw_markdown?: string; fit_markdown?: string } | null
  metadata?: { title?: string } | null
  links?: { internal?: Link[]; external?: Link[] } | null
}

const MAX_CHARS_PER_PAGE = 12_000

export function crawlerConfigured() {
  return Boolean(process.env.CRAWL4AI_URL)
}

async function crawlRaw(urls: string[], extra: Record<string, unknown> = {}): Promise<RawResult[]> {
  if (!crawlerConfigured()) throw new Error("CRAWL4AI_URL is not set")
  if (urls.length === 0) return []

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (process.env.CRAWL4AI_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.CRAWL4AI_API_TOKEN}`
  }

  const response = await fetch(`${process.env.CRAWL4AI_URL}/crawl`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      urls,
      browser_config: { type: "BrowserConfig", params: { headless: true, viewport_width: 1280, viewport_height: 900 } },
      crawler_config: {
        type: "CrawlerRunConfig",
        params: {
          cache_mode: "bypass",
          page_timeout: 30000,
          excluded_tags: ["nav", "footer", "script", "style"],
          ...extra,
        },
      },
    }),
    signal: AbortSignal.timeout(180_000),
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error("crawl4ai rejected the request. Check CRAWL4AI_API_TOKEN matches the container's token.")
  }
  if (!response.ok) {
    throw new Error(`crawl4ai returned ${response.status}: ${(await response.text()).slice(0, 300)}`)
  }

  const body = (await response.json()) as { results?: RawResult[] }
  return (body.results ?? []).filter((r) => r.success !== false)
}

export async function crawl(urls: string[]): Promise<CrawledPage[]> {
  return (await crawlRaw(urls))
    .map((r) => {
      const md =
        typeof r.markdown === "string" ? r.markdown : r.markdown?.fit_markdown || r.markdown?.raw_markdown || ""
      return { url: r.url, title: r.metadata?.title, markdown: md.slice(0, MAX_CHARS_PER_PAGE) }
    })
    .filter((p) => p.markdown.trim().length > 200)
}

// Hosts that are never a single prospective customer's own website.
const NOT_A_BUSINESS = [
  "duckduckgo.com",
  "google.",
  "bing.com",
  "yahoo.com",
  "wikipedia.org",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.",
  "reddit.com",
  "quora.com",
  "yelp.",
  "yellowpages.",
  "bbb.org",
  "tripadvisor.",
  "glassdoor.",
  "indeed.com",
  "ziprecruiter.",
  "crunchbase.com",
  "zoominfo.com",
  "clutch.co",
  "g2.com",
  "capterra.com",
  "trustpilot.com",
  "angi.com",
  "thumbtack.com",
  "healthgrades.com",
  "zocdoc.com",
  "mapquest.com",
  "apple.com",
  "amazon.",
  "medium.com",
  "forbes.com",
  "nytimes.com",
  "bloomberg.com",
  "chamberofcommerce.com",
  "bizapedia.com",
  "manta.com",
  "dnb.com",
  "opencorporates.com",
  "buzzfile.com",
  "birdeye.com",
  "nextdoor.com",
  "expertise.com",
  "superpages.com",
  // Philippine directories, marketplaces, and job boards
  "yellow-pages.ph",
  "businesslist.ph",
  "philippinecompanies.com",
  "ph.kompass.com",
  "findph.com",
  "jobstreet.",
  "kalibrr.com",
  "lazada.",
  "shopee.",
  "carousell.",
  "lamudi.",
  "foursquare.com",
  "waze.com",
  ".gov",
  ".edu",
]

// ---------------------------------------------------------------------------
// Free web search
// ---------------------------------------------------------------------------
// Search result pages are crawled through crawl4ai, so no paid search API is used.
// DuckDuckGo is tried first; when it shows its bot challenge (it does after many
// searches) or returns nothing, the query falls back to Brave Search.

export type SearchResult = { url: string; title: string; snippet: string }

type Engine = { name: string; url: (q: string) => string; resultUrl: (href: string) => string | null }

const ENGINES: Engine[] = [
  {
    name: "DuckDuckGo",
    // kl=ph-en: the Philippines region, since 3rdLoop only serves the Philippine market.
    url: (q) => `https://html.duckduckgo.com/html/?${new URLSearchParams({ q, kl: "ph-en" })}`,
    resultUrl: (href) => {
      try {
        return new URL(href, "https://duckduckgo.com").searchParams.get("uddg")
      } catch {
        return null
      }
    },
  },
  {
    name: "Brave",
    url: (q) => `https://search.brave.com/search?${new URLSearchParams({ q, source: "web" })}`,
    resultUrl: (href) => {
      if (!/^https?:\/\//.test(href)) return null
      const host = new URL(href).hostname
      return /(^|\.)brave\.com$|bravesoftware|imgs\.search/.test(host) ? null : href
    },
  },
]

const clean = (text: string) =>
  text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()

/** Result links plus the text that follows each one (the snippet), from a results page's markdown. */
function parseResults(markdown: string, engine: Engine): SearchResult[] {
  const results = new Map<string, SearchResult>()
  const link = /\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^)\s]+)[^)]*\)/g
  let current: SearchResult | null = null
  let last = 0
  for (const match of markdown.matchAll(link)) {
    const between = clean(markdown.slice(last, match.index))
    if (current && between.length > 20 && current.snippet.length < 600)
      current.snippet = `${current.snippet} ${between}`.trim()
    last = match.index + match[0].length

    const target = engine.resultUrl(match[2])
    const text = clean(match[1])
    if (!target) continue
    const entry = results.get(target) ?? { url: target, title: "", snippet: "" }
    if (!entry.title && text && !/^[\w.-]+\.[a-z]{2,}\b/i.test(text)) entry.title = text
    // Link texts longer than a title are snippet text (DuckDuckGo wraps its snippets in the result link).
    else if (text.length > entry.snippet.length && text.length > 60) entry.snippet = text
    results.set(target, entry)
    current = entry
  }
  return [...results.values()]
}

/** Runs each query on the first engine that returns results. */
async function search(queries: string[]): Promise<SearchResult[][]> {
  return Promise.all(
    queries.map(async (q) => {
      for (const engine of ENGINES) {
        const [page] = await crawlRaw([engine.url(q)]).catch(() => [])
        const md = typeof page?.markdown === "string" ? page.markdown : (page?.markdown?.raw_markdown ?? "")
        const results = parseResults(md, engine)
        if (results.length > 0) return results
      }
      return []
    })
  )
}

/**
 * Result URLs, interleaved so every query contributes.
 * homepagesOnly collapses results to one homepage per site (for finding companies).
 */
export async function searchWeb(
  queries: string[],
  limit: number,
  { exclude = [], homepagesOnly = false }: { exclude?: string[]; homepagesOnly?: boolean } = {}
): Promise<string[]> {
  const perQuery = await search(queries)
  const picked = new Map<string, string>()
  for (let i = 0; picked.size < limit && perQuery.some((list) => i < list.length); i++) {
    for (const list of perQuery) {
      const result = list[i]
      if (!result || picked.size >= limit) continue
      let target: URL
      try {
        target = new URL(result.url)
      } catch {
        continue
      }
      const host = target.hostname.replace(/^www\./, "")
      if (exclude.some((blocked) => host.includes(blocked))) continue
      const key = homepagesOnly ? host : `${host}${target.pathname}`
      if (!picked.has(key)) picked.set(key, homepagesOnly ? `${target.protocol}//${target.hostname}` : target.href)
    }
  }
  return [...picked.values()]
}

/**
 * Search results with their snippets. Useful where the pages themselves can't be
 * crawled (Reddit and most social sites block anonymous access): the snippet is the
 * page's own words as indexed by the search engine.
 */
export async function searchSnippets(queries: string[]): Promise<SearchResult[]> {
  const byUrl = new Map<string, SearchResult>()
  for (const result of (await search(queries)).flat()) {
    const existing = byUrl.get(result.url)
    if (!existing || result.snippet.length > existing.snippet.length) byUrl.set(result.url, result)
  }
  // Drop "snippets" that are only the result's URL or breadcrumb.
  return [...byUrl.values()].filter(
    (r) => r.snippet.length > 40 && !/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}\/\S*$/i.test(r.snippet)
  )
}

/** Company homepages only, skipping directories, marketplaces, and social networks. */
export function searchBusinesses(queries: string[], limit: number) {
  return searchWeb(queries, limit, { exclude: NOT_A_BUSINESS, homepagesOnly: true })
}

// Bot checks, login walls, and consent screens: a screenshot of these proves nothing.
const BLOCKED_PAGE =
  /security verification|verif(y|ying) (you are|that you are) (not a bot|human)|just a moment|checking your browser|access denied|captcha|enable javascript and cookies|log in to (continue|see)|sign in to continue|you've been blocked|too many requests/i

export type PageCapture = { png: Uint8Array; title: string | null }

/**
 * Screenshot of a page's first screen, or null when the page couldn't be shown
 * (blocked, a bot check, a login wall, or an error).
 */
export async function captureScreenshot(url: string): Promise<PageCapture | null> {
  const [result] = await crawlRaw([url], { screenshot: true, delay_before_return_html: 1.5 }).catch(() => [])
  if (!result?.screenshot) return null
  const md = typeof result.markdown === "string" ? result.markdown : (result.markdown?.raw_markdown ?? "")
  if (md.trim().length < 300 || BLOCKED_PAGE.test(md.slice(0, 3000))) return null
  return { png: Uint8Array.from(Buffer.from(result.screenshot, "base64")), title: result.metadata?.title ?? null }
}
