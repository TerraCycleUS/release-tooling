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

// The fixture's type list is deliberately not the canonical one: `spike` exists only
// there, and `perf` only in the canonical list. Together they prove the rules read the
// served repository's config.
accept('spike(api): [ITG-123] try the other encoding')
reject('perf(api): [ITG-123] cache the response')

// A repository with no release-please config still gets the canonical type list, which is
// what lets this package check its own pull requests.
const canonicalRules = rulesFrom({})
assert.deepEqual(titleErrors('maintenance(deps): [ITG-123] update dependencies', canonicalRules), [])
assert.deepEqual(titleErrors('perf(api): [ITG-123] cache the response', canonicalRules), [])
assert.notEqual(titleErrors('spike(api): [ITG-123] try it', canonicalRules).length, 0)

// An unknown type is one mistake, not two: the key after it is placed correctly, so only
// the type is reported. A key that really is outside the prefix still gets its own error.
assert.equal(titleErrors('change(api): [ITG-123] update the response', rules).length, 1)
assert.equal(titleErrors('fix(api): [ITG-123] correct the ITG-999 response', rules).length, 1)
// A key in the scope is both an unusable type and a misplaced key, so it reports both.
assert.equal(titleErrors('feat(ITG-123): [ITG-1] add retries', rules).length, 2)

// A machine account cannot know a Jira issue, and its branches are already exempt. Its
// titles still have to carry an allowed type, and a human with the same title does not
// get the same pass.
const BOT = 'dependabot[bot]'
assert.deepEqual(titleErrors('maintenance(deps): bump the gems group', rules, BOT), [])
assert.deepEqual(titleErrors('build(deps): bump release-tooling from 1.3.0 to 1.4.0', canonicalRules, BOT), [])
assert.notEqual(titleErrors('bump the gems group', rules, BOT).length, 0)
assert.notEqual(titleErrors('change(deps): bump the gems group', rules, BOT).length, 0)
// The same title from a person still needs its key.
assert.notEqual(titleErrors('maintenance(deps): bump the gems group', rules, 'a-person').length, 0)
assert.notEqual(titleErrors('maintenance(deps): bump the gems group', rules).length, 0)
// A key it did somehow carry is still fine — the exemption drops the requirement, not the type.
assert.deepEqual(titleErrors('maintenance(deps): [ITG-123] bump the gems group', rules, BOT), [])

// Release Please writes the version its own way: a `v` prefix and a prerelease suffix are
// both titles it opens, and rejecting one would block the release pull request.
for (const version of ['1.0.1', 'v1.0.1', '1.0.1-rc.1', '1.0.1-master.6', '1.0.1+build.2']) {
  accept(`chore(master): prepare ${version}`)
}

// An unsupported placeholder used to vanish into the empty string, leaving a pattern that
// matched no title at all; it has to fail where it is written instead.
assert.throws(() => rulesFrom({ 'pull-request-title-pattern': 'chore${nope}: prepare ${version}' }),
  /Unsupported \$\{nope\}/)
assert.ok(rulesFrom({ 'pull-request-title-pattern': 'chore(${branch}): prepare ${version}' })
  .exempt.test('chore(master): prepare 1.0.1'))

console.log('Pull request rules verified.')
