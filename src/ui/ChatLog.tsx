import type { ChatEntry } from "../agent/transcript.ts"
import { isRecord, stringField } from "../agent/guards.ts"
import { displayToolName, summarizeTool } from "../agent/tools.ts"
import { xp } from "../theme.ts"
import { useSyntax } from "./syntax.ts"

function Speaker({ name, tint, width }: { name: string; tint: string; width: number }) {
  return (
    <text width={width} bg={xp.white} fg={tint} flexShrink={0}>
      <b>{`${name}:`}</b>
    </text>
  )
}

function UserLine({ name, text, indent }: { name: string; text: string; indent: number }) {
  return (
    <box flexDirection="row" backgroundColor={xp.white}>
      <Speaker name={name} tint={xp.selfName} width={indent} />
      <text bg={xp.white} fg={xp.ink} flexGrow={1} selectable>
        {text}
      </text>
    </box>
  )
}

function AssistantLine({ text, streaming, indent }: { text: string; streaming: boolean; indent: number }) {
  const syntaxStyle = useSyntax()
  return (
    <box flexDirection="row" backgroundColor={xp.white}>
      <Speaker name="Claude" tint={xp.claudeName} width={indent} />
      <markdown
        content={text || " "}
        syntaxStyle={syntaxStyle}
        streaming={streaming}
        fg={xp.ink}
        bg={xp.white}
        conceal
        flexGrow={1}
        flexShrink={1}
        taskMarkers={{ unchecked: "[ ]", checked: "[x]" }}
      />
    </box>
  )
}

function ThinkingLine({ text, streaming, expanded }: { text: string; streaming: boolean; expanded: boolean }) {
  const tail = text.trim().split("\n").filter(Boolean).at(-1) ?? ""
  return (
    <box flexDirection="column" backgroundColor={xp.white}>
      <text bg={xp.white} fg={xp.muted}>
        <i>
          {streaming ? `  Claude is thinking... ${tail.slice(-80)}` : "  (Claude thought it over -- ctrl+t to show)"}
        </i>
      </text>
      {expanded && !streaming ? (
        <text bg={xp.white} fg={xp.muted} paddingLeft={4} selectable>
          <i>{text.trim()}</i>
        </text>
      ) : null}
    </box>
  )
}

const statusMark = { running: "...", done: "", error: " (failed)" } as const

function DiffPreview({ oldText, newText, indent }: { oldText: string; newText: string; indent: number }) {
  const toLines = (text: string) => (text ? text.replace(/\n$/, "").split("\n").slice(0, 8) : [])
  const removed = toLines(oldText)
  const added = toLines(newText)
  return (
    <box flexDirection="column" paddingLeft={indent} backgroundColor={xp.white}>
      {removed.map((line, index) => (
        <text key={`r${index}`} bg={xp.diffDel} fg={xp.diffDelInk} wrapMode="none" truncate>
          {`- ${line}`}
        </text>
      ))}
      {added.map((line, index) => (
        <text key={`a${index}`} bg={xp.diffAdd} fg={xp.diffAddInk} wrapMode="none" truncate>
          {`+ ${line}`}
        </text>
      ))}
    </box>
  )
}

function OutputPreview({ output, tone, indent }: { output: string; tone: "normal" | "error"; indent: number }) {
  const lines = output.trimEnd().split("\n")
  const shown = lines.slice(0, 4)
  const hidden = lines.length - shown.length
  return (
    <box flexDirection="column" paddingLeft={indent} backgroundColor={xp.white}>
      {shown.map((line, index) => (
        <text key={index} bg={xp.white} fg={tone === "error" ? xp.danger : xp.muted} wrapMode="none" truncate>
          {`${index === 0 ? "L " : "  "}${line}`}
        </text>
      ))}
      {hidden > 0 ? (
        <text bg={xp.white} fg={xp.shadow}>
          {`  ... ${hidden} more line${hidden === 1 ? "" : "s"}`}
        </text>
      ) : null}
    </box>
  )
}

function TodoPreview({ input, indent }: { input: Record<string, unknown>; indent: number }) {
  const todos = Array.isArray(input.todos) ? input.todos.filter(isRecord) : []
  return (
    <box flexDirection="column" paddingLeft={indent} backgroundColor={xp.white}>
      {todos.map((todo, index) => {
        const status = stringField(todo, "status")
        const mark = status === "completed" ? "[x]" : status === "in_progress" ? "[>]" : "[ ]"
        return (
          <text key={index} bg={xp.white} fg={status === "completed" ? xp.muted : xp.ink}>
            {`${mark} ${stringField(todo, "content") ?? ""}`}
          </text>
        )
      })}
    </box>
  )
}

