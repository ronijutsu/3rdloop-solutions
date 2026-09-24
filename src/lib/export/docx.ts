import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx"

import { fileName, hasMark, linkHref, type DocNode } from "./types"

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3] as const
const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}

function inline(nodes: DocNode[] = [], extra: { italics?: boolean } = {}): ParagraphChild[] {
  return nodes.flatMap<ParagraphChild>((node) => {
    if (node.type === "hardBreak") return [new TextRun({ text: "", break: 1 })]
    if (node.type !== "text" || !node.text) return []
    const run = new TextRun({
      text: node.text,
      bold: hasMark(node, "bold"),
      italics: hasMark(node, "italic") || extra.italics,
      underline: hasMark(node, "underline") || linkHref(node) ? {} : undefined,
      strike: hasMark(node, "strike"),
      font: hasMark(node, "code") ? "Consolas" : undefined,
      color: linkHref(node) ? "0E6E6E" : undefined,
    })
    const href = linkHref(node)
    return href ? [new ExternalHyperlink({ link: href, children: [run] })] : [run]
  })
}

type Ctx = { list?: { kind: "bullet" | "ordered"; level: number; instance: number }; quote?: boolean }
let listInstance = 0

function blocks(nodes: DocNode[] = [], ctx: Ctx = {}): (Paragraph | Table)[] {
  return nodes.flatMap((node) => block(node, ctx))
}

function block(node: DocNode, ctx: Ctx): (Paragraph | Table)[] {
  const alignment = ALIGN[(node.attrs?.textAlign as string) ?? ""]
  switch (node.type) {
    case "heading": {
      const level = Math.min(Number(node.attrs?.level ?? 1), 3) - 1
      return [new Paragraph({ heading: HEADINGS[level], alignment, children: inline(node.content) })]
    }
    case "paragraph":
      return [
        new Paragraph({
          alignment,
          children: inline(node.content, { italics: ctx.quote }),
          indent: ctx.quote ? { left: 480 } : undefined,
          ...(ctx.list
            ? ctx.list.kind === "bullet"
              ? { bullet: { level: ctx.list.level } }
              : { numbering: { reference: "ordered", level: ctx.list.level, instance: ctx.list.instance } }
            : {}),
        }),
      ]
    case "bulletList":
    case "orderedList": {
      const level = ctx.list ? ctx.list.level + 1 : 0
      const instance = node.type === "orderedList" && !ctx.list ? ++listInstance : (ctx.list?.instance ?? 0)
      const kind = node.type === "bulletList" ? "bullet" : "ordered"
      return (node.content ?? []).flatMap((item) => blocks(item.content, { ...ctx, list: { kind, level, instance } }))
    }
    case "blockquote":
      return blocks(node.content, { ...ctx, quote: true })
    case "codeBlock":
      return (node.content?.[0]?.text ?? "")
        .split("\n")
        .map((line) => new Paragraph({ children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })] }))
    case "horizontalRule":
      return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 } } })]
    case "table":
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: (node.content ?? []).map(
            (row) =>
              new TableRow({
                children: (row.content ?? []).map(
                  (cell) =>
                    new TableCell({
                      children: blocks(cell.content).filter((b): b is Paragraph => b instanceof Paragraph),
                      shading: cell.type === "tableHeader" ? { fill: "F1F1F1" } : undefined,
                    })
                ),
              })
          ),
        }),
        new Paragraph({}),
      ]
    default:
      return node.content ? blocks(node.content, ctx) : []
  }
}

export async function exportDocx(title: string, doc: DocNode) {
  listInstance = 0
  const document = new Document({
    creator: "3rdLoop Solutions",
    title,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [0, 1, 2, 3].map((level) => ({
            level,
            format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN, LevelFormat.DECIMAL][
              level
            ],
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [{ children: blocks(doc.content) }],
  })

  const blob = await Packer.toBlob(document)
  download(blob, fileName(title, "docx"))
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(window.document.createElement("a"), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}
