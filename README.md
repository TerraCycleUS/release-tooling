# release-tooling

Release Please wiring and pull request rules shared by the TerraCycle repositories.
`loop-client` and `loop-coms` each carried their own copy of these twelve files; this
is that copy, once.

## What it provides

| Command | Does |
| --- | --- |
| `verify-release-rules` | asserts the release config: every commit type releases and has a changelog section, and the version file matches the manifest |
| `validate-pull-request` | rejects a branch name or pull request title that does not carry its Jira key |
| `create-release-branch` | cuts `release/<tag>` from a published release, so Heroku can deploy it |
| `linkify-release-notes` | turns Jira keys in the published release notes into links |
| `linkify-changelog` | does the same for `CHANGELOG.md` on the open release pull request |

## Using it

The package is published to GitHub Packages. A consuming repository needs an `.npmrc`
next to its `package.json`:

```
@terracycleus:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${TC_NPM_TOKEN}
```

and the dependency:

```json
{
  "private": true,
  "dependencies": {
    "@terracycleus/release-tooling": "^1.0.0"
  }
}
```

Then call the commands from CI, with the `tc_packages token` context attached to any
job that installs:

```yaml
- run: npm ci --prefix .release
- run: npx --prefix .release verify-release-rules
```

`TC_NPM_TOKEN` reads packages; it cannot write to repositories. That is deliberate —
the jobs that install this run branch code, so the credential they carry should not be
able to touch a repository.

Nothing here names an organisation, a Jira instance or a repository: those come from
the environment and from the config of the repository being served. Set `JIRA_PROJECT`
and `JIRA_BROWSE_URL` in CI.

Every command runs from the root of the repository it serves and reads that
repository's `release-please-config.json`. Nothing about a specific repository lives
here — the release type, the version file and the package name all come from that
config.

## Environment

| Variable | Used by | Default |
| --- | --- | --- |
| `RELEASE_PLEASE_TOKEN` | everything that talks to GitHub | required |
| `RELEASE_REPOSITORY` | the same | `$CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME` |
| `GITHUB_TOKEN` | `validate-pull-request` | optional; required on a private repository, which answers 404 rather than 403 |
| `JIRA_PROJECT` | key matching | `JIRA` |
| `JIRA_BROWSE_URL` | link targets | none — required, e.g. `https://example.atlassian.net/browse` |

## Releasing this package

Bump `version` in `package.json`, commit, then push a matching tag:

```sh
git tag v1.0.1 && git push origin v1.0.1
```

CI publishes on that tag and refuses if the tag and the package version disagree.
Consumers take the new version through their own `npm update`.

Publishing uses `RELEASE_PLEASE_TOKEN` from the `tc-loop-release-please` context, which
is the token that carries `write:packages`. Consumers never see it — they read with
`TC_NPM_TOKEN`, which cannot write anywhere.

## Tests

`npm test` covers the pure logic — Jira link rewriting, the GitHub helpers and the
pull request rules, against a fixture config. `verify-release-rules` is not a unit
test: it asserts the config of whichever repository it runs in.