function ToolDetail({ entry, indent }: { entry: Extract<ChatEntry, { kind: "tool" }>; indent: number }) {
  if (entry.name === "Edit") {
    return (
      <DiffPreview
        indent={indent}
        oldText={stringField(entry.input, "old_string") ?? ""}
        newText={stringField(entry.input, "new_string") ?? ""}
      />
    )
  }
  if (entry.name === "Write" && entry.status !== "error") {
    return <DiffPreview indent={indent} oldText="" newText={stringField(entry.input, "content") ?? ""} />
  }
  if (entry.name === "TodoWrite") return <TodoPreview indent={indent} input={entry.input} />
  if (!entry.output || entry.name === "Read" || entry.name === "Agent" || entry.name === "Task") return null
  if (entry.status === "error" && entry.output.includes("doesn't want to proceed")) {
    return <OutputPreview indent={indent} output="Declined by you." tone="error" />
  }
  return <OutputPreview indent={indent} output={entry.output} tone={entry.status === "error" ? "error" : "normal"} />
}

function ToolLine({
  entry,
  cwd,
  nested,
  indent,
}: {
  entry: Extract<ChatEntry, { kind: "tool" }>
  cwd: string
  nested: boolean
  indent: number
}) {
  const summary = summarizeTool(entry.name, entry.input, cwd)
  const outcome =
    entry.name === "Read" && entry.status === "done"
      ? ` (${entry.output.split("\n").length} lines)`
      : statusMark[entry.status]
  return (
    <box flexDirection="column" backgroundColor={xp.white}>
      <text bg={xp.white} paddingLeft={nested ? indent + 2 : 0} wrapMode={nested ? "none" : "word"} truncate={nested}>
        {nested ? (
          <span fg={xp.shadow}>{"> "}</span>
        ) : (
          <span fg={xp.systemName}>
            <b>{"*** "}</b>
          </span>
        )}
        <span fg={entry.status === "error" ? xp.danger : xp.toolName}>
          <b>{displayToolName(entry.name)}</b>
        </span>
        <span fg={xp.muted}>{summary ? `(${summary})` : ""}</span>
        <span fg={entry.status === "error" ? xp.danger : xp.shadow}>{outcome}</span>
      </text>
      {nested ? null : <ToolDetail entry={entry} indent={indent} />}
    </box>
  )
}

function NoticeLine({ tone, text }: { tone: "info" | "error" | "system"; text: string }) {
  return (
    <text bg={xp.white} selectable>
      <span fg={tone === "error" ? xp.danger : xp.systemName}>
        <b>{tone === "error" ? "Error" : "System Msg"}</b>
      </span>
      <span fg={tone === "error" ? xp.danger : xp.ink}>{`: ${text}`}</span>
    </text>
  )
}

function ChatEntryView({
  entry,
  screenName,
  cwd,
  showThinking,
  indent,
}: {
  entry: ChatEntry
  screenName: string
  cwd: string
  showThinking: boolean
  indent: number
}) {
  switch (entry.kind) {
    case "user":
      return <UserLine name={screenName} text={entry.text} indent={indent} />
    case "assistant":
      return <AssistantLine text={entry.text} streaming={entry.streaming} indent={indent} />
    case "thinking":
      return <ThinkingLine text={entry.text} streaming={entry.streaming} expanded={showThinking} />
    case "tool":
      return <ToolLine entry={entry} cwd={cwd} nested={entry.parentId !== null} indent={indent} />
    case "notice":
      return <NoticeLine tone={entry.tone} text={entry.text} />
    default: {
      const exhaustive: never = entry
      return exhaustive
    }
  }
}

export function ChatLog({
  entries,
  screenName,
  cwd,
  showThinking,
  greeting,
}: {
  entries: ChatEntry[]
  screenName: string
  cwd: string
  showThinking: boolean
  greeting: string
}) {
  const indent = Math.min(18, Math.max(9, screenName.length + 3))
  return (
    <scrollbox
      flexGrow={1}
      stickyScroll
      stickyStart="bottom"
      style={{
        rootOptions: { backgroundColor: xp.white },
        viewportOptions: { backgroundColor: xp.white },
        contentOptions: { backgroundColor: xp.white, flexDirection: "column", gap: 0, paddingLeft: 1, paddingRight: 1 },
        scrollbarOptions: {
          showArrows: true,
          trackOptions: { foregroundColor: "#c1d3fb", backgroundColor: "#f3f1e6" },
        },
      }}
    >
      <NoticeLine tone="system" text={greeting} />
      {entries.map((entry) => (
        <ChatEntryView
          key={entry.id}
          entry={entry}
          screenName={screenName}
          cwd={cwd}
          showThinking={showThinking}
          indent={indent}
        />
      ))}
    </scrollbox>
  )
}
