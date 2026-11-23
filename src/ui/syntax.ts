import { RGBA, SyntaxStyle, type CliRenderer } from "@opentui/core"
import { createContext, useContext } from "react"
import { xp } from "../theme.ts"

const color = (hex: string) => RGBA.fromHex(hex)

export const createLightSyntax = (renderer: CliRenderer) =>
  SyntaxStyle.fromStyles(
    {
      default: { fg: color(xp.ink) },
      conceal: { fg: color(xp.shadow) },
      "markup.heading": { fg: color(xp.systemName), bold: true },
      "markup.strong": { fg: color(xp.ink), bold: true },
      "markup.italic": { fg: color(xp.ink), italic: true },
      "markup.strikethrough": { fg: color(xp.muted) },
      "markup.list": { fg: color(xp.buddyBlue), bold: true },
      "markup.quote": { fg: color(xp.muted), italic: true },
      "markup.raw": { fg: color("#8a1b00"), bg: color("#f3f1e6") },
      "markup.raw.block": { fg: color("#202020"), bg: color("#f3f1e6") },
      "markup.link": { fg: color(xp.link), underline: true },
      "markup.link.label": { fg: color(xp.link), underline: true },
      "markup.link.url": { fg: color(xp.link), underline: true },
      keyword: { fg: color("#0000a0"), bold: true },
      string: { fg: color("#a31515") },
      comment: { fg: color("#008000"), italic: true },
      number: { fg: color("#098658") },
      function: { fg: color("#795e26") },
      type: { fg: color("#267f99") },
    },
    renderer.nativeScene,
  )

export const SyntaxContext = createContext<SyntaxStyle | null>(null)

export const useSyntax = () => {
  const syntaxStyle = useContext(SyntaxContext)
  if (!syntaxStyle) throw new Error("SyntaxContext.Provider is missing")
  return syntaxStyle
}
