import type { PendingRequest, PlanChoice } from "../../agent/session.ts"
import { xp } from "../../theme.ts"
import { useSyntax } from "../syntax.ts"
import { Sunken } from "../chrome.tsx"
import { Dialog, OptionList, useListKeys } from "./Dialog.tsx"

const choices: { choice: PlanChoice; label: string }[] = [
  { choice: "acceptEdits", label: "Yes, and auto-accept edits" },
  { choice: "default", label: "Yes, and manually approve edits" },
  { choice: "keep", label: "No, keep planning (esc)" },
]

export function PlanDialog({
  request,
  height,
}: {
  request: Extract<PendingRequest, { kind: "plan" }>
  height: number
}) {
  const syntaxStyle = useSyntax()
  const [selected] = useListKeys({
    count: choices.length,
    onConfirm: (index) => request.respond(choices[index]?.choice ?? "keep"),
    onCancel: () => request.respond("keep"),
  })
  return (
    <Dialog
      title="Claude's Plan - Ready to code?"
      width={100}
      height={Math.max(20, height - 4)}
      onClose={() => request.respond("keep")}
    >
      <Sunken flexGrow={1}>
        <scrollbox
          flexGrow={1}
          style={{
            rootOptions: { backgroundColor: xp.white },
            contentOptions: { backgroundColor: xp.white, paddingLeft: 1, paddingRight: 1 },
          }}
        >
          <markdown content={request.plan} syntaxStyle={syntaxStyle} fg={xp.ink} bg={xp.white} conceal />
        </scrollbox>
      </Sunken>
      <OptionList
        options={choices.map((item, index) => ({ key: String(index + 1), label: item.label }))}
        selected={selected}
        width={94}
      />
    </Dialog>
  )
}
