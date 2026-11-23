import { useEffect, useState } from "react"
import { fit } from "./chrome.tsx"
import { gradientAt, xp } from "../theme.ts"

const skyStops = [xp.skyTop, xp.skyBottom] as const
const grassStops = [xp.grassTop, xp.grassBottom] as const

export function Wallpaper({ width, height }: { width: number; height: number }) {
  const horizon = Math.floor(height * 0.68)
  return (
    <box position="absolute" top={0} left={0} width={width} height={height} flexDirection="column">
      {Array.from({ length: height }, (_, row) => {
        const color =
          row < horizon
            ? gradientAt(skyStops, row / Math.max(1, horizon - 1))
            : gradientAt(grassStops, (row - horizon) / Math.max(1, height - horizon - 1))
        return <box key={row} height={1} width={width} backgroundColor={color} />
      })}
    </box>
  )
}

const formatClock = (date: Date) => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(timer)
  }, [])
  return (
    <text bg={xp.tray} fg={xp.white}>
      {`  ${formatClock(now)}  `}
    </text>
  )
}

export type TaskbarItem = { id: string; label: string; active: boolean; onPress: () => void }

export function Taskbar({
  width,
  top,
  items,
  onStart,
  trayText,
}: {
  width: number
  top: number
  items: TaskbarItem[]
  onStart: () => void
  trayText: string
}) {
  const itemWidth = Math.min(24, Math.max(10, Math.floor((width - 40) / Math.max(1, items.length))))
  return (
    <box
      position="absolute"
      top={top}
      left={0}
      width={width}
      height={1}
      flexDirection="row"
      backgroundColor={xp.taskbar}
    >
      <text onMouseDown={onStart}>
        <span bg={xp.start} fg={xp.white}>
          <b>
            <i>{" > start "}</i>
          </b>
        </span>
      </text>
      <text bg={xp.taskbar}> </text>
      {items.map((item) => (
        <text key={item.id} onMouseDown={item.onPress}>
          <span bg={item.active ? "#1e4fbf" : xp.taskbarLight} fg={xp.white}>
            {fit(` ${item.label}`, itemWidth)}
          </span>
          <span bg={xp.taskbar}> </span>
        </text>
      ))}
      <box flexGrow={1} backgroundColor={xp.taskbar} />
      <text bg={xp.tray} fg={xp.white}>
        {` ${trayText} `}
      </text>
      <Clock />
    </box>
  )
}
