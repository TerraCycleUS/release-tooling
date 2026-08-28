#!/usr/bin/env node
import { json, optionalJson, request, requireToken } from '../src/github.mjs'

requireToken()

const dryRun = process.argv.includes('--dry-run')

const release = await optionalJson('/releases/latest')
if (!release) {
  console.log('No published release yet; no branch to create.')
  process.exit(0)
}

const tag = release.tag_name
// Heroku picks a release from the branch list, so every repository cuts release/<tag>.
const branch = `release/${tag}`
const { sha } = await json(`/commits/${tag}`)

if (dryRun) {
  console.log(`${branch}: would branch from ${sha.slice(0, 8)}.`)
  process.exit(0)
}

const created = await request('/git/refs', {
  method: 'POST',
  body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
})
// 422 is how GitHub reports a ref that is already there — a rerun, or a concurrent job —
// but it is also what it returns for a sha it cannot resolve or a name it rejects, so the
// reason decides between "nothing to do" and a release that never got its branch.
if (created.status === 422) {
  const { message } = await created.json().catch(() => ({}))
  if (message === 'Reference already exists') {
    console.log(`${branch}: branch already exists.`)
    process.exit(0)
  }
  throw new Error(`GitHub rejected branch ${branch} at ${sha}: ${message ?? 'no reason given'}`)
}
if (!created.ok) {
  throw new Error(`GitHub returned ${created.status} while creating branch ${branch}`)
}

console.log(`${branch}: branch created at ${sha.slice(0, 8)}.`)
