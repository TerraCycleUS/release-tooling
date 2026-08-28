import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { escapeRegExp } from './escape-regexp.mjs'
import { JIRA_PROJECT } from './jira.mjs'
import CANONICAL_SECTIONS from './changelog-sections.json' with { type: 'json' }


const KEY = `${JIRA_PROJECT}-\\d+`
const SCOPE = '(?:\\([a-z0-9][a-z0-9._/-]*\\))?!?'
const KEYS = `(?:\\[${KEY}\\])+`
const ANY_KEY = new RegExp(KEY, 'i')

const BRANCH = new RegExp(`^${JIRA_PROJECT}-\\d+-[a-z0-9]+(?:[-_][a-z0-9]+)*$`)
const BRANCH_EXEMPT = [/^master$/, /^main$/, /^staging$/, /^production$/, /^v\d+\.\d+\.\d+$/,
  /^release\/v\d+\.\d+\.\d+$/, /^release-please--/, /^dependabot\//, /^revert-\d+-/]

// The tooling runs from the root of the repository it serves, so its config lives there.
const CONFIG_PATH = resolve(process.cwd(), 'release-please-config.json')
const PLACEHOLDERS = { scope: '(?:\\([^)]+\\))?', component: '(?: \\S+)?', version: '\\d+\\.\\d+\\.\\d+' }

// A repository that runs release-please states the types in its own config, and
// verify-release-rules holds that config to the canonical list. One that does not — the
// tooling repository itself — still gets the standard rather than no rules at all.
function allowedTypes(config) {
  const sections = config['changelog-sections'] ?? CANONICAL_SECTIONS
  const types = sections.map(section => section.type)
  assert.ok(types.length, `No changelog-sections in ${CONFIG_PATH}; the allowed commit types are read from there.`)
  return types
}

function exemptPattern(config) {
  const pattern = config['pull-request-title-pattern']
  if (!pattern) return /$^/

  const source = pattern
    .split(/\$\{(\w+)\}/)
    .map((part, index) => (index % 2 ? PLACEHOLDERS[part] : escapeRegExp(part)))
    .join('')
  return new RegExp(`^${source}$`)
}

export function rulesFrom(config) {
  const types = allowedTypes(config).join('|')

  return {
    title: new RegExp(`^(?:${types})${SCOPE}: ${KEYS} (?![A-Z][a-z])\\S.+$`),
    revert: new RegExp(`^revert${SCOPE}: ${KEYS} "[^"]+"$`),
    prefix: new RegExp(`^(?:${types})${SCOPE}: (?:${KEYS} )?`),
    exempt: exemptPattern(config),
  }
}

export function loadRules(configPath = CONFIG_PATH) {
  return readFile(configPath, 'utf8').then(JSON.parse, () => ({})).then(rulesFrom)
}

export function branchErrors(branch) {
  if (BRANCH_EXEMPT.some(rule => rule.test(branch)) || BRANCH.test(branch)) return []

  return [`Name the branch after its Jira issue: ${JIRA_PROJECT}-123-short-description. ` +
    'That name is what links the branch and its pull request to the issue.']
}

export function titleErrors(title, rules) {
  if (rules.exempt.test(title)) return []

  const errors = []
  if (!rules.title.test(title) && !rules.revert.test(title)) {
    errors.push(`Use type(scope): [${JIRA_PROJECT}-123] lowercase summary with an allowed Conventional Commit type.`)
  }
  const summary = title.replace(rules.prefix, '')
  // A revert quotes the original title, which carries its own key; only the rest counts.
  const outsidePrefix = rules.revert.test(title) ? summary.replace(/"[^"]*"/, '') : summary
  if (ANY_KEY.test(outsidePrefix)) {
    errors.push(`Put every Jira key in the prefix group: [${JIRA_PROJECT}-123][${JIRA_PROJECT}-999] summary. ` +
      'A key may not sit in the scope or inside the summary.')
  }
  return errors
}
