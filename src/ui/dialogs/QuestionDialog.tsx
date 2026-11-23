import { useState } from "react"
import type { PendingRequest } from "../../agent/session.ts"
import { xp } from "../../theme.ts"
import { Sunken } from "../chrome.tsx"
import { Dialog, OptionList, useListKeys } from "./Dialog.tsx"

const OTHER = "Other (type your own answer)"

export function QuestionDialog({ request }: { request: Extract<PendingRequest, { kind: "question" }> }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [typing, setTyping] = useState(false)
  const question = request.questions[step]
  const options = [...(question?.options ?? []), { label: OTHER, description: "" }]

  const commit = (answer: string) => {
    if (!question) return
    const next = { ...answers, [question.question]: answer }
    setPicked(new Set())
    setTyping(false)
    if (step + 1 >= request.questions.length) {
      request.respond(next)
      return
    }
    setAnswers(next)
    setStep(step + 1)
  }

  const [selected] = useListKeys({
    count: options.length,
    onCancel: () => request.respond(null),
    onConfirm: (index) => {
      if (index === options.length - 1) return setTyping(true)
      if (!question?.multiSelect) return commit(options[index]?.label ?? "")
      const chosen = picked.size > 0 ? picked : new Set([index])
      commit(
        [...chosen]
          .sort((a, b) => a - b)
          .map((choice) => options[choice]?.label ?? "")
          .join(", "),
      )
    },
    onKey: (key, current) => {
      if (typing) {
        if (key.name === "escape") {
          key.preventDefault()
          setTyping(false)
        }
        return true
      }
      if (question?.multiSelect && key.name === "space" && current < options.length - 1) {
        key.preventDefault()
        const next = new Set(picked)
        if (next.has(current)) next.delete(current)
        else next.add(current)
        setPicked(next)
        return true
      }
      return false
    },
  })

  if (!question) return null
  const listOptions = options.map((option, index) => ({
    key: String(index + 1),
    label:
      question.multiSelect && index < options.length - 1
        ? `${picked.has(index) ? "[x]" : "[ ]"} ${option.label}`
        : option.label,
    hint: option.description || undefined,
  }))

  return (
    <Dialog
      title={`Claude asks - ${question.header || "Question"} (${step + 1}/${request.questions.length})`}
      width={84}
      height={options.length * 2 + 10}
      onClose={() => request.respond(null)}
    >
      <text fg={xp.ink} bg={xp.face}>
        <b>{question.question}</b>
      </text>
      {question.multiSelect ? (
        <text fg={xp.muted} bg={xp.face}>
          Space to tick, Enter to send
        </text>
      ) : null}
      <OptionList options={listOptions} selected={selected} width={78} />
      {typing ? (
        <Sunken height={3}>
          <input
            focused
            placeholder="Type your answer and press Enter"
            backgroundColor={xp.white}
            textColor={xp.ink}
            focusedBackgroundColor={xp.white}
            focusedTextColor={xp.ink}
            onSubmit={(value) => {
              if (typeof value === "string" && value.trim()) commit(value.trim())
            }}
          />
        </Sunken>
      ) : null}
    </Dialog>
  )
}
