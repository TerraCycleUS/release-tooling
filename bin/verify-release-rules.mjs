#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { escapeRegExp } from '../src/escape-regexp.mjs'
import { owner, repo } from '../src/github.mjs'
import CANONICAL_SECTIONS from '../src/changelog-sections.json' with { type: 'json' }

import { DefaultChangelogNotes } from 'release-please/build/src/changelog-notes/default.js'
import { parseConventionalCommits } from 'release-please/build/src/commit.js'
import { buildStrategy } from 'release-please/build/src/factory.js'
import { GemfileLock } from 'release-please/build/src/updaters/ruby/gemfile-lock.js'
import { VersionRB } from 'release-please/build/src/updaters/ruby/version-rb.js'
import { PullRequestTitle } from 'release-please/build/src/util/pull-request-title.js'
import { Version } from 'release-please/build/src/version.js'
import { DefaultVersioningStrategy } from 'release-please/build/src/versioning-strategies/default.js'

const TARGET_BRANCH = 'master'

const config = JSON.parse(await readFile('release-please-config.json', 'utf8'))
const manifestVersions = JSON.parse(await readFile('.release-please-manifest.json', 'utf8'))
const packageConfig = config.packages['.']
const versionSource = await readFile(packageConfig['version-file'], 'utf8')
const gemfileLock = await readFile('Gemfile.lock', 'utf8')
// Only a packaged gem lists itself in its own lockfile; an application does not.
const packagedGem = new RegExp(`^\\s+${packageConfig['package-name']} \\(`, 'm').test(gemfileLock)
const currentVersion = Version.parse(manifestVersions['.'])
const expectedPatchVersion = new Version(
  currentVersion.major,
  currentVersion.minor,
  currentVersion.patch + 1,
)
const expectedMinorVersion = new Version(currentVersion.major, currentVersion.minor + 1, 0)
const expectedMajorVersion = new Version(currentVersion.major + 1, 0, 0)
const versioning = new DefaultVersioningStrategy()
const changelog = new DefaultChangelogNotes()

// The commit types are the standard, not a per-repository choice: the title check reads
// them from this config, so a repository that quietly drops one accepts a different set
// of titles than the organisation guide promises.
assert.deepEqual(config['changelog-sections'], CANONICAL_SECTIONS,
  'changelog-sections must match src/changelog-sections.json in @terracycleus/release-tooling.')

// This is the one command that reads owner and repo without ever calling request(), so
// the guard there never fires for it: unset, the strategy would be built for `/undefined`.
assert.ok(owner && repo,
  'Set RELEASE_REPOSITORY as owner/repo; CIRCLE_PROJECT_USERNAME and CIRCLE_PROJECT_REPONAME are not both set.')

const strategy = await buildStrategy({
  github: { repository: { owner, repo } },
  releaseType: packageConfig['release-type'],
  targetBranch: TARGET_BRANCH,
  packageName: packageConfig['package-name'],
  includeComponentInTag: config['include-component-in-tag'],
  versionFile: packageConfig['version-file'],
})
const updates = await strategy.buildUpdates({
  changelogEntry: '',
  newVersion: expectedPatchVersion,
  versionsMap: new Map(),
  latestVersion: currentVersion,
  commits: [],
})

const component = await strategy.getComponent()
assert.equal(component, '')
assert.deepEqual(updates.map(update => update.path), [
  'CHANGELOG.md',
  packageConfig['version-file'],
  'Gemfile.lock',
])
assert.match(versionSource, new RegExp(`VERSION = ['\"]${currentVersion.toString()}['\"]`))
if (packagedGem) {
  assert.match(gemfileLock, new RegExp(`${packageConfig['package-name']} \\(${currentVersion.toString()}\\)`))
}

const releaseTitle = PullRequestTitle.ofComponentTargetBranchVersion(
  component,
  TARGET_BRANCH,
  expectedPatchVersion,
  config['pull-request-title-pattern'],
).toString()
assert.equal(releaseTitle, `chore(${TARGET_BRANCH}): prepare ${expectedPatchVersion.toString()}`)

let fixtureIndex = 0

function commit(message) {
  fixtureIndex += 1
  const commits = parseConventionalCommits([
    {
      message,
      sha: fixtureIndex.toString().padStart(40, '0'),
    },
  ])

  assert.equal(commits.length, 1, `Expected one parsed commit for: ${message}`)
  return commits[0]
}

async function notesFor(commits, version) {
  return changelog.buildNotes(commits, {
    changelogSections: config['changelog-sections'],
    currentTag: `v${version}`,
    host: 'https://github.com',
    owner,
    repository: repo,
    targetBranch: TARGET_BRANCH,
    version,
  })
}

const maintenance = commit('maintenance(deps): (ITG-123, ITG-999) update dependencies')
const maintenanceVersion = versioning.bump(currentVersion, [maintenance])
const maintenanceNotes = await notesFor([maintenance], maintenanceVersion.toString())

assert.equal(maintenance.type, 'maintenance')
assert.equal(maintenance.scope, 'deps')
assert.equal(maintenanceVersion.toString(), expectedPatchVersion.toString())
assert.match(maintenanceNotes, /Maintenance/)
assert.match(maintenanceNotes, /ITG-123, ITG-999/)

const feature = commit('feat(api): (ITG-123) add request retries')
assert.equal(versioning.bump(currentVersion, [feature]).toString(), expectedMinorVersion.toString())

const fix = commit('fix(api): (ITG-123) preserve response metadata')
assert.equal(versioning.bump(currentVersion, [fix]).toString(), expectedPatchVersion.toString())

const breaking = commit('fix(api)!: (ITG-123) replace the response contract')
assert.equal(breaking.breaking, true)
assert.equal(versioning.bump(currentVersion, [breaking]).toString(), expectedMajorVersion.toString())

for (const { type, section } of config['changelog-sections']) {
  const typed = commit(`${type}(api): [ITG-123] do the thing`)
  const notes = await notesFor([typed], expectedPatchVersion.toString())

  assert.match(notes, new RegExp(`### ${escapeRegExp(section)}`), `${type} must appear as ${section}`)
  assert.notEqual(versioning.bump(currentVersion, [typed]).toString(), currentVersion.toString(), `${type} must release`)
}

const updatedVersionSource = new VersionRB({ version: expectedPatchVersion }).updateContent(versionSource)
assert.match(updatedVersionSource, new RegExp(`VERSION = ['\"]${expectedPatchVersion.toString()}['\"]`))

if (packagedGem) {
  const updatedGemfileLock = new GemfileLock({
    gemName: packageConfig['package-name'],
    version: expectedPatchVersion,
  }).updateContent(gemfileLock)
  assert.match(updatedGemfileLock, new RegExp(`${packageConfig['package-name']} \\(${expectedPatchVersion.toString()}\\)`))
}

console.log(
  `Release rules verified: feat=minor, breaking=major, every one of the ${config['changelog-sections'].length} types releases and is listed.`,
)
console.log(`Version file verified: ${packageConfig['version-file']} holds ${currentVersion.toString()}.`)
console.log('\nMaintenance fixture preview:\n')
console.log(maintenanceNotes)
