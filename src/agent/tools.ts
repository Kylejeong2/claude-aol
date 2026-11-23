import { stringField } from "./guards.ts"

const firstLine = (text: string, max = 90) => {
  const line = text.split("\n")[0] ?? ""
  return line.length > max ? `${line.slice(0, max - 3)}...` : line
}

const shortPath = (path: string, cwd: string) => (path.startsWith(`${cwd}/`) ? path.slice(cwd.length + 1) : path)

export const summarizeTool = (name: string, input: Record<string, unknown>, cwd: string) => {
  const path = stringField(input, "file_path") ?? stringField(input, "notebook_path") ?? stringField(input, "path")
  switch (name) {
    case "Bash":
      return firstLine(stringField(input, "command") ?? "")
    case "Read":
    case "Write":
    case "Edit":
    case "NotebookEdit":
      return path ? shortPath(path, cwd) : ""
    case "Glob":
    case "Grep":
      return firstLine(`${stringField(input, "pattern") ?? ""}${path ? ` in ${shortPath(path, cwd)}` : ""}`)
    case "WebSearch":
      return `"${firstLine(stringField(input, "query") ?? "")}"`
    case "WebFetch":
      return firstLine(stringField(input, "url") ?? "")
    case "Agent":
    case "Task":
      return firstLine(stringField(input, "description") ?? stringField(input, "subagent_type") ?? "")
    case "Skill":
      return stringField(input, "skill") ?? stringField(input, "command") ?? ""
    case "TodoWrite":
      return "updating the to-do list"
    default: {
      const firstString = Object.values(input).find((value) => typeof value === "string")
      return typeof firstString === "string" ? firstLine(firstString) : ""
    }
  }
}

export const permissionSentence = (name: string, input: Record<string, unknown>, cwd: string) => {
  const subject = summarizeTool(name, input, cwd)
  switch (name) {
    case "Bash":
      return "Claude wants to run a shell command"
    case "Write":
      return `Claude wants to create ${subject}`
    case "Edit":
    case "NotebookEdit":
      return `Claude wants to edit ${subject}`
    case "Read":
      return `Claude wants to read ${subject}`
    case "WebFetch":
      return `Claude wants to fetch ${subject}`
    case "WebSearch":
      return `Claude wants to search the web for ${subject}`
    default:
      return name.startsWith("mcp__")
        ? `Claude wants to use ${name.split("__").slice(1).join(" / ")}`
        : `Claude wants to use ${name}`
  }
}

export const displayToolName = (name: string) => (name.startsWith("mcp__") ? name.split("__").slice(1).join(":") : name)
