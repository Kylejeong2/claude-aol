import { appendFileSync, mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const logDir = join(homedir(), ".aim-code")
export const logPath = join(logDir, "aim-code.log")
mkdirSync(logDir, { recursive: true })
writeFileSync(logPath, "")

export const log = (event: string, detail?: unknown) => {
  const line = JSON.stringify({ at: new Date().toISOString(), event, detail })
  appendFileSync(logPath, `${line}\n`)
}
