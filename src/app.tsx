import type { PermissionMode, SDKSessionInfo } from "@anthropic-ai/claude-agent-sdk"
import { useKeyboard, useSelectionHandler, useTerminalDimensions } from "@opentui/react"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { AgentSession, carryOver, loadHistory, recentSessions, type SessionSnapshot } from "./agent/session.ts"
import { log } from "./log.ts"
import { BuddyList } from "./ui/BuddyList.tsx"
import type { CommandHint } from "./ui/Composer.tsx"
import { Taskbar, Wallpaper } from "./ui/Desktop.tsx"
import { PermissionDialog } from "./ui/dialogs/PermissionDialog.tsx"
import { PickerDialog, type PickerItem } from "./ui/dialogs/PickerDialog.tsx"
import { PlanDialog } from "./ui/dialogs/PlanDialog.tsx"
import { QuestionDialog } from "./ui/dialogs/QuestionDialog.tsx"
import { ImWindow } from "./ui/ImWindow.tsx"
import { SignOn } from "./ui/SignOn.tsx"

type LocalDialog = "model" | "mode" | "chats" | "start"

const modeCycle: PermissionMode[] = ["default", "acceptEdits", "plan", "auto"]

const modeItems: PickerItem[] = [
  { value: "default", label: "default", hint: "Ask before edits and commands" },
  { value: "acceptEdits", label: "acceptEdits", hint: "Auto-accept file edits, ask for the rest" },
  { value: "plan", label: "plan", hint: "Research and plan, no changes" },
  { value: "auto", label: "auto", hint: "A classifier approves safe actions" },
  { value: "dontAsk", label: "dontAsk", hint: "Never ask; deny anything not pre-approved" },
]

const isPermissionMode = (value: string): value is PermissionMode => modeItems.some((item) => item.value === value)

const localCommands: CommandHint[] = [
  { name: "help", description: "Show commands and shortcuts" },
  { name: "new", description: "Start a new IM (fresh conversation)" },
  { name: "clear", description: "Start a new IM (fresh conversation)" },
  { name: "model", description: "Change the model: /model [name]" },
  { name: "mode", description: "Change the permission mode: /mode [name]" },
  { name: "resume", description: "Reopen a recent chat" },
  { name: "cost", description: "Show what this chat has cost" },
  { name: "thinking", description: "Show or hide Claude's thoughts" },
  { name: "sound", description: "Turn the buddy sounds on or off" },
  { name: "exit", description: "Sign off" },
]

const helpText = [
  "Commands: /new, /model [name], /mode [name], /resume, /cost, /thinking, /sound, /exit.",
  "Every other slash command (/compact, /context, /review, skills...) goes straight to Claude Code.",
  "Keys: Enter send, Shift+Enter or Ctrl+J new line, Esc stop Claude, Shift+Tab cycle mode, Ctrl+T thoughts, Ctrl+C twice to sign off.",
].join("\n")

const playSound = (name: "Pop" | "Tink" | "Glass") => {
  if (process.platform !== "darwin") return
  Bun.spawn(["afplay", `/System/Library/Sounds/${name}.aiff`], { stdout: "ignore", stderr: "ignore" })
}

const copyToClipboard = (text: string) => {
  if (process.platform !== "darwin") return
  const copier = Bun.spawn(["pbcopy"], { stdin: "pipe" })
  copier.stdin.write(text)
  copier.stdin.end()
}

function useSession(session: AgentSession): SessionSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot)
}

