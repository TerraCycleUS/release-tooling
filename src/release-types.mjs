import { escapeRegExp } from './escape-regexp.mjs'

// Where each release type keeps the version, and how it is written there. Everything else
// about applying a bump comes from release-please's own updaters, so adding a type here is
// the only change a new language needs.
export const RELEASE_TYPES = {
  ruby: {
    versionFile: config => config['version-file'],
    holds: version => new RegExp(`VERSION = ['"]${escapeRegExp(version)}['"]`),
    // Only a packaged gem lists itself in its own lockfile; an application does not.
    lockfile: 'Gemfile.lock',
    lockedAs: (name, version) => new RegExp(`${escapeRegExp(name)} \\(${escapeRegExp(version)}\\)`),
  },
  node: {
    versionFile: () => 'package.json',
    holds: version => new RegExp(`"version":\\s*"${escapeRegExp(version)}"`),
  },
  simple: {
    versionFile: config => config['version-file'] ?? 'version.txt',
    holds: version => new RegExp(`^${escapeRegExp(version)}$`, 'm'),
  },
}
