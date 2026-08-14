const CONVENTIONAL_COMMIT_RE = /^([a-z]+)(?:\(([^)]+)\))?!?:\s*([\s\S]+)/

async function getPullRequestInfo(commit, repo) {
  const token = process.env.GITHUB_TOKEN
  if (!token || !commit || !repo) return null

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits/${commit}/pulls`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) return null
    const pulls = await res.json()
    return pulls[0] ? {number: pulls[0].number, title: pulls[0].title} : null
  } catch {
    return null
  }
}

function parsePrNumberFromId(id) {
  const match = id.match(/^pr-(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

async function getReleaseLine(changeset, _type, options) {
  const repo = options?.repo
  const {commit, id, summary} = changeset
  const trimmedSummary = summary.trim()

  let prNumber = parsePrNumberFromId(id)
  let prTitle = null

  if (!prNumber && commit && repo) {
    const pr = await getPullRequestInfo(commit, repo)
    if (pr) {
      prNumber = pr.number
      prTitle = pr.title
    }
  }

  const source = trimmedSummary.match(CONVENTIONAL_COMMIT_RE) ? trimmedSummary : prTitle
  const ccMatch = source?.match(CONVENTIONAL_COMMIT_RE)

  const scope = ccMatch?.[2] || null
  const description = ccMatch ? ccMatch[3].trim() : trimmedSummary

  const [firstLine, ...restLines] = description.split('\n')
  const scopePrefix = scope ? `**${scope}:** ` : ''
  const prLink =
    prNumber && repo ? ` ([#${prNumber}](https://github.com/${repo}/pull/${prNumber}))` : ''
  const commitLink =
    commit && repo ? ` ([${commit.slice(0, 7)}](https://github.com/${repo}/commit/${commit}))` : ''

  const formatted = `${scopePrefix}${firstLine}${prLink}${commitLink}`
  if (restLines.length > 0) {
    return `- ${formatted}\n${restLines.map((l) => (l ? '  ' + l : l)).join('\n')}`
  }
  return `- ${formatted}`
}

async function getDependencyReleaseLine(_changesets, dependenciesUpdated) {
  if (dependenciesUpdated.length === 0) return ''

  const updates = dependenciesUpdated.map((dep) => `    - ${dep.name} bumped to ${dep.newVersion}`)

  return [
    '',
    '- The following workspace dependencies were updated',
    '  - dependencies',
    ...updates,
  ].join('\n')
}

export default {
  getReleaseLine,
  getDependencyReleaseLine,
}
