const JIRA_PROJECT = process.env.JIRA_PROJECT || 'JIRA'
const JIRA_BROWSE_URL = process.env.JIRA_BROWSE_URL

if (!JIRA_BROWSE_URL) {
  throw new Error('Set JIRA_BROWSE_URL to the browse endpoint of your Jira, e.g. https://example.atlassian.net/browse')
}
const REFERENCE = new RegExp(`\\[(${JIRA_PROJECT}-\\d+)\\]`, 'g')
const LOOSE_KEY = new RegExp(`(?<![\\[/\\w])(${JIRA_PROJECT}-\\d+)(?![\\w-])`, 'g')
const TRAILING_DEFINITION = new RegExp(`\\n\\[${JIRA_PROJECT}-\\d+\\]: \\S+$`)

export function withReferences(body) {
  return body.replace(LOOSE_KEY, '[$1]')
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
