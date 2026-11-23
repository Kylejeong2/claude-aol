import {
  getSessionMessages,
  listSessions,
  query,
  type CanUseTool,
  type ModelInfo,
  type PermissionMode,
  type PermissionResult,
  type PermissionUpdate,
  type Query,
  type SDKAssistantMessage,
  type SDKMessage,
  type SDKPartialAssistantMessage,
  type SDKSessionInfo,
  type SDKUserMessage,
  type SlashCommand,
} from "@anthropic-ai/claude-agent-sdk"
import { log } from "../log.ts"
import { isRecord, stringField } from "./guards.ts"
import { readAssistantContent, readUserContent, type ChatEntry } from "./transcript.ts"

type QuestionOption = { label: string; description: string }
type Question = { question: string; header: string; options: QuestionOption[]; multiSelect: boolean }
export type PlanChoice = "acceptEdits" | "default" | "keep"
export type PermissionChoice = "once" | "always" | "deny"

export type PendingRequest =
  | {
      kind: "permission"
      id: string
      toolName: string
      input: Record<string, unknown>
      suggestions: PermissionUpdate[]
      reason: string | null
      respond: (choice: PermissionChoice) => void
    }
  | { kind: "question"; id: string; questions: Question[]; respond: (answers: Record<string, string> | null) => void }
  | { kind: "plan"; id: string; plan: string; respond: (choice: PlanChoice) => void }

export type SessionPhase = "connecting" | "ready" | "running" | "closed"

export type SessionSnapshot = {
  phase: SessionPhase
  sessionId: string | null
  cwd: string
  model: string | null
  permissionMode: PermissionMode
  entries: ChatEntry[]
  costUsd: number
  contextPercent: number | null
  models: ModelInfo[]
  commands: SlashCommand[]
  terminalCommands: string[]
  agents: string[]
  mcpServers: { name: string; status: string }[]
  skills: string[]
  account: string | null
  pending: PendingRequest[]
  statusNote: string | null
}

type CarriedOver = Pick<
  SessionSnapshot,
  "models" | "commands" | "terminalCommands" | "agents" | "mcpServers" | "skills" | "account"
>

export type SessionOptions = {
  cwd: string
  resume?: string
  model?: string
  permissionMode?: PermissionMode
  history?: ChatEntry[]
  carriedOver?: CarriedOver
}

export const carryOver = (snapshot: SessionSnapshot): CarriedOver => ({
  models: snapshot.models,
  commands: snapshot.commands,
  terminalCommands: snapshot.terminalCommands,
  agents: snapshot.agents,
  mcpServers: snapshot.mcpServers,
  skills: snapshot.skills,
  account: snapshot.account,
})

const keepKnownStatus = (
  previous: SessionSnapshot["mcpServers"],
  next: SessionSnapshot["mcpServers"],
): SessionSnapshot["mcpServers"] =>
  next.map((server) => {
    const known = previous.find((item) => item.name === server.name)
    return server.status === "pending" && known ? known : server
  })

const parseQuestions = (input: Record<string, unknown>): Question[] => {
  const raw = input.questions
  if (!Array.isArray(raw)) return []
  return raw.filter(isRecord).map((item) => ({
    question: stringField(item, "question") ?? "",
    header: stringField(item, "header") ?? "",
    multiSelect: item.multiSelect === true,
    options: Array.isArray(item.options)
      ? item.options.map((option) => ({
          label: stringField(option, "label") ?? "",
          description: stringField(option, "description") ?? "",
        }))
      : [],
  }))
}

export const loadHistory = async (sessionId: string, cwd: string): Promise<ChatEntry[]> => {
  const messages = await getSessionMessages(sessionId, { dir: cwd })
  const entries: ChatEntry[] = []
  const toolIndex = new Map<string, number>()
  for (const message of messages) {
    if (message.parent_tool_use_id) continue
    const content = isRecord(message.message) ? message.message.content : undefined
    if (message.type === "user") {
      for (const effect of readUserContent(content)) {
        if (effect.kind === "text" && effect.text.startsWith("[Request interrupted"))
          entries.push({ kind: "notice", id: crypto.randomUUID(), tone: "system", text: "You stopped Claude." })
        else if (effect.kind === "text") entries.push({ kind: "user", id: crypto.randomUUID(), text: effect.text })
        else {
          const index = toolIndex.get(effect.toolUseId)
          const tool = index === undefined ? undefined : entries[index]
          if (index !== undefined && tool?.kind === "tool")
            entries[index] = { ...tool, status: effect.isError ? "error" : "done", output: effect.output }
        }
      }
    } else if (message.type === "assistant") {
      for (const effect of readAssistantContent(content)) {
        if (effect.kind === "text" && effect.text.trim())
          entries.push({ kind: "assistant", id: crypto.randomUUID(), text: effect.text, streaming: false })
        if (effect.kind === "toolUse") {
          toolIndex.set(effect.id, entries.length)
          entries.push({
            kind: "tool",
            id: effect.id,
            name: effect.name,
            input: effect.input,
            status: "running",
            output: "",
            parentId: null,
          })
        }
      }
    }
  }
  return entries.map((entry) =>
    entry.kind === "tool" && entry.status === "running" ? { ...entry, status: "done" } : entry,
  )
}

