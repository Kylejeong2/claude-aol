import type { SDKSessionInfo } from "@anthropic-ai/claude-agent-sdk"
import { useState } from "react"
import type { SessionSnapshot } from "../agent/session.ts"
import { xp } from "../theme.ts"
import { fit, MenuRow, Sunken, XpWindow } from "./chrome.tsx"

type Buddy = { id: string; name: string; status?: string; away?: boolean; onPress?: () => void }
type Group = { id: string; title: string; buddies: Buddy[] }

const relativeTime = (millis: number) => {
  const minutes = Math.round((Date.now() - millis) / 60_000)
  if (minutes < 60) return `${minutes}m`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / (60 * 24))}d`
}

function Spark() {
  return (
    <text fg={xp.aimYellow} bg={xp.buddyBlue}>
      <b>{"  \\ | /\n -- * --\n  / | \\"}</b>
    </text>
  )
}

function GroupView({
  group,
  collapsed,
  onToggle,
  width,
}: {
  group: Group
  collapsed: boolean
  onToggle: () => void
  width: number
}) {
  return (
    <box flexDirection="column">
      <text bg={xp.white} fg={xp.ink} onMouseDown={onToggle}>
        <b>{fit(`${collapsed ? "+" : "-"} ${group.title} (${group.buddies.length})`, width)}</b>
      </text>
      {collapsed
        ? null
        : group.buddies.map((buddy) => (
            <text key={buddy.id} bg={xp.white} onMouseDown={buddy.onPress}>
              <span fg={buddy.away ? xp.shadow : xp.ink}>
                {fit(`   ${buddy.name}`, Math.max(4, width - (buddy.status?.length ?? 0) - 1))}
              </span>
              <span fg={xp.muted}>{buddy.status ? ` ${buddy.status}` : ""}</span>
            </text>
          ))}
    </box>
  )
}

export function BuddyList({
  top,
  left,
  width,
  height,
  screenName,
  snapshot,
  sessions,
  onResume,
  onNewChat,
  onSetup,
  onSignOff,
  onMinimize,
  active,
}: {
  top: number
  left: number
  width: number
  height: number
  screenName: string
  snapshot: SessionSnapshot
  sessions: SDKSessionInfo[]
  onResume: (sessionId: string) => void
  onNewChat: () => void
  onSetup: () => void
  onSignOff: () => void
  onMinimize: () => void
  active: boolean
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["skills", "agents"]))
  const inner = width - 4
  const claudeStatus =
    snapshot.phase === "running"
      ? "typing"
      : snapshot.phase === "connecting"
        ? "signing on"
        : snapshot.phase === "closed"
          ? "offline"
          : "idle"
  const groups: Group[] = [
    {
      id: "buddies",
      title: "Buddies",
      buddies: [{ id: "claude", name: "Claude", status: claudeStatus, away: snapshot.phase === "closed" }],
    },
    {
      id: "recent",
      title: "Recent Chats",
      buddies: sessions.map((session) => ({
        id: session.sessionId,
        name: session.customTitle ?? session.summary ?? session.firstPrompt ?? session.sessionId.slice(0, 8),
        status: relativeTime(session.lastModified),
        away: session.sessionId !== snapshot.sessionId,
        onPress: () => onResume(session.sessionId),
      })),
    },
    {
      id: "mcp",
      title: "MCP Servers",
      buddies: snapshot.mcpServers.map((server) => ({
        id: server.name,
        name: server.name,
        status: server.status === "connected" ? "" : server.status,
        away: server.status !== "connected",
      })),
    },
    { id: "agents", title: "Agents", buddies: snapshot.agents.map((agent) => ({ id: agent, name: agent })) },
    { id: "skills", title: "Skills", buddies: snapshot.skills.map((skill) => ({ id: skill, name: skill })) },
  ]
  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <XpWindow
      title="Buddy List"
      top={top}
      left={left}
      width={width}
      height={height}
      active={active}
      onClose={onSignOff}
      onMinimize={onMinimize}
    >
      <MenuRow items={["My Claude", "People", "Help"]} width={width - 2} />
      <box flexDirection="row" backgroundColor={xp.buddyBlue} height={4} paddingTop={0} gap={1}>
        <Spark />
        <box flexDirection="column" backgroundColor={xp.buddyBlue} paddingTop={0}>
          <text fg={xp.white} bg={xp.buddyBlue}>
            <b>Claude</b>
          </text>
          <text fg={xp.aimYellow} bg={xp.buddyBlue}>
            <i>Instant Messenger</i>
          </text>
          <text fg="#c9dcf5" bg={xp.buddyBlue}>
            {fit(`${screenName}'s list`, Math.max(4, width - 14))}
          </text>
        </box>
      </box>
      <text bg={xp.face} fg={xp.ink}>
        <span fg={xp.buddyBlue}>
          <b> Online </b>
        </span>
        <span fg={xp.muted}>| List Setup</span>
      </text>
      <Sunken flexGrow={1}>
        <scrollbox
          flexGrow={1}
          style={{ rootOptions: { backgroundColor: xp.white }, contentOptions: { backgroundColor: xp.white } }}
        >
          {groups.map((group) => (
            <GroupView
              key={group.id}
              group={group}
              collapsed={collapsed.has(group.id)}
              onToggle={() => toggle(group.id)}
              width={inner}
            />
          ))}
        </scrollbox>
      </Sunken>
      <box flexDirection="row" justifyContent="space-around" backgroundColor={xp.face} height={2}>
        <text bg={xp.face} fg={xp.buddyBlue} onMouseDown={onNewChat}>
          <b>{" [+]\n IM"}</b>
        </text>
        <text bg={xp.face} fg={xp.buddyBlue} onMouseDown={onSetup}>
          <b>{" {*}\nSetup"}</b>
        </text>
        <text bg={xp.face} fg={xp.ok} onMouseDown={onSignOff}>
          <b>{" (>\nSign Off"}</b>
        </text>
      </box>
    </XpWindow>
  )
}
