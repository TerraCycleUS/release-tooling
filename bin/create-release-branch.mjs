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

const existing = await request(`/git/ref/heads/${branch}`)
if (existing.ok) {
  console.log(`${branch}: branch already exists.`)
  process.exit(0)
}

if (dryRun) {
  console.log(`${branch}: would branch from ${sha.slice(0, 8)}.`)
  process.exit(0)
}

const created = await request('/git/refs', {
  method: 'POST',
  body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
})
if (created.status === 422) {
  console.log(`${branch}: another run created the branch first.`)
  process.exit(0)
}
if (!created.ok) {
  throw new Error(`GitHub returned ${created.status} while creating branch ${branch}`)
}

console.log(`${branch}: branch created at ${sha.slice(0, 8)}.`)
