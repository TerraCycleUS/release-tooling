#!/usr/bin/env node
import { json } from '../src/github.mjs'
import { branchErrors, loadRules, titleErrors } from '../src/pull-request-rules.mjs'

async function pullRequestTitle() {
  const urls = process.env.CIRCLE_PULL_REQUEST || process.env.CIRCLE_PULL_REQUESTS || ''
  const number = urls.split(',')[0]?.split('/').pop()
  if (!number) return null

  return (await json(`/pulls/${number}`)).title
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