export const recentSessions = (cwd: string): Promise<SDKSessionInfo[]> => listSessions({ dir: cwd, limit: 25 })

export class AgentSession {
  private state: SessionSnapshot
  private published: SessionSnapshot
  private listeners = new Set<() => void>()
  private inbox: SDKUserMessage[] = []
  private wakeInbox: (() => void) | undefined
  private closed = false
  private emitTimer: ReturnType<typeof setTimeout> | undefined
  private streamedMessageIds = new Set<string>()
  private currentMessageId: string | null = null
  private stoppedByUser = false
  private readonly q: Query

  constructor(private readonly options: SessionOptions) {
    this.state = {
      phase: "connecting",
      sessionId: options.resume ?? null,
      cwd: options.cwd,
      model: options.model ?? null,
      permissionMode: options.permissionMode ?? "default",
      entries: options.history ?? [],
      costUsd: 0,
      contextPercent: null,
      models: [],
      commands: [],
      terminalCommands: [],
      agents: [],
      mcpServers: [],
      skills: [],
      account: null,
      pending: [],
      statusNote: null,
      ...options.carriedOver,
    }
    this.published = this.state
    this.q = query({
      prompt: this.inputStream(),
      options: {
        cwd: options.cwd,
        resume: options.resume,
        model: options.model,
        permissionMode: options.permissionMode,
        includePartialMessages: true,
        systemPrompt: { type: "preset", preset: "claude_code" },
        settingSources: ["user", "project", "local"],
        canUseTool: this.handlePermission,
        stderr: (data) => log("claude.stderr", data),
      },
    })
    void this.pump()
    void this.initialize()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.published

  send(text: string) {
    this.addEntry({ kind: "user", id: crypto.randomUUID(), text })
    this.inbox.push({ type: "user", message: { role: "user", content: text }, parent_tool_use_id: null })
    this.wakeInbox?.()
    this.update({ phase: "running" })
  }

  async interrupt() {
    for (const request of this.state.pending) this.cancelPending(request)
    if (this.state.phase !== "running") return
    this.stoppedByUser = true
    await this.q.interrupt().catch((error: unknown) => log("interrupt.failed", String(error)))
  }

  async setModel(model: string) {
    await this.q.setModel(model)
    this.update({ model })
    this.notice("system", `Model set to ${model}`)
  }

  async setPermissionMode(mode: PermissionMode) {
    await this.q.setPermissionMode(mode)
    this.update({ permissionMode: mode })
  }

  async refreshContext() {
    const usage = await this.q.getContextUsage().catch(() => null)
    if (usage) this.update({ contextPercent: usage.percentage })
  }

  notice(tone: "info" | "error" | "system", text: string) {
    this.addEntry({ kind: "notice", id: crypto.randomUUID(), tone, text })
  }

  clearScreen() {
    this.update({ entries: [] })
  }

  close() {
    if (this.closed) return
    this.closed = true
    for (const request of this.state.pending) this.cancelPending(request)
    this.wakeInbox?.()
    this.q.close()
    if (this.emitTimer) clearTimeout(this.emitTimer)
  }

  private async initialize() {
    try {
      const init = await this.q.initializationResult()
      log("init.debug", { agents: init.agents.length, models: init.models.length, resume: this.options.resume ?? null })
      this.update({
        phase: this.state.phase === "connecting" ? "ready" : this.state.phase,
        models: init.models,
        commands: init.commands,
        agents: init.agents.map((agent) => agent.name),
        account: init.account.email ?? null,
      })
      const servers = await this.q.mcpServerStatus().catch(() => [])
      log("mcp.debug", { servers: servers.length, resume: this.options.resume ?? null })
      this.update({
        mcpServers: keepKnownStatus(
          this.state.mcpServers,
          servers.map((server) => ({ name: server.name, status: server.status })),
        ),
      })
      await this.refreshContext()
    } catch (error) {
      if (!this.closed) this.notice("error", `Could not sign on: ${String(error)}`)
    }
  }

  private async *inputStream(): AsyncGenerator<SDKUserMessage> {
    while (!this.closed) {
      const next = this.inbox.shift()
      if (next) {
        yield next
        continue
      }
      await new Promise<void>((resolve) => {
        this.wakeInbox = resolve
      })
    }
  }

  private async pump() {
    try {
      for await (const message of this.q) this.handle(message)
    } catch (error) {
      if (!this.closed) this.notice("error", `Connection lost: ${String(error)}`)
    } finally {
      this.update({ phase: "closed" })
    }
  }

  private handle(message: SDKMessage) {
    switch (message.type) {
      case "stream_event":
        return this.handleStream(message)
      case "assistant":
        return this.handleAssistant(message)
      case "user":
        return this.handleToolResults(message.message.content)
      case "result":
        return this.handleResult(message)
      case "tool_progress":
        return this.update({ statusNote: `${message.tool_name} ${Math.round(message.elapsed_time_seconds)}s` })
      case "system":
        return this.handleSystem(message)
      default:
        log("sdk.unhandled", message.type)
    }
  }

  private handleSystem(message: Extract<SDKMessage, { type: "system" }>) {
    switch (message.subtype) {
      case "init":
        return this.update({
          sessionId: message.session_id,
          model: message.model,
          permissionMode: message.permissionMode,
          skills: message.skills,
          agents: message.agents ?? this.state.agents,
          terminalCommands: message.terminal_slash_commands ?? [],
          mcpServers: keepKnownStatus(
            this.state.mcpServers,
            message.mcp_servers.map((server) => ({ name: server.name, status: server.status })),
          ),
        })
      case "status":
        return this.update({
          statusNote: message.status === "compacting" ? "Compacting conversation..." : null,
          permissionMode: message.permissionMode ?? this.state.permissionMode,
        })
      case "compact_boundary":
        return this.notice("system", "Conversation compacted.")
      case "api_retry":
        return this.notice(
          "error",
          `API error (${message.error}), retrying ${message.attempt}/${message.max_retries}...`,
        )
      case "local_command_output":
        return this.notice("system", message.content)
      case "informational":
        return this.notice(message.level === "warning" ? "error" : "info", message.content)
      case "notification":
        return this.notice("info", message.text)
      default:
        if (!message.subtype.startsWith("hook_")) log("sdk.system", message.subtype)
    }
  }

  private handleStream(message: SDKPartialAssistantMessage) {
    if (message.parent_tool_use_id) return
    const event = message.event
    switch (event.type) {
      case "message_start":
        this.currentMessageId = event.message.id
        this.streamedMessageIds.add(event.message.id)
        if (this.state.phase !== "running") this.update({ phase: "running" })
        return
      case "content_block_start": {
        const id = `${this.currentMessageId}:${event.index}`
        if (event.content_block.type === "text") this.addEntry({ kind: "assistant", id, text: "", streaming: true })
        if (event.content_block.type === "thinking") this.addEntry({ kind: "thinking", id, text: "", streaming: true })
        return
      }
      case "content_block_delta": {
        const id = `${this.currentMessageId}:${event.index}`
        const delta = event.delta
        if (delta.type === "text_delta")
          this.patchEntry(id, (entry) =>
            entry.kind === "assistant" ? { ...entry, text: entry.text + delta.text } : entry,
          )
        if (delta.type === "thinking_delta")
          this.patchEntry(id, (entry) =>
            entry.kind === "thinking" ? { ...entry, text: entry.text + delta.thinking } : entry,
          )
        return
      }
      case "content_block_stop":
        return this.patchEntry(`${this.currentMessageId}:${event.index}`, (entry) =>
          entry.kind === "assistant" || entry.kind === "thinking" ? { ...entry, streaming: false } : entry,
        )
      default:
        return
    }
  }

  private handleAssistant(message: SDKAssistantMessage) {
    if (message.error && !message.parent_tool_use_id) this.notice("error", `Claude hit an error: ${message.error}`)
    const streamed = this.streamedMessageIds.has(message.message.id)
    for (const effect of readAssistantContent(message.message.content)) {
      if (effect.kind === "toolUse") {
        if (this.state.entries.some((entry) => entry.id === effect.id)) continue
        this.addEntry({
          kind: "tool",
          id: effect.id,
          name: effect.name,
          input: effect.input,
          status: "running",
          output: "",
          parentId: message.parent_tool_use_id,
        })
        continue
      }
      if (streamed || message.parent_tool_use_id) continue
      if (effect.kind === "text" && effect.text.trim())
        this.addEntry({ kind: "assistant", id: crypto.randomUUID(), text: effect.text, streaming: false })
    }
  }

  private handleToolResults(content: unknown) {
    for (const effect of readUserContent(content)) {
      if (effect.kind !== "toolResult") continue
      this.patchEntry(effect.toolUseId, (entry) =>
        entry.kind === "tool" ? { ...entry, status: effect.isError ? "error" : "done", output: effect.output } : entry,
      )
    }
  }

  private handleResult(message: Extract<SDKMessage, { type: "result" }>) {
    const interrupted = message.subtype !== "success"
    this.update({
      phase: "ready",
      costUsd: message.total_cost_usd,
      statusNote: null,
      entries: this.state.entries.map((entry) => {
        if ((entry.kind === "assistant" || entry.kind === "thinking") && entry.streaming)
          return { ...entry, streaming: false }
        if (entry.kind === "tool" && entry.status === "running" && interrupted)
          return { ...entry, status: "error", output: entry.output || "Interrupted" }
        return entry
      }),
    })
    if (interrupted && this.stoppedByUser) this.notice("system", "You stopped Claude. What should Claude do instead?")
    this.stoppedByUser = false
    if (message.subtype === "error_max_turns") this.notice("error", "Claude hit the max turn limit.")
    if (message.subtype === "error_max_budget_usd") this.notice("error", "Claude hit the budget limit.")
    void this.refreshContext()
  }

  private handlePermission: CanUseTool = (toolName, input, { signal, suggestions, decisionReason }) =>
    new Promise<PermissionResult>((resolve) => {
      const id = crypto.randomUUID()
      let settled = false
      const finish = (result: PermissionResult) => {
        if (settled) return
        settled = true
        this.update({ pending: this.state.pending.filter((request) => request.id !== id) })
        resolve(result)
      }
      signal.addEventListener("abort", () => finish({ behavior: "deny", message: "Cancelled" }), { once: true })

      if (toolName === "AskUserQuestion") {
        this.pushPending({
          kind: "question",
          id,
          questions: parseQuestions(input),
          respond: (answers) =>
            finish(
              answers
                ? { behavior: "allow", updatedInput: { ...input, answers } }
                : { behavior: "deny", message: "The user dismissed the question.", interrupt: true },
            ),
        })
        return
      }

      if (toolName === "ExitPlanMode") {
        this.pushPending({
          kind: "plan",
          id,
          plan: stringField(input, "plan") ?? "",
          respond: (choice) => {
            if (choice === "keep") {
              finish({ behavior: "deny", message: "The user wants to keep planning.", interrupt: true })
              return
            }
            this.update({ permissionMode: choice })
            finish({
              behavior: "allow",
              updatedInput: input,
              updatedPermissions: [{ type: "setMode", mode: choice, destination: "session" }],
            })
          },
        })
        return
      }

      this.pushPending({
        kind: "permission",
        id,
        toolName,
        input,
        suggestions: suggestions ?? [],
        reason: decisionReason ?? null,
        respond: (choice) => {
          if (choice === "deny") {
            finish({ behavior: "deny", message: "The user declined this action.", interrupt: true })
            return
          }
          finish({
            behavior: "allow",
            updatedInput: input,
            updatedPermissions: choice === "always" ? suggestions : undefined,
          })
        },
      })
    })

  private cancelPending(request: PendingRequest) {
    if (request.kind === "permission") request.respond("deny")
    if (request.kind === "question") request.respond(null)
    if (request.kind === "plan") request.respond("keep")
  }

  private pushPending(request: PendingRequest) {
    this.update({ pending: [...this.state.pending, request] })
  }

  private addEntry(entry: ChatEntry) {
    this.update({ entries: [...this.state.entries, entry] })
  }

  private patchEntry(id: string, patch: (entry: ChatEntry) => ChatEntry) {
    const entries = this.state.entries
    for (let index = entries.length - 1; index >= 0; index--) {
      const entry = entries[index]
      if (entry?.id !== id) continue
      const next = entries.slice()
      next[index] = patch(entry)
      this.update({ entries: next })
      return
    }
  }

  private update(patch: Partial<SessionSnapshot>) {
    this.state = { ...this.state, ...patch }
    if (this.emitTimer) return
    this.emitTimer = setTimeout(() => {
      this.emitTimer = undefined
      this.published = this.state
      for (const listener of this.listeners) listener()
    }, 16)
  }

  get cwd() {
    return this.options.cwd
  }
}
