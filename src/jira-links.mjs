import { JIRA_PROJECT } from './jira.mjs'

const JIRA_BROWSE_URL = process.env.JIRA_BROWSE_URL

if (!JIRA_BROWSE_URL) {
  throw new Error('Set JIRA_BROWSE_URL to the browse endpoint of your Jira, e.g. https://example.atlassian.net/browse')
}
const REFERENCE = new RegExp(`\\[(${JIRA_PROJECT}-\\d+)\\]`, 'g')
const LOOSE_KEY = new RegExp(`(?<![\\[/\\w])(${JIRA_PROJECT}-\\d+)(?![\\w-])`, 'g')
const TRAILING_DEFINITION = new RegExp(`\\n\\[${JIRA_PROJECT}-\\d+\\]: \\S+$`)
// A changelog entry can quote code, and a key inside it is part of the sample rather than
// a reference to link. split() keeps the delimiters, so the odd parts are the code.
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/g

export function withReferences(body) {
  return body
    .split(CODE)
    .map((part, index) => (index % 2 ? part : part.replace(LOOSE_KEY, '[$1]')))
    .join('')
}

export function withDefinitions(body) {
  const keys = [...new Set([...body.matchAll(REFERENCE)].map(match => match[1]))]
  const missing = keys.filter(key => !new RegExp(`^\\[${key}\\]: `, 'm').test(body))
  if (!missing.length) return body

  const trimmed = body.replace(/\s+$/, '')
  const definitions = missing.map(key => `[${key}]: ${JIRA_BROWSE_URL}/${key}`).join('\n')
  return `${trimmed}${TRAILING_DEFINITION.test(trimmed) ? '\n' : '\n\n'}${definitions}\n`
}

export function withJiraLinks(body) {
  return withDefinitions(withReferences(body))
}

export function addedLines(before, after) {
  const existing = new Set(before.split('\n'))
  return after.split('\n').filter(line => line && !existing.has(line))
}
