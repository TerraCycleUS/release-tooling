import assert from 'node:assert/strict'

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { branchErrors, loadRules, rulesFrom, titleErrors } from '../src/pull-request-rules.mjs'

// The rules read the config of the repository they serve; the fixture stands in for one.
const rules = await loadRules(join(dirname(fileURLToPath(import.meta.url)), 'fixture-release-please-config.json'))

const accept = title => assert.deepEqual(titleErrors(title, rules), [], `should accept: ${title}`)
const reject = title => assert.notEqual(titleErrors(title, rules).length, 0, `should reject: ${title}`)

accept('maintenance(deps): [ITG-123][ITG-999] update dependencies')
accept('feat(api): [ITG-123] add request retries')
accept('fix(api)!: [ITG-123] replace the response contract')
accept('revert: [ITG-123] "feat(api): add request retries"')
accept('revert(api): [ITG-123] "fix(cache): [ITG-999] preserve token expiry"')
accept('fix(api): [ITG-123] 404 responses are now 422')
accept('fix(api): [ITG-123] `identity_code` is validated again')
accept('chore(master): prepare 1.0.1')
accept('chore(master): prepare loop_client 2.10.0')
accept('chore(master): prepare coms 2.10.0')
reject('feat(ITG-123,ITG-999): add request retries')
reject('feat(itg-123): add request retries')
reject('maintenance(deps): [ITG-123] Update dependencies')
reject('change(api): [ITG-123] update the response')
reject('fix(api): correct the response (ITG-123, ITG-999)')
reject('fix(api): [ITG-123, ITG-999] correct the response')
reject('fix(api): [ITG-123] [ITG-999] correct the response')
reject('fix(api): (ITG-123) correct the response')
reject('fix(api): [ITG-123] correct the ITG-999 response')
reject('Revert "feat(api): add request retries"')
reject('feat(api): add request retries')
reject('chore(master): prepare')

for (const branch of ['ITG-123-add-request-retries', 'ITG-1-fix', 'master', 'staging', 'production',
  'v1.0.2', 'v10.20.30', 'release/v1.0.2', 'release/v10.20.30',
  'release-please--branches--master', 'release-please--branches--master--components--loop_client',
  'dependabot/bundler/rack-3.1.0', 'revert-8-maintenance/release-please-circleci']) {
  assert.deepEqual(branchErrors(branch), [], `should accept branch: ${branch}`)
}
for (const branch of ['maintenance/release-please-circleci', 'itg-123-add-retries', 'ITG123-add-retries',
  'ITG-123', 'ITG-123-Add-Retries', 'add-retries', 'feature/ITG-123-add-retries', 'release/nope']) {
  assert.notEqual(branchErrors(branch).length, 0, `should reject branch: ${branch}`)
}

// A repository with no release-please config still gets the canonical type list, which is
// what lets this package check its own pull requests.
const canonicalRules = rulesFrom({})
assert.deepEqual(titleErrors('maintenance(deps): [ITG-123] update dependencies', canonicalRules), [])
assert.notEqual(titleErrors('nonsense(deps): [ITG-123] update dependencies', canonicalRules).length, 0)

console.log('Pull request rules verified.')
