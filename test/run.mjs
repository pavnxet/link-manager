/**
 * Test runner.
 *
 * Node's built-in runner does not expand globs on Node 20, and `--experimental-strip-types`
 * only exists on Node 22+, so this script collects the *.test.ts files itself and runs them
 * through `tsx` (which also honours the `@/` path alias from tsconfig.test.json).
 *
 * Usage: node test/run.mjs [extra node flags]
 */
import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOTS = ['app', 'lib', 'components']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'coverage', 'public', 'test'])

function collect(dir, out) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) collect(full, out)
    else if (/\.test\.tsx?$/.test(entry)) out.push(full)
  }
}

const files = []
for (const root of ROOTS) collect(root, files)

if (files.length === 0) {
  console.error('No test files found.')
  process.exit(1)
}

const result = spawnSync(
  process.execPath,
  [
    ...process.argv.slice(2),
    '--import',
    'tsx',
    '--test',
    ...files,
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      TSX_TSCONFIG_PATH: resolve('tsconfig.test.json'),
    },
  },
)

process.exit(result.status ?? 1)
