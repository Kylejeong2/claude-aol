import type { SessionSnapshot } from "../agent/session.ts"
import { displayToolName } from "../agent/tools.ts"
import { xp } from "../theme.ts"
import { ChatLog } from "./ChatLog.tsx"
import { Chip, fit, MenuRow, Sunken, XpButton, XpWindow } from "./chrome.tsx"
import { Composer, type CommandHint } from "./Composer.tsx"

export type ImActions = {
  send: (text: string) => void
  stop: () => void
  newChat: () => void
  pickModel: () => void
  pickMode: () => void
  pickChat: () => void
}

const activityText = (snapshot: SessionSnapshot) => {
  if (snapshot.phase === "connecting") return "Signing on to Claude..."
  if (snapshot.phase === "closed") return "Claude has signed off."
  if (snapshot.pending.length > 0) return "Claude is waiting for you."
  if (snapshot.phase !== "running") return ""
  if (snapshot.statusNote) return `Claude is busy: ${snapshot.statusNote}`
  const last = snapshot.entries.at(-1)
  if (last?.kind === "thinking") return "Claude is thinking..."
  if (last?.kind === "tool" && last.status === "running") return `Claude is using ${displayToolName(last.name)}...`
  return "Claude is typing a message..."
}

const shortenHome = (path: string) => {
  const home = process.env.HOME
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

function WarningLevel({ percent }: { percent: number | null }) {
  const value = percent === null ? 0 : Math.round(percent)
  const tint = value >= 80 ? xp.danger : value >= 50 ? "#b06000" : xp.ink
  return (
    <text bg={xp.face} fg={tint}>
      {`Claude's Warning Level: ${value}% `}
    </text>
  )
}

function StatusBar({ snapshot, width, hint }: { snapshot: SessionSnapshot; width: number; hint: string | null }) {
  const right = `$${snapshot.costUsd.toFixed(2)}  ${snapshot.permissionMode} `
  const left = hint ?? (activityText(snapshot) || "esc stop  shift+tab mode  ctrl+t thoughts  / commands")
  return (
    <text bg={xp.faceDark} fg={hint ? xp.danger : xp.ink} flexShrink={0} height={1}>
      {fit(` ${left}`, Math.max(0, width - right.length))}
      <span fg={xp.muted}>{right}</span>
    </text>
  )
}

export function ImWindow({
  top,
  left,
  width,
  height,
  snapshot,
  screenName,
  commands,
  focused,
  showThinking,
  hint,
  actions,
  onClose,
}: {
  top: number
  left: number
  width: number
  height: number
  snapshot: SessionSnapshot
  screenName: string
  commands: CommandHint[]
  focused: boolean
  showThinking: boolean
  hint: string | null
  actions: ImActions
  onClose: () => void
}) {
  const inner = width - 2
  const running = snapshot.phase === "running"
  const compactButtons = inner < 70
  return (
    <XpWindow title={`Claude - Instant Message`} top={top} left={left} width={width} height={height} onClose={onClose}>
      <box flexDirection="row" height={1} flexShrink={0} backgroundColor={xp.face}>
        <MenuRow items={["File", "Edit", "Insert", "People"]} width={Math.max(0, inner - 30)} />
        <box flexGrow={1} backgroundColor={xp.face} />
        <WarningLevel percent={snapshot.contextPercent} />
      </box>
      <Sunken flexGrow={1}>
        <ChatLog
          entries={snapshot.entries}
          screenName={screenName}
          cwd={snapshot.cwd}
          showThinking={showThinking}
          greeting={`You are now chatting with Claude in ${shortenHome(snapshot.cwd)}. Type / for commands.`}
        />
      </Sunken>
      <box flexDirection="row" height={1} flexShrink={0} backgroundColor={xp.face} gap={2} paddingLeft={1}>
        <Chip label="Model:" value={snapshot.model ?? "default"} onPress={actions.pickModel} />
        <Chip label="Mode:" value={snapshot.permissionMode} onPress={actions.pickMode} />
        <text bg={xp.face} fg={xp.ink}>
          <b>B</b> <i>I</i> <u>U</u>
        </text>
        <text bg={xp.face} fg={xp.link}>
          <u>{fit(shortenHome(snapshot.cwd), Math.max(4, inner - 60))}</u>
        </text>
      </box>
      <Composer
        focused={focused}
        commands={commands}
        width={inner}
        onSubmit={actions.send}
        footer={(submitDraft) => (
          <box
            flexDirection="row"
            height={4}
            flexShrink={0}
            backgroundColor={xp.face}
            gap={1}
            paddingLeft={1}
            paddingRight={1}
          >
            <XpButton
              icon={"/!\\"}
              label={compactButtons ? "Stop" : "Stop (esc)"}
              accent={xp.danger}
              disabled={!running}
              onPress={actions.stop}
            />
            <XpButton icon="[+]" label="New IM" onPress={actions.newChat} />
            <XpButton icon=":-)" label="Model" onPress={actions.pickModel} />
            <XpButton icon="[#]" label="Mode" onPress={actions.pickMode} />
            <XpButton icon="((o))" label="Chats" onPress={actions.pickChat} />
            <box flexGrow={1} backgroundColor={xp.face} />
            <XpButton icon=">>>" label="Send" accent={xp.danger} width={10} onPress={submitDraft} />
          </box>
        )}
      />
      <StatusBar snapshot={snapshot} width={inner} hint={hint} />
    </XpWindow>
  )
}
