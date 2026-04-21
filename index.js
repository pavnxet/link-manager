/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('child_process')
const { existsSync } = require('fs')
const path = require('path')

const root = __dirname
const standaloneServer = path.join(root, '.next', 'standalone', 'server.js')

const command = process.execPath
const args = existsSync(standaloneServer)
  ? [standaloneServer]
  : [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start']

const child = spawn(command, args, {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

const signalExitCodes = {
  SIGINT: 130,
  SIGTERM: 143,
}

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(signalExitCodes[signal] ?? 1)
    return
  }
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('Failed to start application:', error)
  process.exit(1)
})
