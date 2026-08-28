#!/usr/bin/env node
import { branchErrors, loadRules, titleErrors } from '../src/pull-request-rules.mjs'

async function pullRequestTitle() {
  if (process.env.PR_TITLE) return process.env.PR_TITLE

  const urls = process.env.CIRCLE_PULL_REQUEST || process.env.CIRCLE_PULL_REQUESTS || ''
  const number = urls.split(',')[0]?.split('/').pop()
  if (!number) return null

  const repository = `${process.env.CIRCLE_PROJECT_USERNAME}/${process.env.CIRCLE_PROJECT_REPONAME}`
  // A public repository answers an unauthenticated read, but shares a per-IP rate limit
  // with every other CircleCI job; a private one answers 404. A token settles both.
  const token = process.env.GITHUB_TOKEN
  const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${number}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    throw new Error('GitHub rejected the request: rate limit reached for this CircleCI IP. Rerun the job.')
  }
  if (response.status === 404) {
    throw new Error(`GitHub returned 404 for pull request ${number}. A private repository ` +
      'answers 404 rather than 403, so ' +
      (token
        ? 'GITHUB_TOKEN cannot read pull requests here; it needs pull_requests:read.'
        : 'this job needs a GITHUB_TOKEN with pull_requests:read.'))
  }
  if (!response.ok) throw new Error(`GitHub returned ${response.status} while reading pull request ${number}`)
  return (await response.json()).title
}

const rules = await loadRules()
const failures = []

const branch = process.env.CIRCLE_BRANCH
if (branch) {
  failures.push(...branchErrors(branch).map(error => `${branch}: ${error}`))
  if (!failures.length) console.log(`Branch name is valid: ${branch}`)
} else {
  console.log('No branch context detected; branch validation skipped.')
}

const title = await pullRequestTitle()
if (title) {
  failures.push(...titleErrors(title, rules).map(error => `${title}: ${error}`))
} else {
  console.log('No pull request context detected; title validation skipped.')
}

if (failures.length) {
  console.error(failures.map(failure => `- ${failure}`).join('\n'))
  process.exit(1)
}

if (title) console.log(`Pull request title is valid: ${title}`)
