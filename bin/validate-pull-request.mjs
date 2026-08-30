#!/usr/bin/env node
import { json } from '../src/github.mjs'
import { branchErrors, loadRules, titleErrors } from '../src/pull-request-rules.mjs'

async function pullRequest() {
  const urls = process.env.CIRCLE_PULL_REQUEST || process.env.CIRCLE_PULL_REQUESTS || ''
  const number = urls.split(',')[0]?.split('/').pop()
  if (!number) return null

  return json(`/pulls/${number}`)
}

const rules = await loadRules()
const failures = []

const branch = process.env.CIRCLE_BRANCH
if (branch) {
  const errors = branchErrors(branch)
  if (!errors.length) console.log(`Branch name is valid: ${branch}`)
  failures.push(...errors.map(error => `${branch}: ${error}`))
} else {
  console.log('No branch context detected; branch validation skipped.')
}

const pull = await pullRequest()
if (pull) {
  failures.push(...titleErrors(pull.title, rules, pull.user?.login).map(error => `${pull.title}: ${error}`))
} else {
  console.log('No pull request context detected; title validation skipped.')
}

if (failures.length) {
  console.error(failures.map(failure => `- ${failure}`).join('\n'))
  process.exit(1)
}

if (pull) console.log(`Pull request title is valid: ${pull.title}`)
