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

const detailLines = (toolName: string, input: Record<string, unknown>) => {
  if (toolName === "Bash") return [`$ ${stringField(input, "command") ?? ""}`, stringField(input, "description") ?? ""]
  if (toolName === "Edit")
    return [
      ...(stringField(input, "old_string") ?? "").split("\n").map((line) => `- ${line}`),
      ...(stringField(input, "new_string") ?? "").split("\n").map((line) => `+ ${line}`),
    ]
  if (toolName === "Write") return (stringField(input, "content") ?? "").split("\n").map((line) => `+ ${line}`)
  return JSON.stringify(input, null, 2).split("\n")
}

const DETAIL_WIDTH = 76
const MAX_DETAIL_LINES = 14

const wrapLines = (lines: string[]) =>
  lines
    .flatMap((text) => text.split("\n"))
    .flatMap((line) => {
      if (line.length <= DETAIL_WIDTH) return [line]
      const chunks: string[] = []
      for (let start = 0; start < line.length; start += DETAIL_WIDTH)
        chunks.push(line.slice(start, start + DETAIL_WIDTH))
      return chunks
    })

const lineColor = (line: string) =>
  line.startsWith("+ ") ? xp.diffAddInk : line.startsWith("- ") ? xp.diffDelInk : xp.ink

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
  const allDetails = wrapLines(detailLines(request.toolName, request.input).filter((line) => line !== ""))
  const hiddenCount = Math.max(0, allDetails.length - MAX_DETAIL_LINES)
  const details =
    hiddenCount > 0 ? [...allDetails.slice(0, MAX_DETAIL_LINES - 1), `... ${hiddenCount + 1} more lines`] : allDetails
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
          <text key={index} bg={xp.white} fg={lineColor(line)} wrapMode="none">
            {line}
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
