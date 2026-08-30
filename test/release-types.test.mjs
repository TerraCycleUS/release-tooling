import assert from 'node:assert/strict'

import { RELEASE_TYPES } from '../src/release-types.mjs'

const { ruby, node, simple } = RELEASE_TYPES

// Where each type looks for the version. Only ruby reads it from the config; the other two
// know their own file, so a config that omits `version-file` still resolves.
assert.equal(ruby.versionFile({ 'version-file': 'lib/loop_client/version.rb' }), 'lib/loop_client/version.rb')
assert.equal(node.versionFile({}), 'package.json')
assert.equal(simple.versionFile({}), 'version.txt')
assert.equal(simple.versionFile({ 'version-file': 'VERSION' }), 'VERSION')

// Only ruby has a lockfile that names the package; verify-release-rules reads `lockfile`
// being undefined as "this type has no lock check", so the absence is load-bearing.
assert.equal(ruby.lockfile, 'Gemfile.lock')
assert.equal(node.lockfile, undefined)
assert.equal(simple.lockfile, undefined)

// What release-please actually writes. VersionRB keeps whichever quote it found, so both
// have to match; the node updater writes the key with one space after the colon.
assert.match("  VERSION = '2.0.5'", ruby.holds('2.0.5'))
assert.match('  VERSION = "2.0.5"', ruby.holds('2.0.5'))
assert.match('{\n  "version": "0.1.0"\n}', node.holds('0.1.0'))
assert.match('{"version":"0.1.0"}', node.holds('0.1.0'))
assert.match('1.2.3\n', simple.holds('1.2.3'))
assert.match('    loop_client (2.0.5)', ruby.lockedAs('loop_client', '2.0.5'))

// A version that is not the one asked for must not match, whichever type asks.
assert.doesNotMatch("  VERSION = '2.0.6'", ruby.holds('2.0.5'))
assert.doesNotMatch('{"version":"0.1.1"}', node.holds('0.1.0'))
assert.doesNotMatch('1.2.4\n', simple.holds('1.2.3'))
assert.doesNotMatch('    loop_client (2.0.6)', ruby.lockedAs('loop_client', '2.0.5'))

// The version and the package name are interpolated into a pattern, so they have to be
// escaped: an unescaped `.` matches any character, and the check then passes on a file
// that holds a different version entirely.
assert.doesNotMatch("  VERSION = '1y2z3'", ruby.holds('1.2.3'))
assert.doesNotMatch('{"version":"0x1x0"}', node.holds('0.1.0'))
assert.doesNotMatch('0x1x0\n', simple.holds('0.1.0'))
assert.doesNotMatch('    loop_client (2x0x5)', ruby.lockedAs('loop_client', '2.0.5'))
assert.doesNotMatch('    loopxclient (2.0.5)', ruby.lockedAs('loop_client', '2.0.5'))

// A prerelease or build suffix carries characters a pattern would otherwise read as syntax.
assert.match("  VERSION = '1.0.0-rc.1'", ruby.holds('1.0.0-rc.1'))
assert.match('{"version":"1.0.0+build.2"}', node.holds('1.0.0+build.2'))
assert.doesNotMatch('{"version":"1.0.0"}', node.holds('1.0.0+build.2'))

console.log('Release types verified.')
