import assert from 'node:assert/strict'

import { releasePullRequest } from '../src/github.mjs'

const here = { repo: { full_name: 'TerraCycleUS/loop-client' } }
const fork = { repo: { full_name: 'someone/loop-client' } }
const base = { base: here }

const release = { number: 42, head: { ...here, ref: 'release-please--branches--master--components--loop_client' }, ...base }

assert.equal(releasePullRequest([]), null)
assert.equal(releasePullRequest([{ head: { ...here, ref: 'ITG-409-link-jira-keys' }, ...base }]), null)
assert.equal(releasePullRequest([{ head: {} }, { head: { ...here, ref: 'ITG-1-x' }, ...base }, release]), release)

// A fork may name its branch anything, this prefix included. Its branch does not exist
// here, so taking it would skip the real release pull request and write nowhere.
const impostor = { number: 7, head: { ...fork, ref: 'release-please--branches--master' }, ...base }
assert.equal(releasePullRequest([impostor]), null)
assert.equal(releasePullRequest([impostor, release]), release)

// A payload missing the head repository is not a match either — a deleted fork reads that
// way, and guessing it belongs here would send the write to the wrong branch.
assert.equal(releasePullRequest([{ head: { ref: 'release-please--branches--master' }, ...base }]), null)

console.log('GitHub helpers verified.')
