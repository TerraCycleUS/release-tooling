#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { escapeRegExp } from '../src/escape-regexp.mjs'
import { owner, repo, requireRepository } from '../src/github.mjs'
import CANONICAL_SECTIONS from '../src/changelog-sections.json' with { type: 'json' }
import { RELEASE_TYPES } from '../src/release-types.mjs'

import { DefaultChangelogNotes } from 'release-please/build/src/changelog-notes/default.js'
import { parseConventionalCommits } from 'release-please/build/src/commit.js'
import { buildStrategy } from 'release-please/build/src/factory.js'
import { PullRequestTitle } from 'release-please/build/src/util/pull-request-title.js'
import { Version } from 'release-please/build/src/version.js'
import { DefaultVersioningStrategy } from 'release-please/build/src/versioning-strategies/default.js'

const TARGET_BRANCH = 'master'

const config = JSON.parse(await readFile('release-please-config.json', 'utf8'))
const manifestVersions = JSON.parse(await readFile('.release-please-manifest.json', 'utf8'))
const packageConfig = config.packages['.']
const releaseType = packageConfig['release-type']
const language = RELEASE_TYPES[releaseType]
assert.ok(language, `Unsupported release-type ${releaseType}; add it to src/release-types.mjs.`)

const versionFile = language.versionFile(packageConfig)
const versionSource = await readFile(versionFile, 'utf8')
const lockfile = language.lockfile ? await readFile(language.lockfile, 'utf8') : null
// Only a packaged library lists itself in its own lockfile; an application does not.
const packaged = lockfile !== null &&
  new RegExp(`^\\s+${escapeRegExp(packageConfig['package-name'])} \\(`, 'm').test(lockfile)
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

requireRepository()

const strategy = await buildStrategy({
  github: { repository: { owner, repo } },
  releaseType,
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
// The exact update set differs by release type — node emits entries for files that may not
// exist — so what matters is that the changelog and the version file are among them.
const updatePaths = updates.map(update => update.path)
assert.ok(updatePaths.includes('CHANGELOG.md'), 'CHANGELOG.md must be updated by a release.')
assert.ok(updatePaths.includes(versionFile), `${versionFile} must be updated by a release.`)
assert.match(versionSource, language.holds(currentVersion.toString()))
if (packaged) {
  assert.match(lockfile, language.lockedAs(packageConfig['package-name'], currentVersion.toString()))
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

// Apply the repository's own updaters rather than naming one per language: whatever
// release-please would write to the version file is what gets checked.
const versionUpdate = updates.find(update => update.path === versionFile)
assert.match(versionUpdate.updater.updateContent(versionSource), language.holds(expectedPatchVersion.toString()))

if (packaged) {
  const lockUpdate = updates.find(update => update.path === language.lockfile)
  assert.match(lockUpdate.updater.updateContent(lockfile),
    language.lockedAs(packageConfig['package-name'], expectedPatchVersion.toString()))
}

console.log(
  `Release rules verified: feat=minor, breaking=major, every one of the ${config['changelog-sections'].length} types releases and is listed.`,
)
console.log(`Version file verified: ${versionFile} holds ${currentVersion.toString()}.`)
console.log('\nMaintenance fixture preview:\n')
console.log(maintenanceNotes)
