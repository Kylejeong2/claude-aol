import type { ReactNode } from "react"
import { gradientAt, xp } from "../theme.ts"

const titleStops = [xp.titleStart, xp.titleMid, xp.titleEnd] as const
const inactiveStops = ["#7a96df", "#a6b9ef", "#7a96df"] as const

export const fit = (text: string, width: number) =>
  width <= 0 ? "" : text.length > width ? `${text.slice(0, Math.max(0, width - 1))}~` : text.padEnd(width)

function GradientRow({
  text,
  width,
  stops = titleStops,
  fg = xp.titleText,
  bold = true,
}: {
  text: string
  width: number
  stops?: readonly string[]
  fg?: string
  bold?: boolean
}) {
  const cells = fit(text, width).split("")
  return (
    <text>
      {cells.map((cell, index) => (
        <span key={index} bg={gradientAt(stops, index / Math.max(1, width - 1))} fg={fg}>
          {bold ? <b>{cell}</b> : cell}
        </span>
      ))}
    </text>
  )
}

function TitleBar({
  title,
  width,
  active = true,
  onClose,
  onMinimize,
}: {
  title: string
  width: number
  active?: boolean
  onClose?: () => void
  onMinimize?: () => void
}) {
  const controlsWidth = 9
  return (
    <box flexDirection="row" height={1} width={width}>
      <GradientRow text={` ${title}`} width={width - controlsWidth} stops={active ? titleStops : inactiveStops} />
      <box flexDirection="row" backgroundColor={active ? xp.titleEnd : inactiveStops[2]}>
        <text bg={active ? xp.titleEnd : inactiveStops[2]} fg={xp.white} onMouseDown={onMinimize}>
          <span bg="#2a6fe8"> _ </span>
        </text>
        <text bg={active ? xp.titleEnd : inactiveStops[2]} fg={xp.white}>
          <span bg="#2a6fe8">[]</span>
        </text>
        <text bg={active ? xp.titleEnd : inactiveStops[2]}> </text>
        <text fg={xp.white} onMouseDown={onClose}>
          <span bg={xp.close}>
            <b> X </b>
          </span>
        </text>
      </box>
    </box>
  )
}

export function XpWindow({
  title,
  width,
  height,
  active = true,
  onClose,
  onMinimize,
  children,
  top,
  left,
  zIndex,
}: {
  title: string
  width: number
  height: number
  active?: boolean
  onClose?: () => void
  onMinimize?: () => void
  children: ReactNode
  top: number
  left: number
  zIndex?: number
}) {
  return (
    <box position="absolute" top={top} left={left} width={width} height={height} zIndex={zIndex} flexDirection="column">
      <TitleBar title={title} width={width} active={active} onClose={onClose} onMinimize={onMinimize} />
      <box
        flexGrow={1}
        flexDirection="column"
        backgroundColor={xp.face}
        border={["left", "right", "bottom"]}
        borderColor={active ? xp.frame : xp.inactiveTitle}
      >
        {children}
      </box>
    </box>
  )
}

export function Sunken({
  children,
  bg = xp.white,
  flexGrow,
  height,
}: {
  children: ReactNode
  bg?: string
  flexGrow?: number
  height?: number
}) {
  return (
    <box
      border={["top", "left"]}
      borderColor={xp.shadow}
      backgroundColor={bg}
      flexGrow={flexGrow}
      height={height}
      flexShrink={height === undefined ? 1 : 0}
      minHeight={height === undefined ? 3 : undefined}
    >
      <box
        border={["bottom", "right"]}
        borderColor={xp.highlight}
        backgroundColor={bg}
        flexGrow={1}
        flexDirection="column"
      >
        {children}
      </box>
    </box>
  )
}

export function MenuRow({ items, right, width }: { items: string[]; right?: string; width: number }) {
  const left = items.map((item) => ` ${item} `).join("")
  const rightText = right ?? ""
  const gap = Math.max(1, width - left.length - rightText.length - 1)
  const line = fit(`${left}${" ".repeat(gap)}${rightText}`, width)
  return (
    <text bg={xp.face} fg={xp.ink} height={1}>
      {line}
    </text>
  )
}

export function XpButton({
  label,
  icon,
  onPress,
  disabled = false,
  accent,
  width,
}: {
  label: string
  icon?: string
  onPress: () => void
  disabled?: boolean
  accent?: string
  width?: number
}) {
  const ink = disabled ? xp.shadow : xp.ink
  return (
    <box
      border
      borderStyle="rounded"
      borderColor={disabled ? xp.shadow : "#003c74"}
      backgroundColor="#f6f5ef"
      width={width}
      alignItems="center"
      flexDirection="column"
      onMouseDown={disabled ? undefined : onPress}
    >
      {icon ? (
        <text fg={disabled ? xp.shadow : (accent ?? xp.buddyBlue)} bg="#f6f5ef">
          <b>{icon}</b>
        </text>
      ) : null}
      <text fg={ink} bg="#f6f5ef">
        {label}
      </text>
    </box>
  )
}

export function Chip({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <text bg={xp.face} onMouseDown={onPress}>
      <span fg={xp.buddyBlue}>
        <b>{label}</b>
      </span>
      <span fg={xp.ink}> {value} </span>
    </text>
  )
}
