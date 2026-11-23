export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const stringField = (value: unknown, key: string) => {
  if (!isRecord(value)) return undefined
  const field = value[key]
  return typeof field === "string" ? field : undefined
}
