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

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('Failed to start application:', error)
  process.exit(1)
})
