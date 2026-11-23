export const xp = {
  face: "#ece9d8",
  faceDark: "#d4d0c8",
  highlight: "#ffffff",
  shadow: "#aca899",
  darkShadow: "#716f64",
  frame: "#0054e3",
  frameDark: "#0a3fa8",
  titleStart: "#0058ee",
  titleMid: "#3a93ff",
  titleEnd: "#0050d8",
  titleText: "#ffffff",
  inactiveTitle: "#7a96df",
  close: "#e2432a",
  white: "#ffffff",
  ink: "#000000",
  muted: "#6b6b6b",
  link: "#0000ee",
  buddyBlue: "#0a60a9",
  aimYellow: "#ffd800",
  selfName: "#ff0000",
  claudeName: "#0000ff",
  systemName: "#1b3eb0",
  toolName: "#7a3e00",
  ok: "#1e7b1e",
  danger: "#b00000",
  diffAdd: "#e6ffe6",
  diffAddInk: "#0b6b0b",
  diffDel: "#ffe8e8",
  diffDelInk: "#a40000",
  skyTop: "#2f6cd8",
  skyBottom: "#8ab4f0",
  grassTop: "#5a9e2a",
  grassBottom: "#2f6b12",
  taskbar: "#245edb",
  taskbarLight: "#3c81f3",
  start: "#3c9a3c",
  startLight: "#57b957",
  tray: "#0f8ef3",
  selection: "#316ac5",
} as const

const lerpHex = (from: string, to: string, t: number) => {
  const a = Number.parseInt(from.slice(1), 16)
  const b = Number.parseInt(to.slice(1), 16)
  const channel = (shift: number) => {
    const start = (a >> shift) & 0xff
    const end = (b >> shift) & 0xff
    return Math.round(start + (end - start) * t)
  }
  const value = (channel(16) << 16) | (channel(8) << 8) | channel(0)
  return `#${value.toString(16).padStart(6, "0")}`
}

export const gradientAt = (stops: readonly string[], t: number) => {
  const clamped = Math.min(1, Math.max(0, t))
  const segment = Math.min(stops.length - 2, Math.floor(clamped * (stops.length - 1)))
  const local = clamped * (stops.length - 1) - segment
  return lerpHex(stops[segment] ?? stops[0] ?? "#000000", stops[segment + 1] ?? stops[0] ?? "#000000", local)
}
