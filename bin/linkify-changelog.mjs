#!/usr/bin/env node
import { setTimeout as sleep } from 'node:timers/promises'
import { json, optionalJson, releasePullRequest, requireToken } from '../src/github.mjs'
import { addedLines, withJiraLinks } from '../src/jira-links.mjs'

const CHANGELOG = 'CHANGELOG.md'
const MESSAGE = 'chore(master): link jira keys in the changelog'
const DESCRIPTION_WRITES = 3
const SETTLE_MS = 8000

requireToken()

const dryRun = process.argv.includes('--dry-run')

// One page holds 100 pull requests; dependabot alone can push the release one off it.
async function openReleasePullRequest() {
  for (let page = 1; page <= 10; page += 1) {
    const pulls = await json(`/pulls?state=open&per_page=100&page=${page}`)
    const pull = releasePullRequest(pulls)
    if (pull) return pull
    if (pulls.length < 100) return null
  }
  return null
}

async function linkChangelogFile(pull) {
  const branch = pull.head.ref
  const file = await optionalJson(`/contents/${CHANGELOG}?ref=${encodeURIComponent(branch)}`)
  if (!file) {
    console.log(`#${pull.number}: ${CHANGELOG} is missing on ${branch}; nothing to link.`)
    return
  }

  const current = Buffer.from(file.content, 'base64').toString('utf8')
  const linked = withJiraLinks(current)
  if (linked === current) {
    console.log(`#${pull.number}: every Jira key in ${CHANGELOG} already resolves.`)
    return
  }

  if (dryRun) {
    console.log(`#${pull.number} would rewrite ${CHANGELOG}:\n${addedLines(current, linked).join('\n')}`)
    return
  }

  await json(`/contents/${CHANGELOG}`, {
    method: 'PUT',
    body: JSON.stringify({
      branch,
      message: MESSAGE,
      sha: file.sha,
      content: Buffer.from(linked, 'utf8').toString('base64'),
    }),
  })
  console.log(`#${pull.number}: linked every Jira key in ${CHANGELOG}.`)
}

// The description repeats the same changelog, and Release Please rewrites it whole on every
// run. The Jira app that would link it appends definitions for the keys it reads from the
// top and stops part way — 4 of the 16 on loop-tds#668 — so the description needs its own
// pass here. It does not append to what it finds either: it writes back the whole body it
// had already computed, which on that same pull request dropped this one a second after it
// landed. So write, let its pass settle, and look again; once every key resolves its
// rewrite carries the same links and there is nothing left to restore.
async function linkDescription(number) {
  for (let written = 0; written <= DESCRIPTION_WRITES; written += 1) {
    const { body } = await json(`/pulls/${number}`)
    const current = body ?? ''
    const linked = withJiraLinks(current)

    if (linked === current) {
      console.log(`#${number}: every Jira key in the description resolves.`)
      return
    }

    if (dryRun) {
      console.log(`#${number} would rewrite its description:\n${addedLines(current, linked).join('\n')}`)
      return
    }

    if (written === DESCRIPTION_WRITES) break

    await json(`/pulls/${number}`, { method: 'PATCH', body: JSON.stringify({ body: linked }) })
    console.log(`#${number}: linked every Jira key in the description.`)
    await sleep(SETTLE_MS)
  }

  console.log(`#${number}: something rewrote the description under all ${DESCRIPTION_WRITES} passes; the next release run tries again.`)
}

const pull = await openReleasePullRequest()
if (!pull) {
  console.log('No open release pull request; nothing to link.')
  process.exit(0)
}

await linkChangelogFile(pull)
await linkDescription(pull.number)
