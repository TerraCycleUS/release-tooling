import assert from 'node:assert/strict'

import { addedLines, withJiraLinks, withReferences } from '../src/jira-links.mjs'

const plain = '### Features\n\n* **api:** [ITG-1] add retries\n'
assert.equal(
  withJiraLinks(plain),
  '### Features\n\n* **api:** [ITG-1] add retries\n\n[ITG-1]: https://example.atlassian.net/browse/ITG-1\n',
)

const twice = '* [ITG-1] one\n* [ITG-1] two\n* [ITG-2] three\n'
const linked = withJiraLinks(twice)
assert.equal(linked.match(/^\[ITG-1\]: /gm).length, 1)
assert.equal(linked.match(/^\[ITG-2\]: /gm).length, 1)

assert.equal(withJiraLinks(linked), linked)
assert.equal(withJiraLinks('* no keys here\n'), '* no keys here\n')

const changelog = '# Changelog\n\n## [1.0.1](https://example.test/compare) (2026-08-22)\n\n' +
  '### Bug Fixes\n\n* **api:** [ITG-1] preserve token expiry\n\n[ITG-2]: https://example.atlassian.net/browse/ITG-2\n'
const appended = withJiraLinks(changelog)
assert.ok(appended.startsWith('# Changelog\n'))
assert.equal(appended.match(/^\[ITG-1\]: /gm).length, 1)
assert.equal(appended.match(/^\[ITG-2\]: /gm).length, 1)
assert.equal(withJiraLinks(appended), appended)

const partly = '* [ITG-1] one\n* [ITG-2] two\n\n[ITG-1]: https://example.atlassian.net/browse/ITG-1\n'
const grown = withJiraLinks(partly)
assert.ok(grown.endsWith('[ITG-1]: https://example.atlassian.net/browse/ITG-1\n' +
  '[ITG-2]: https://example.atlassian.net/browse/ITG-2\n'))
assert.doesNotMatch(grown, /\n\n\[ITG-2\]: /)

assert.equal(withReferences('* **deps:** update gems (ITG-376)'), '* **deps:** update gems ([ITG-376])')
assert.equal(withReferences('* (ITG-123, ITG-999) update'), '* ([ITG-123], [ITG-999]) update')
assert.equal(withReferences('* see ITG-500 for details'), '* see [ITG-500] for details')
assert.equal(withReferences('* [ITG-1] already bracketed'), '* [ITG-1] already bracketed')
assert.equal(withReferences('[ITG-1]: https://example.atlassian.net/browse/ITG-1'),
  '[ITG-1]: https://example.atlassian.net/browse/ITG-1')
assert.equal(withReferences('* [ITG-1](https://example.atlassian.net/browse/ITG-1) inline'),
  '* [ITG-1](https://example.atlassian.net/browse/ITG-1) inline')

const loose = '* **deps:** update gems (ITG-376) ([cd448f8](https://example.test/commit/cd448f8))\n'
const tightened = withJiraLinks(loose)
assert.ok(tightened.includes('update gems ([ITG-376])'))
assert.ok(tightened.endsWith('[ITG-376]: https://example.atlassian.net/browse/ITG-376\n'))
assert.equal(withJiraLinks(tightened), tightened)

assert.deepEqual(addedLines(loose, tightened), [
  '* **deps:** update gems ([ITG-376]) ([cd448f8](https://example.test/commit/cd448f8))',
  '[ITG-376]: https://example.atlassian.net/browse/ITG-376',
])
assert.deepEqual(addedLines(tightened, tightened), [])

assert.equal(
  withJiraLinks('[ITG-1]: https://example.atlassian.net/browse/ITG-1\n* [ITG-1] thing\n').match(/^\[ITG-1\]: /gm).length,
  1,
)

// A key quoted as code is part of the sample, not a reference to rewrite.
assert.equal(withReferences('* run `git branch ITG-1-x` first'), '* run `git branch ITG-1-x` first')
assert.equal(withReferences('```\nITG-1\n```\n'), '```\nITG-1\n```\n')
assert.equal(withReferences('* ITG-1 then ```ITG-2``` then ITG-3'), '* [ITG-1] then ```ITG-2``` then [ITG-3]')

console.log('Jira link rules verified.')
