import type { KeyEvent } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { useState, type ReactNode } from "react"
import { xp } from "../../theme.ts"
import { fit, XpWindow } from "../chrome.tsx"

export function Dialog({
  title,
  width,
  height,
  onClose,
  children,
}: {
  title: string
  width: number
  height: number
  onClose: () => void
  children: ReactNode
}) {
  const terminal = useTerminalDimensions()
  const boundedWidth = Math.min(width, terminal.width - 2)
  const boundedHeight = Math.min(height, terminal.height - 2)
  return (
    <XpWindow
      title={title}
      width={boundedWidth}
      height={boundedHeight}
      top={Math.max(0, Math.floor((terminal.height - boundedHeight) / 2))}
      left={Math.max(0, Math.floor((terminal.width - boundedWidth) / 2))}
      zIndex={100}
      onClose={onClose}
    >
      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1} paddingTop={1} gap={1}>
        {children}
      </box>
    </XpWindow>
  )
}

export type ListOption = { label: string; hint?: string; key?: string }

export function OptionList({ options, selected, width }: { options: ListOption[]; selected: number; width: number }) {
  return (
    <box flexDirection="column">
      {options.map((option, index) => {
        const active = index === selected
        const prefix = option.key ? `${option.key}. ` : "  "
        return (
          <box key={`${index}-${option.label}`} flexDirection="column">
            <text bg={active ? xp.selection : xp.face} fg={active ? xp.white : xp.ink}>
              {fit(` ${active ? ">" : " "} ${prefix}${option.label}`, width)}
            </text>
            {option.hint ? (
              <text bg={xp.face} fg={xp.muted}>
                {fit(`      ${option.hint}`, width)}
              </text>
            ) : null}
          </box>
        )
      })}
    </box>
  )
}

export function useListKeys({
  count,
  onConfirm,
  onCancel,
  onKey,
  numbered = true,
}: {
  numbered?: boolean
  count: number
  onConfirm: (index: number) => void
  onCancel: () => void
  onKey?: (key: KeyEvent, selected: number) => boolean
}) {
  const [selected, setSelected] = useState(0)
  const clamped = Math.min(selected, Math.max(0, count - 1))
  useKeyboard((key) => {
    if (onKey?.(key, clamped)) return
    key.preventDefault()
    if (key.name === "escape") return onCancel()
    if (key.name === "up" || (key.ctrl && key.name === "p"))
      return setSelected((clamped - 1 + count) % Math.max(1, count))
    if (key.name === "down" || key.name === "tab" || (key.ctrl && key.name === "n"))
      return setSelected((clamped + 1) % Math.max(1, count))
    if (key.name === "return") return onConfirm(clamped)
    const digit = Number.parseInt(key.name, 10)
    if (numbered && digit >= 1 && digit <= count) onConfirm(digit - 1)
  })
  return [clamped, setSelected] as const
}
