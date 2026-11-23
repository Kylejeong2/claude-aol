#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { userInfo } from "node:os"
import type { AgentSession } from "./agent/session.ts"
import { App } from "./app.tsx"
import { log, logPath } from "./log.ts"
import { createLightSyntax, SyntaxContext } from "./ui/syntax.ts"

const cwd = process.cwd()
const modelFlag = process.argv.indexOf("--model")
const model = modelFlag === -1 ? undefined : process.argv[modelFlag + 1]
const screenName = process.env.AIM_SCREEN_NAME ?? userInfo().username

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  useMouse: true,
  targetFps: 30,
  openConsoleOnError: false,
})

let activeSession: AgentSession | undefined
let exiting = false

const exit = (code: number) => {
  if (exiting) return
  exiting = true
  activeSession?.close()
  renderer.destroy()
  process.exit(code)
}

process.on("uncaughtException", (error) => {
  log("uncaughtException", { message: error.message, stack: error.stack })
  exit(1)
})
process.on("unhandledRejection", (reason) => log("unhandledRejection", String(reason)))
process.on("SIGTERM", () => exit(0))
process.on("SIGHUP", () => exit(0))

log("start", { cwd, logPath })

createRoot(renderer).render(
  <SyntaxContext.Provider value={createLightSyntax(renderer)}>
    <App
      cwd={cwd}
      model={model}
      screenName={screenName}
      onSession={(session) => {
        activeSession = session
      }}
      onExit={() => exit(0)}
    />
  </SyntaxContext.Provider>,
)
