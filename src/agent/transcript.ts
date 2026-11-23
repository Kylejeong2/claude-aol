import { isRecord, stringField } from "./guards.ts"

type ToolStatus = "running" | "done" | "error"

export type ChatEntry =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string; streaming: boolean }
  | { kind: "thinking"; id: string; text: string; streaming: boolean }
  | {
      kind: "tool"
      id: string
      name: string
      input: Record<string, unknown>
      status: ToolStatus
      output: string
      parentId: string | null
    }
  | { kind: "notice"; id: string; tone: "info" | "error" | "system"; text: string }

const hiddenUserText =
  /^<(system-reminder|command-name|command-message|command-args|local-command-caveat|task-notification)>/

const stripMarkup = (text: string) =>
  text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/g, "$1")
    .trim()

const toolResultText = (content: unknown): string => {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((block) => {
      if (stringField(block, "type") === "text") return stringField(block, "text") ?? ""
      if (stringField(block, "type") === "image") return "[image]"
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

export type UserBlockEffect =
  { kind: "text"; text: string } | { kind: "toolResult"; toolUseId: string; output: string; isError: boolean }

export const readUserContent = (content: unknown): UserBlockEffect[] => {
  if (typeof content === "string") {
    const text = stripMarkup(content)
    return text && !hiddenUserText.test(content.trim()) ? [{ kind: "text", text }] : []
  }
  if (!Array.isArray(content)) return []
  return content.flatMap((block): UserBlockEffect[] => {
    const type = stringField(block, "type")
    if (type === "tool_result" && isRecord(block)) {
      return [
        {
          kind: "toolResult",
          toolUseId: stringField(block, "tool_use_id") ?? "",
          output: toolResultText(block.content),
          isError: block.is_error === true,
        },
      ]
    }
    if (type === "text") {
      const raw = stringField(block, "text") ?? ""
      const text = stripMarkup(raw)
      return text && !hiddenUserText.test(raw.trim()) ? [{ kind: "text", text }] : []
    }
    if (type === "image") return [{ kind: "text", text: "[image]" }]
    return []
  })
}

export type AssistantBlockEffect =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "toolUse"; id: string; name: string; input: Record<string, unknown> }

export const readAssistantContent = (content: unknown): AssistantBlockEffect[] => {
  if (!Array.isArray(content)) return []
  return content.flatMap((block): AssistantBlockEffect[] => {
    const type = stringField(block, "type")
    if (type === "text") return [{ kind: "text", text: stringField(block, "text") ?? "" }]
    if (type === "thinking") return [{ kind: "thinking", text: stringField(block, "thinking") ?? "" }]
    if ((type === "tool_use" || type === "server_tool_use" || type === "mcp_tool_use") && isRecord(block)) {
      return [
        {
          kind: "toolUse",
          id: stringField(block, "id") ?? crypto.randomUUID(),
          name: stringField(block, "name") ?? "tool",
          input: isRecord(block.input) ? block.input : {},
        },
      ]
    }
    return []
  })
}
