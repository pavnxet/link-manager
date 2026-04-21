import { describe, it } from 'node:test'
import assert from 'node:assert'
import { parseCommand, parseKeyValueArgs } from '../src/commands.ts'

describe('parseCommand', () => {
  it('parses a basic command', () => {
    const command = parseCommand('/login admin secret')
    assert.ok(command)
    assert.strictEqual(command?.name, 'login')
    assert.deepStrictEqual(command?.args, ['admin', 'secret'])
  })

  it('returns null for plain text', () => {
    assert.strictEqual(parseCommand('hello'), null)
  })
})

describe('parseKeyValueArgs', () => {
  it('parses key value arguments', () => {
    const parsed = parseKeyValueArgs(['title=42', 'category=#Code'])
    assert.strictEqual(parsed.title, '42')
    assert.strictEqual(parsed.category, '#Code')
  })
})
