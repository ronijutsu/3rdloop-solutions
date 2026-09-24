import type { Content, ContentText, TDocumentDefinitions } from "pdfmake/interfaces"

import { fileName, hasMark, linkHref, type DocNode } from "./types"

function inline(nodes: DocNode[] = []): ContentText[] {
  return nodes.flatMap<ContentText>((node) => {
    if (node.type === "hardBreak") return [{ text: "\n" }]
    if (node.type !== "text" || !node.text) return []
    const href = linkHref(node)
    return [
      {
        text: node.text,
        bold: hasMark(node, "bold"),
        italics: hasMark(node, "italic"),
        decoration:
          hasMark(node, "underline") || href ? "underline" : hasMark(node, "strike") ? "lineThrough" : undefined,
        link: href,
        color: href ? "#0e6e6e" : undefined,
        background: hasMark(node, "code") ? "#f1f1f1" : undefined,
      },
    ]
  })
}

function blocks(nodes: DocNode[] = []): Content[] {
  return nodes.flatMap((node) => block(node))
}

function block(node: DocNode): Content[] {
  const alignment = (node.attrs?.textAlign as "left" | "center" | "right" | "justify" | undefined) ?? undefined
  switch (node.type) {
    case "heading":
      return [{ text: inline(node.content), style: `h${Math.min(Number(node.attrs?.level ?? 1), 3)}`, alignment }]
    case "paragraph":
      return [{ text: inline(node.content), style: "p", alignment }]
    case "bulletList":
      return [{ ul: (node.content ?? []).map((item) => blocks(item.content)), style: "list" }]
    case "orderedList":
      return [{ ol: (node.content ?? []).map((item) => blocks(item.content)), style: "list" }]
    case "blockquote":
      return [{ stack: blocks(node.content), style: "quote" }]
    case "codeBlock":
      return [{ text: node.content?.[0]?.text ?? "", style: "code" }]
    case "horizontalRule":
      return [
        {
          canvas: [{ type: "line", x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.5, lineColor: "#cccccc" }],
          margin: [0, 8, 0, 8],
        },
      ]
    case "table": {
      const rows = (node.content ?? []).map((row) =>
        (row.content ?? []).map((cell) => ({
          stack: blocks(cell.content),
          fillColor: cell.type === "tableHeader" ? "#f1f1f1" : undefined,
        }))
      )
      const width = rows[0]?.length ?? 1
      return [
        {
          table: { widths: Array(width).fill("*"), body: rows },
          layout: "lightHorizontalLines",
          margin: [0, 4, 0, 10],
        },
      ]
    }
    default:
      return node.content ? blocks(node.content) : []
  }
}

export async function exportPdf(title: string, doc: DocNode) {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ])
  pdfMake.addVirtualFileSystem(vfs)

  const definition: TDocumentDefinitions = {
    info: { title, creator: "3rdLoop Solutions" },
    pageMargins: [56, 56, 56, 56],
    content: blocks(doc.content),
    defaultStyle: { fontSize: 10.5, lineHeight: 1.35 },
    styles: {
      h1: { fontSize: 20, bold: true, margin: [0, 12, 0, 6] },
      h2: { fontSize: 15, bold: true, margin: [0, 12, 0, 4] },
      h3: { fontSize: 12, bold: true, margin: [0, 8, 0, 4] },
      p: { margin: [0, 0, 0, 6] },
      list: { margin: [0, 0, 0, 6] },
      quote: { italics: true, color: "#555555", margin: [16, 0, 0, 6] },
      code: { fontSize: 9, background: "#f1f1f1", margin: [0, 0, 0, 6] },
    },
  }

  await pdfMake.createPdf(definition).download(fileName(title, "pdf"))
}
