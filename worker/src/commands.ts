export type ParsedCommand = {
  name: string
  args: string[]
  raw: string
}

export function parseCommand(text: string): ParsedCommand | null {
  const input = text.trim()
  if (!input.startsWith('/')) return null

  const [commandToken, ...parts] = input.split(/\s+/)
  const [name] = commandToken.slice(1).split('@')

  return {
    name: name.toLowerCase(),
    args: parts,
    raw: input,
  }
}

export function parseKeyValueArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {}

  for (const arg of args) {
    const separator = arg.indexOf('=')
    if (separator <= 0) continue
    const key = arg.slice(0, separator).trim().toLowerCase()
    const value = arg.slice(separator + 1).trim()
    if (key && value) parsed[key] = value
  }

  return parsed
}
