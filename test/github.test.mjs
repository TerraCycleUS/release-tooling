import assert from 'node:assert/strict'

import { releasePullRequest } from '../src/github.mjs'

const release = { number: 42, head: { ref: 'release-please--branches--master--components--loop_client' } }

assert.equal(releasePullRequest([]), null)
assert.equal(releasePullRequest([{ head: { ref: 'ITG-409-link-jira-keys' } }]), null)
assert.equal(releasePullRequest([{ head: {} }, { head: { ref: 'ITG-1-x' } }, release]), release)

console.log('GitHub helpers verified.')
