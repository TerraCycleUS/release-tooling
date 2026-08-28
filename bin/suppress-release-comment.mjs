#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

// Resolving the package keeps this working wherever npm places release-please.
const manifestPath = createRequire(import.meta.url).resolve('release-please/build/src/manifest.js')
const originalCall = '            await this.github.commentOnIssue(comment, pullRequest.number);'
const replacement =
  "            this.logger.info('Release pull request comment suppressed by repository policy.');"
const source = await readFile(manifestPath, 'utf8')
const occurrences = source.split(originalCall).length - 1

if (source.includes(replacement)) {
  assert.equal(occurrences, 0)
} else {
  assert.equal(occurrences, 1, 'Pinned Release Please comment hook changed; review the integration patch.')
  await writeFile(manifestPath, source.replace(originalCall, replacement))
}

const patchedSource = await readFile(manifestPath, 'utf8')
assert.doesNotMatch(patchedSource, /await this\.github\.commentOnIssue\(comment, pullRequest\.number\)/)
console.log('Release Please repository policy patch applied.')
