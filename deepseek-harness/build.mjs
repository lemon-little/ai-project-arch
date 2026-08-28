#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = dirname(projectRoot)
const sourceRoot = resolve(process.env.DSH_SOURCE_ROOT ?? join(workspaceRoot, '..', 'deepseek-harness'))
const archifyRoot = resolve(process.env.ARCHIFY_ROOT ?? join(workspaceRoot, '..', 'archify'))
const archifyCli = join(archifyRoot, 'archify', 'bin', 'archify.mjs')
const manifest = JSON.parse(readFileSync(join(projectRoot, 'manifest.json'), 'utf8'))
const runVisualCheck = process.argv.includes('--visual-check')
const delivery = []
let failed = false

if (!existsSync(archifyCli)) throw new Error(`Archify CLI not found: ${archifyCli}`)

for (const diagram of manifest.diagrams) {
  const specPath = join(projectRoot, diagram.specification)
  const htmlPath = join(projectRoot, diagram.html)
  const args = [archifyCli, 'deliver', diagram.type, specPath, htmlPath, '--quality', 'showcase', '--json']
  if (diagram.type === 'architecture') args.push('--repo-root', sourceRoot)

  const receipt = JSON.parse(execFileSync(process.execPath, args, {
    cwd: archifyRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }))
  const receiptPath = htmlPath.replace(/\.html$/, '.delivery.json')
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  delivery.push({ id: diagram.id, type: diagram.type, html: diagram.html, receipt: receiptPath.slice(projectRoot.length + 1), ...receipt })
  console.log(`delivered ${diagram.id}: ${receipt.validation.checksPassed}/${receipt.validation.checkCount}`)

  if (runVisualCheck) {
    try {
      execFileSync(process.execPath, [archifyCli, 'visual-check', htmlPath, '--json'], {
        cwd: archifyRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
      })
      console.log(`visual-check ${diagram.id}: pass`)
    } catch (error) {
      failed = true
      console.error(`visual-check ${diagram.id}: fail`)
    }
  }
}

writeFileSync(join(projectRoot, 'delivery-summary.json'), `${JSON.stringify({
  generated_at: new Date().toISOString(),
  source_revision: manifest.source.revision,
  visual_check_run: runVisualCheck,
  diagrams: delivery,
}, null, 2)}\n`)

console.log(`Delivered ${delivery.length} diagrams${runVisualCheck ? ' with visual checks' : ''}.`)
if (failed) process.exitCode = 1
