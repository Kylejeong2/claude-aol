import { useState } from "react"
import { xp } from "../../theme.ts"
import { fit, Sunken } from "../chrome.tsx"
import { Dialog, useListKeys } from "./Dialog.tsx"

export type PickerItem = { label: string; hint?: string; value: string; current?: boolean }

const VISIBLE = 12

export function PickerDialog({
  title,
  prompt,
  items,
  onPick,
  onCancel,
}: {
  title: string
  prompt: string
  items: PickerItem[]
  onPick: (value: string) => void
  onCancel: () => void
}) {
  const [filter, setFilter] = useState("")
  const needle = filter.toLowerCase()
  const shown = items.filter((item) => `${item.label} ${item.hint ?? ""}`.toLowerCase().includes(needle))
  const [selected, setSelected] = useListKeys({
    numbered: false,
    count: shown.length,
    onCancel,
    onConfirm: (index) => {
      const item = shown[index]
      if (item) onPick(item.value)
    },
    onKey: (key) => {
      if (key.name === "backspace") {
        key.preventDefault()
        setFilter((value) => value.slice(0, -1))
        setSelected(0)
        return true
      }
      const typed = key.sequence
      if (!key.ctrl && !key.meta && typed.length === 1 && typed >= " " && typed <= "~") {
        key.preventDefault()
        setFilter((value) => value + typed)
        setSelected(0)
        return true
      }
      return false
    },
  })
  const offset = Math.max(0, Math.min(selected - Math.floor(VISIBLE / 2), shown.length - VISIBLE))
  const visible = shown.slice(offset, offset + VISIBLE)
  const width = 70
  return (
    <Dialog title={title} width={width + 4} height={Math.min(VISIBLE, shown.length) * 2 + 11} onClose={onCancel}>
      <text bg={xp.face} fg={xp.ink}>
        {prompt}
      </text>
      <Sunken height={3}>
        <text bg={xp.white} fg={filter ? xp.ink : xp.shadow}>
          {filter || "Type to filter..."}
        </text>
      </Sunken>
      <box flexDirection="column">
        {visible.length === 0 ? (
          <text bg={xp.face} fg={xp.muted}>
            Nothing matches.
          </text>
        ) : null}
        {visible.map((item, index) => {
          const active = offset + index === selected
          return (
            <box key={item.value} flexDirection="column">
              <text bg={active ? xp.selection : xp.face} fg={active ? xp.white : xp.ink}>
                {fit(` ${active ? ">" : " "} ${item.label}${item.current ? "  (current)" : ""}`, width - 2)}
              </text>
              <text bg={xp.face} fg={xp.muted}>
                {fit(`     ${item.hint ?? ""}`, width - 2)}
              </text>
            </box>
          )
        })}
      </box>
    </Dialog>
  )
}
