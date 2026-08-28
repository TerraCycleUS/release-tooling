import assert from 'node:assert/strict'

// Every module that matches or links keys needs this, and defaulting it silently is worse
// than failing: the rules then demand JIRA-123 branch names and reject every correct one,
// and the linkers match nothing and report success.
export const JIRA_PROJECT = process.env.JIRA_PROJECT
assert.ok(JIRA_PROJECT, 'Set JIRA_PROJECT to the Jira project key, e.g. ITG.')
