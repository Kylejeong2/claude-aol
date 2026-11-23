import type { TextareaRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useRef, useState, type ReactNode } from "react"
import { xp } from "../theme.ts"
import { fit, Sunken } from "./chrome.tsx"

export type CommandHint = { name: string; description: string }

const keyBindings = [
  { name: "return", action: "submit" as const },
  { name: "kpenter", action: "submit" as const },
  { name: "return", shift: true, action: "newline" as const },
  { name: "return", meta: true, action: "newline" as const },
  { name: "j", ctrl: true, action: "newline" as const },
]

const MAX_SUGGESTIONS = 6

export function Composer({
  focused,
  commands,
  width,
  onSubmit,
  footer,
}: {
  focused: boolean
  commands: CommandHint[]
  width: number
  onSubmit: (text: string) => void
  footer: (submitDraft: () => void) => ReactNode
}) {
  const editor = useRef<TextareaRenderable>(null)
  const [draft, setDraft] = useState("")
  const [selected, setSelected] = useState(0)

  const slashQuery = /^\/(\S*)$/.exec(draft)?.[1]
  const suggestions =
    slashQuery === undefined
      ? []
      : commands
          .filter((command) => command.name.toLowerCase().startsWith(slashQuery.toLowerCase()))
          .slice(0, MAX_SUGGESTIONS)
  const active = Math.min(selected, Math.max(0, suggestions.length - 1))

  const submit = (text: string) => {
    if (!text.trim()) return
    editor.current?.setText("")
    setDraft("")
    setSelected(0)
    onSubmit(text.trim())
  }

  useKeyboard((key) => {
    if (!focused || suggestions.length === 0) return
    if (key.name === "up") {
      key.preventDefault()
      setSelected((active - 1 + suggestions.length) % suggestions.length)
    } else if (key.name === "down") {
      key.preventDefault()
      setSelected((active + 1) % suggestions.length)
    } else if (key.name === "tab") {
      key.preventDefault()
      const pick = suggestions[active]
      if (pick) {
        editor.current?.setText(`/${pick.name} `)
        editor.current?.gotoBufferEnd()
        setDraft(`/${pick.name} `)
      }
    } else if (key.name === "return" && !key.shift && !key.meta) {
      key.preventDefault()
      const pick = suggestions[active]
      if (pick) submit(`/${pick.name}`)
    } else if (key.name === "escape") {
      key.preventDefault()
      editor.current?.setText("")
      setDraft("")
    }
  })

  return (
    <box flexDirection="column" flexShrink={0}>
      {suggestions.length > 0 ? (
        <box
          flexDirection="column"
          border
          borderColor={xp.frame}
          backgroundColor={xp.white}
          height={suggestions.length + 2}
          flexShrink={0}
        >
          {suggestions.map((command, index) => (
            <text
              key={command.name}
              bg={index === active ? xp.selection : xp.white}
              fg={index === active ? xp.white : xp.ink}
            >
              {fit(` /${command.name.padEnd(22)} ${command.description}`, width - 4)}
            </text>
          ))}
        </box>
      ) : null}
      <Sunken height={5}>
        <textarea
          ref={editor}
          focused={focused}
          flexGrow={1}
          placeholder="Send an IM to Claude... (Enter to send, Shift+Enter for a new line, / for commands)"
          placeholderColor={xp.shadow}
          backgroundColor={xp.white}
          focusedBackgroundColor={xp.white}
          textColor={xp.ink}
          focusedTextColor={xp.ink}
          cursorColor={xp.ink}
          wrapMode="word"
          keyBindings={keyBindings}
          onContentChange={() => {
            setDraft(editor.current?.plainText ?? "")
            setSelected(0)
          }}
          onSubmit={() => submit(editor.current?.plainText ?? "")}
        />
      </Sunken>
      {footer(() => submit(editor.current?.plainText ?? ""))}
    </box>
  )
}
