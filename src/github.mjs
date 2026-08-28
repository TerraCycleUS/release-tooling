const token = process.env.RELEASE_PLEASE_TOKEN
const repository = process.env.RELEASE_REPOSITORY ||
  [process.env.CIRCLE_PROJECT_USERNAME, process.env.CIRCLE_PROJECT_REPONAME].filter(Boolean).join('/')

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

export async function json(path, options = {}) {
  const response = await request(path, options)
  if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${path}`)
  return response.json()
}

// GitHub answers 404 when a token is missing or cannot see the repository, and every
// caller would read that as "nothing published yet" and skip its work silently.
export function requireToken() {
  if (!token) throw new Error('RELEASE_PLEASE_TOKEN is not set; GitHub then answers 404 and the run skips its work.')
}

export async function optionalJson(path, options = {}) {
  const response = await request(path, options)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${path}`)
  return response.json()
}

export function releasePullRequest(pulls) {
  return pulls.find(pull => pull.head?.ref?.startsWith('release-please--')) ?? null
}
