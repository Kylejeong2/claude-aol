import type { SessionPhase } from "../agent/session.ts"
import { xp } from "../theme.ts"
import { fit, Sunken, XpWindow } from "./chrome.tsx"

const steps = ["Connecting...", "Verifying screen name...", "Starting services..."]

export function SignOn({
  top,
  left,
  screenName,
  phase,
  account,
  tick,
}: {
  top: number
  left: number
  screenName: string
  phase: SessionPhase
  account: string | null
  tick: number
}) {
  const width = 36
  const step = phase === "connecting" ? steps[tick % steps.length] : "Signed on!"
  return (
    <XpWindow title="Sign On" top={top} left={left} width={width} height={22} zIndex={50}>
      <box backgroundColor={xp.buddyBlue} flexDirection="column" alignItems="center" height={8}>
        <text fg={xp.aimYellow} bg={xp.buddyBlue}>
          <b>{"\n     \\  |  /\n   --   *   --\n     /  |  \\"}</b>
        </text>
        <text fg={xp.white} bg={xp.buddyBlue}>
          <b>Claude Instant Messenger</b>
        </text>
      </box>
      <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1} backgroundColor={xp.face}>
        <text fg={xp.buddyBlue} bg={xp.face}>
          <b>
            <i>ScreenName</i>
          </b>
        </text>
        <Sunken height={3}>
          <text bg={xp.white} fg={xp.ink}>
            {fit(screenName, width - 8)}
          </text>
        </Sunken>
        <text fg={xp.ink} bg={xp.face}>
          <b>Password</b>
        </text>
        <Sunken height={3}>
          <text bg={xp.white} fg={xp.muted}>
            {fit(account ? `Saved - ${account}` : "Saved - Claude Code login", width - 8)}
          </text>
        </Sunken>
        <text fg={xp.ink} bg={xp.face}>
          [x] Save password [x] Auto-login
        </text>
        <text fg={xp.ok} bg={xp.face}>
          <b>{fit(`  ${step}`, width - 4)}</b>
        </text>
      </box>
    </XpWindow>
  )
}