export function App({
  cwd,
  model,
  screenName,
  onSession,
  onExit,
}: {
  cwd: string
  model: string | undefined
  screenName: string
  onSession: (session: AgentSession) => void
  onExit: () => void
}) {
  const { width, height } = useTerminalDimensions()
  const [session, setSession] = useState(() => {
    const first = new AgentSession({ cwd, model })
    onSession(first)
    return first
  })
  const snapshot = useSession(session)
  const [sessions, setSessions] = useState<SDKSessionInfo[]>([])
  const [dialog, setDialog] = useState<LocalDialog | null>(null)
  const [showThinking, setShowThinking] = useState(false)
  const [sound, setSound] = useState(false)
  const [buddyListOpen, setBuddyListOpen] = useState(true)
  const [signedOn, setSignedOn] = useState(false)
  const [tick, setTick] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const exitArmed = useRef(false)
  const previousPhase = useRef(snapshot.phase)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (signedOn) return
    const timer = setInterval(() => setTick((value) => value + 1), 450)
    return () => clearInterval(timer)
  }, [signedOn])

  useEffect(() => {
    if (signedOn || snapshot.phase === "connecting" || tick < 3) return
    setSignedOn(true)
    if (sound) playSound("Glass")
  }, [signedOn, snapshot.phase, tick, sound])

  useEffect(() => {
    const before = previousPhase.current
    previousPhase.current = snapshot.phase
    if (snapshot.phase !== "ready") return
    if (before === "running" && sound) playSound("Pop")
    recentSessions(cwd)
      .then(setSessions)
      .catch((error: unknown) => log("sessions.failed", String(error)))
  }, [snapshot.phase, cwd, sound])

  useSelectionHandler((selection) => {
    const text = selection.getSelectedText()
    if (!text) return
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => copyToClipboard(text), 200)
  })

  const flash = (text: string) => {
    setHint(text)
    setTimeout(() => setHint((current) => (current === text ? null : current)), 2500)
  }

  const replaceSession = (next: AgentSession) => {
    session.close()
    onSession(next)
    setSession(next)
  }

  const newChat = () => {
    replaceSession(
      new AgentSession({
        cwd,
        model: snapshot.model ?? undefined,
        permissionMode: snapshot.permissionMode,
        carriedOver: carryOver(snapshot),
      }),
    )
    setDialog(null)
  }

  const resumeChat = async (sessionId: string) => {
    setDialog(null)
    log("resume.debug", { closureAgents: snapshot.agents.length, liveAgents: session.getSnapshot().agents.length })
    const history = await loadHistory(sessionId, cwd).catch((error: unknown) => {
      log("history.failed", String(error))
      return []
    })
    const next = new AgentSession({
      cwd,
      resume: sessionId,
      history,
      carriedOver: carryOver(snapshot),
      model: snapshot.model ?? undefined,
      permissionMode: snapshot.permissionMode,
    })
    replaceSession(next)
    next.notice("system", "Chat reopened. Claude remembers everything above.")
  }

  const setModel = (model: string) => {
    setDialog(null)
    session
      .setModel(model)
      .catch((error: unknown) => session.notice("error", `Could not switch model: ${String(error)}`))
  }

  const setMode = (mode: string) => {
    setDialog(null)
    if (!isPermissionMode(mode)) return session.notice("error", `Unknown mode "${mode}".`)
    session
      .setPermissionMode(mode)
      .catch((error: unknown) => session.notice("error", `Could not switch mode: ${String(error)}`))
  }

  const runLocalCommand = (name: string, argument: string) => {
    switch (name) {
      case "help":
        return session.notice("system", helpText)
      case "new":
      case "clear":
        return newChat()
      case "model":
        return argument ? setModel(argument) : setDialog("model")
      case "mode":
        return argument ? setMode(argument) : setDialog("mode")
      case "resume":
        return argument ? void resumeChat(argument) : setDialog("chats")
      case "cost":
        return session.notice("system", `This chat has cost about $${snapshot.costUsd.toFixed(4)}.`)
      case "thinking":
        return setShowThinking((value) => !value)
      case "sound":
        setSound((value) => !value)
        return flash(`Sounds ${sound ? "off" : "on"}`)
      case "exit":
      case "quit":
        return onExit()
      default:
        return undefined
    }
  }

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const command = /^\/(\S+)\s*([\s\S]*)$/.exec(trimmed)
    if (command && [...localCommands.map((item) => item.name), "quit"].includes(command[1] ?? "")) {
      runLocalCommand(command[1] ?? "", (command[2] ?? "").trim())
      return
    }
    if (snapshot.phase === "closed") {
      session.notice("error", "Claude is offline. Start a new IM to sign back on.")
      return
    }
    if (sound) playSound("Tink")
    session.send(trimmed)
  }

  const stop = () => {
    void session.interrupt()
  }

  const request = snapshot.pending[0]
  const modalOpen = !signedOn || dialog !== null || request !== undefined

  useKeyboard((key) => {
    if (key.defaultPrevented) return
    if (key.ctrl && key.name === "c") {
      key.preventDefault()
      if (snapshot.phase === "running") return stop()
      if (exitArmed.current) return onExit()
      exitArmed.current = true
      flash("Press Ctrl+C again to sign off")
      setTimeout(() => {
        exitArmed.current = false
      }, 2000)
      return
    }
    if (modalOpen) return
    if (key.name === "escape" && snapshot.phase === "running") {
      key.preventDefault()
      return stop()
    }
    if (key.name === "tab" && key.shift) {
      key.preventDefault()
      const index = modeCycle.indexOf(snapshot.permissionMode)
      return setMode(modeCycle[(index + 1) % modeCycle.length] ?? "default")
    }
    if (key.ctrl && key.name === "t") {
      key.preventDefault()
      return setShowThinking((value) => !value)
    }
  })

  const commands: CommandHint[] = [
    ...localCommands,
    ...snapshot.commands
      .filter((command) => !snapshot.terminalCommands.includes(command.name))
      .filter((command) => !localCommands.some((local) => local.name === command.name))
      .map((command) => ({ name: command.name, description: command.description })),
  ]

  const taskbarTop = height - 1
  const roomForBuddyList = width >= 110
  const showBuddyList = roomForBuddyList && buddyListOpen
  const buddyWidth = 32
  const windowTop = 1
  const windowHeight = Math.max(10, taskbarTop - windowTop - 1)
  const imLeft = showBuddyList ? buddyWidth + 4 : 1
  const imWidth = Math.max(30, width - imLeft - (showBuddyList ? 2 : 1))

  const pickerFor = (kind: LocalDialog) => {
    switch (kind) {
      case "model":
        return (
          <PickerDialog
            title="Expressions - Pick a model"
            prompt="Which Claude should answer?"
            items={snapshot.models.map((model) => ({
              value: model.value,
              label: model.displayName,
              hint: model.description,
              current: model.value === snapshot.model,
            }))}
            onPick={setModel}
            onCancel={() => setDialog(null)}
          />
        )
      case "mode":
        return (
          <PickerDialog
            title="Permission Mode"
            prompt="How much should Claude ask before acting?"
            items={modeItems.map((item) => ({ ...item, current: item.value === snapshot.permissionMode }))}
            onPick={setMode}
            onCancel={() => setDialog(null)}
          />
        )
      case "chats":
        return (
          <PickerDialog
            title="Recent Chats"
            prompt="Pick a chat to reopen"
            items={sessions.map((info) => ({
              value: info.sessionId,
              label: info.customTitle ?? info.summary ?? info.sessionId,
              hint: `${new Date(info.lastModified).toLocaleString()}${info.gitBranch ? `  (${info.gitBranch})` : ""}`,
              current: info.sessionId === snapshot.sessionId,
            }))}
            onPick={(value) => void resumeChat(value)}
            onCancel={() => setDialog(null)}
          />
        )
      case "start":
        return (
          <PickerDialog
            title="Start"
            prompt="What do you want to do?"
            items={[
              { value: "new", label: "New Instant Message", hint: "Start a fresh conversation" },
              { value: "model", label: "Change Model", hint: snapshot.model ?? "default" },
              { value: "mode", label: "Permission Mode", hint: snapshot.permissionMode },
              { value: "resume", label: "Recent Chats", hint: `${sessions.length} saved` },
              { value: "thinking", label: showThinking ? "Hide Thoughts" : "Show Thoughts", hint: "ctrl+t" },
              { value: "sound", label: sound ? "Mute Sounds" : "Unmute Sounds" },
              { value: "help", label: "Help", hint: "Commands and shortcuts" },
              { value: "exit", label: "Sign Off", hint: "Quit" },
            ]}
            onPick={(value) => {
              setDialog(null)
              runLocalCommand(value, "")
            }}
            onCancel={() => setDialog(null)}
          />
        )
    }
  }

  return (
    <box width={width} height={height}>
      <Wallpaper width={width} height={taskbarTop} />
      {showBuddyList ? (
        <BuddyList
          top={windowTop}
          left={2}
          width={buddyWidth}
          height={windowHeight}
          screenName={screenName}
          snapshot={snapshot}
          sessions={sessions}
          onResume={(id) => void resumeChat(id)}
          onNewChat={newChat}
          onSetup={() => setDialog("start")}
          onSignOff={() => onExit()}
          onMinimize={() => setBuddyListOpen(false)}
          active={false}
        />
      ) : null}
      {signedOn ? (
        <ImWindow
          top={windowTop}
          left={imLeft}
          width={imWidth}
          height={windowHeight}
          snapshot={snapshot}
          screenName={screenName}
          commands={commands}
          focused={!modalOpen}
          showThinking={showThinking}
          hint={hint}
          actions={{
            send,
            stop,
            newChat,
            pickModel: () => setDialog("model"),
            pickMode: () => setDialog("mode"),
            pickChat: () => setDialog("chats"),
          }}
          onClose={() => onExit()}
        />
      ) : (
        <SignOn
          top={Math.max(0, Math.floor((taskbarTop - 22) / 2))}
          left={Math.max(0, Math.floor((width - 36) / 2))}
          screenName={screenName}
          phase={snapshot.phase}
          account={snapshot.account}
          tick={tick}
        />
      )}
      {request?.kind === "permission" ? <PermissionDialog key={request.id} request={request} cwd={cwd} /> : null}
      {request?.kind === "question" ? <QuestionDialog key={request.id} request={request} /> : null}
      {request?.kind === "plan" ? <PlanDialog key={request.id} request={request} height={height} /> : null}
      {!request && dialog ? pickerFor(dialog) : null}
      <Taskbar
        width={width}
        top={taskbarTop}
        onStart={() => setDialog("start")}
        trayText={snapshot.phase === "running" ? "* typing" : snapshot.phase === "closed" ? "offline" : "online"}
        items={[
          ...(roomForBuddyList
            ? [
                {
                  id: "buddy",
                  label: "Buddy List",
                  active: buddyListOpen,
                  onPress: () => setBuddyListOpen((open) => !open),
                },
              ]
            : []),
          { id: "im", label: "Claude - Instant Message", active: true, onPress: () => setDialog(null) },
        ]}
      />
    </box>
  )
}
