#!/usr/bin/env node
import { json, optionalJson, releasePullRequest, requireToken } from '../src/github.mjs'
import { addedLines, withJiraLinks } from '../src/jira-links.mjs'

const CHANGELOG = 'CHANGELOG.md'
const MESSAGE = 'chore(master): link jira keys in the changelog'

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
// run. The Jira app is what would link it, and it appends definitions for the keys it reads
// from the top until it stops part way — 4 of the 16 on loop-tds#668 — so the description
// needs its own pass here, after each rewrite. Keys the app did reach keep its links:
// withJiraLinks only defines what is missing.
async function linkDescription(pull) {
  const current = pull.body ?? ''
  const linked = withJiraLinks(current)
  if (linked === current) {
    console.log(`#${pull.number}: every Jira key in the description already resolves.`)
    return
  }

  if (dryRun) {
    console.log(`#${pull.number} would rewrite its description:\n${addedLines(current, linked).join('\n')}`)
    return
  }

  await json(`/pulls/${pull.number}`, { method: 'PATCH', body: JSON.stringify({ body: linked }) })
  console.log(`#${pull.number}: linked every Jira key in the description.`)
}

const pull = await openReleasePullRequest()
if (!pull) {
  console.log('No open release pull request; nothing to link.')
  process.exit(0)
}

await linkChangelogFile(pull)
await linkDescription(pull)
