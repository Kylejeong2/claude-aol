import type { PermissionUpdate, PermissionUpdateDestination } from "@anthropic-ai/claude-agent-sdk"
import type { PendingRequest, PermissionChoice } from "../../agent/session.ts"
import { stringField } from "../../agent/guards.ts"
import { permissionSentence } from "../../agent/tools.ts"
import { xp } from "../../theme.ts"
import { Sunken } from "../chrome.tsx"
import { Dialog, OptionList, useListKeys, type ListOption } from "./Dialog.tsx"

const destinationLabel: Record<PermissionUpdateDestination, string> = {
  session: "for this session",
  localSettings: "in this project (local)",
  projectSettings: "in this project",
  userSettings: "everywhere",
  cliArg: "for this run",
}

const describeUpdate = (update: PermissionUpdate) => {
  const where = destinationLabel[update.destination]
  if (update.type === "addRules" || update.type === "replaceRules") {
    const rules = update.rules.map((rule) =>
      rule.ruleContent ? `${rule.toolName}(${rule.ruleContent})` : rule.toolName,
    )
    return `${rules.join(", ")} ${where}`
  }
  if (update.type === "setMode") return `switch to ${update.mode} mode ${where}`
  if (update.type === "addDirectories") return `allow ${update.directories.join(", ")} ${where}`
  return `${update.type} ${where}`
}

type DetailLine = { text: string; color: string }

const DETAIL_WIDTH = 76
const MAX_DETAIL_LINES = 14

const bodyLines = (text: string) => (text ? text.replace(/\n$/, "").split("\n") : [])

const prefixed = (text: string, prefix: string, color: string): DetailLine[] =>
  bodyLines(text).map((line) => ({ text: `${prefix}${line}`, color }))

const detailLines = (toolName: string, input: Record<string, unknown>): DetailLine[] => {
  if (toolName === "Bash")
    return [
      ...prefixed(stringField(input, "command") ?? "", "$ ", xp.ink),
      ...prefixed(stringField(input, "description") ?? "", "# ", xp.muted),
    ]
  if (toolName === "Edit")
    return [
      ...prefixed(stringField(input, "old_string") ?? "", "- ", xp.diffDelInk),
      ...prefixed(stringField(input, "new_string") ?? "", "+ ", xp.diffAddInk),
    ]
  if (toolName === "Write") return prefixed(stringField(input, "content") ?? "", "+ ", xp.diffAddInk)
  return prefixed(JSON.stringify(input, null, 2), "", xp.ink)
}

const wrapLines = (lines: DetailLine[]): DetailLine[] =>
  lines.flatMap(({ text, color }) => {
    const chunks: DetailLine[] = [{ text: text.slice(0, DETAIL_WIDTH), color }]
    for (let start = DETAIL_WIDTH; start < text.length; start += DETAIL_WIDTH - 2)
      chunks.push({ text: `  ${text.slice(start, start + DETAIL_WIDTH - 2)}`, color })
    return chunks
  })

export function PermissionDialog({
  request,
  cwd,
}: {
  request: Extract<PendingRequest, { kind: "permission" }>
  cwd: string
}) {
  const choices: { choice: PermissionChoice; option: ListOption }[] = [
    { choice: "once", option: { key: "1", label: "Yes" } },
    ...(request.suggestions.length > 0
      ? [
          {
            choice: "always" as const,
            option: {
              key: "2",
              label: "Yes, and don't ask again",
              hint: request.suggestions.map(describeUpdate).join("; "),
            },
          },
        ]
      : []),
    {
      choice: "deny",
      option: {
        key: String(request.suggestions.length > 0 ? 3 : 2),
        label: "No, and tell Claude what to do differently (esc)",
      },
    },
  ]
  const [selected] = useListKeys({
    count: choices.length,
    onConfirm: (index) => request.respond(choices[index]?.choice ?? "deny"),
    onCancel: () => request.respond("deny"),
    onKey: (key) => {
      if (key.name === "y") {
        request.respond("once")
        return true
      }
      if (key.name === "n") {
        request.respond("deny")
        return true
      }
      return false
    },
  })
  const allDetails = wrapLines(detailLines(request.toolName, request.input))
  const hiddenCount = Math.max(0, allDetails.length - MAX_DETAIL_LINES)
  const details =
    hiddenCount > 0
      ? [...allDetails.slice(0, MAX_DETAIL_LINES - 1), { text: `... ${hiddenCount + 1} more lines`, color: xp.muted }]
      : allDetails
  return (
    <Dialog
      title="Claude Code - Security Warning"
      width={84}
      height={details.length + choices.length + choices.filter((item) => item.option.hint).length + 13}
      onClose={() => request.respond("deny")}
    >
      <box flexDirection="row" gap={2}>
        <text fg={xp.ink} bg={xp.aimYellow}>
          <b>{" /!\\ "}</b>
        </text>
        <box flexDirection="column" flexShrink={1}>
          <text fg={xp.ink} bg={xp.face}>
            <b>{permissionSentence(request.toolName, request.input, cwd)}</b>
          </text>
          {request.reason ? (
            <text fg={xp.muted} bg={xp.face}>
              {request.reason}
            </text>
          ) : null}
        </box>
      </box>
      <Sunken>
        {details.map((line, index) => (
          <text key={index} bg={xp.white} fg={line.color} wrapMode="none">
            {line.text}
          </text>
        ))}
      </Sunken>
      <text fg={xp.ink} bg={xp.face}>
        Do you want to proceed?
      </text>
      <OptionList options={choices.map((choice) => choice.option)} selected={selected} width={78} />
    </Dialog>
  )
}
