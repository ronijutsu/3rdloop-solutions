// Minimal shape of Tiptap/ProseMirror JSON used by the exporters.
export type Mark = { type: string; attrs?: Record<string, unknown> }
export type DocNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  text?: string
  marks?: Mark[]
}

export function fileName(title: string, ext: string) {
  const base =
    title
      .trim()
      .replace(/[^\w\- ]+/g, "")
      .replace(/\s+/g, "-") || "document"
  return `${base}.${ext}`
}

export function hasMark(node: DocNode, type: string) {
  return node.marks?.some((m) => m.type === type) ?? false
}

export function linkHref(node: DocNode) {
  return node.marks?.find((m) => m.type === "link")?.attrs?.href as string | undefined
}
