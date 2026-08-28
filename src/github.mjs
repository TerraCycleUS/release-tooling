// Consumers set one or the other: the release jobs carry RELEASE_PLEASE_TOKEN, while a
// run outside CircleCI usually has GITHUB_TOKEN to hand.
const token = process.env.RELEASE_PLEASE_TOKEN || process.env.GITHUB_TOKEN
const repository = process.env.RELEASE_REPOSITORY ||
  [process.env.CIRCLE_PROJECT_USERNAME, process.env.CIRCLE_PROJECT_REPONAME].filter(Boolean).join('/')

// The repository under test identifies itself; nothing here names an organisation.
export const [owner, repo] = repository.split('/')

// An unresolved repository would spell `undefined/undefined` into every URL, and the 404
// that comes back reads to `optionalJson` as "nothing published yet".
export function request(path, options = {}) {
  if (!repository.includes('/')) {
    throw new Error('Set RELEASE_REPOSITORY as owner/repo; CIRCLE_PROJECT_USERNAME and CIRCLE_PROJECT_REPONAME are not both set.')
  }

  return fetch(`https://api.github.com/repos/${repository}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}

// A missing token reads as 404, which `optionalJson` would take for "nothing published
// yet" — so the callers that must not skip their work check for one up front.
export function requireToken() {
  if (!token) throw new Error('Set RELEASE_PLEASE_TOKEN (or GITHUB_TOKEN); without one GitHub answers 404 and the run skips its work.')
}

export async function optionalJson(path, options = {}) {
  const response = await request(path, options)
  if (response.status === 404) return null
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    throw new Error('GitHub rejected the request: rate limit reached for this CircleCI IP. Rerun the job.')
  }
  if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${path}`)
  return response.json()
}

export async function json(path, options = {}) {
  const body = await optionalJson(path, options)
  // A private repository answers 404 rather than 403, so this is as likely a token that
  // cannot read the repository as a resource that is not there.
  if (body === null) throw new Error(`GitHub returned 404 for ${path}; the token may not be able to read this repository.`)
  return body
}

export function releasePullRequest(pulls) {
  return pulls.find(pull => pull.head?.ref?.startsWith('release-please--')) ?? null
}
