// Where each release type keeps the version, and how it is written there. Everything else
// about applying a bump comes from release-please's own updaters, so adding a type here is
// the only change a new language needs.
export const RELEASE_TYPES = {
  ruby: {
    versionFile: config => config['version-file'],
    holds: version => new RegExp(`VERSION = ['"]${version}['"]`),
    // Only a packaged gem lists itself in its own lockfile; an application does not.
    lockfile: 'Gemfile.lock',
    lockedAs: (name, version) => new RegExp(`${name} \\(${version}\\)`),
  },
  node: {
    versionFile: () => 'package.json',
    holds: version => new RegExp(`"version":\\s*"${version}"`),
  },
  simple: {
    versionFile: config => config['version-file'] ?? 'version.txt',
    holds: version => new RegExp(`^${version}$`, 'm'),
  },
}
