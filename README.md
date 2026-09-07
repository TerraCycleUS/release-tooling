# release-tooling

Release Please wiring and pull request rules shared by the TerraCycle repositories.
loop-client, loop-coms, loop-dms and loop-tds each carried their own copy of these
files; this is that copy, once.

## What it provides

| Command | Does |
| --- | --- |
| `verify-release-rules` | asserts the release config: its `changelog-sections` match the canonical list here, every type releases, and the version file matches the manifest |
| `validate-pull-request` | rejects a branch name or pull request title that does not carry its Jira key |
| `create-release-branch` | cuts `release/<tag>` from a published release, so Heroku can deploy it |
| `linkify-release-notes` | turns Jira keys in the published release notes into links |
| `linkify-changelog` | does the same for `CHANGELOG.md` and the description on the open release pull request |

## Using it

This repository is public, so a consuming repository takes it straight from git and needs
no registry and no credentials:

```json
{
  "private": true,
  "dependencies": {
    "@terracycleus/release-tooling": "github:TerraCycleUS/release-tooling#v1.2.0"
  }
}
```

Then call the commands from CI:

```yaml
- run: npm ci --prefix .release
- run: .release/node_modules/.bin/verify-release-rules
```

Because installing needs no token, the jobs that install this — which run branch code —
carry no credential at all. Only the jobs that talk to GitHub afterwards get one.

Pin the tag, not a range: `#v1.2.0` resolves to that tag and nothing else, so a consumer
moves deliberately.

Nothing here names an organisation, a Jira instance or a repository: those come from
the environment and from the config of the repository being served. Set `JIRA_PROJECT`
and `JIRA_BROWSE_URL` in CI.

Every command runs from the root of the repository it serves and reads that
repository's `release-please-config.json`. Nothing about a specific repository lives
here — the release type, the version file and the package name all come from that
config. `ruby`, `node` and `simple` are supported; `src/release-types.mjs` says where each
keeps its version, and everything else about applying a bump comes from Release Please's
own updaters, so adding a language is one entry there.

## Environment

| Variable | Used by | Default |
| --- | --- | --- |
| `RELEASE_PLEASE_TOKEN` | everything that talks to GitHub | required |
| `RELEASE_REPOSITORY` | the same | `$CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME` |
| `GITHUB_TOKEN` | anything that talks to GitHub | fallback when `RELEASE_PLEASE_TOKEN` is unset |
| `JIRA_PROJECT` | key matching and linking | none — required, e.g. `ITG` |
| `JIRA_BROWSE_URL` | link targets | none — required, e.g. `https://example.atlassian.net/browse` |

## Releasing this package

Release Please runs here too, on the commands this package hands its consumers rather than
on an installed copy — a change that breaks them stops its own release as well. A merge to
`master` opens or updates a draft `chore(master): prepare <version>` pull request; merging
that one bumps `package.json`, writes `CHANGELOG.md` and pushes the `v<version>` tag, and
the tag build publishes to GitHub Packages. Nothing is bumped by hand: `feat` takes a minor,
a breaking change a major, every other type a patch.

Consumers pin the tag, so a release does not reach them on its own: bump the tag
in their `.release/package.json`, then **delete `.release/package-lock.json` and
`.release/node_modules` before running `npm install --prefix .release`** — npm does not
re-resolve a git tag while a lockfile entry for it exists, so a plain install leaves the
old commit pinned and CI keeps installing the old code. Open that as its own pull request.

GitHub Packages is a second way to consume this that nothing uses today. The publish job
takes `RELEASE_PLEASE_TOKEN` from the `tc-loop-release-please` context for its
`write:packages` scope, refuses a tag that disagrees with the package version, and runs on
tags only and never on a branch, so branch code cannot reach that token.

## Tests

`npm test` covers the pure logic — Jira link rewriting, the GitHub helpers and the
pull request rules, against a fixture config. `verify-release-rules` is not a unit
test: it asserts the config of whichever repository it runs in.
