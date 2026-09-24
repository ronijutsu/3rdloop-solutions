/** Reads a newline-delimited JSON stream (our long-running AI routes), calling onEvent per line. */
export async function readEvents<T>(response: Response, onEvent: (event: T) => void) {
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed (${response.status})`)
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as T)
  }
}
