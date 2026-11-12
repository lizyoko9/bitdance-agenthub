/** Match raw/blob/tree forms without conflating skills from different repositories, refs, or paths. */
export function githubSkillKey(input: string): string {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return input.trim()
  }
  url.search = ''
  url.hash = ''
  const segments = url.pathname.split('/').filter(Boolean)
  let resource: string[]
  if (url.hostname === 'raw.githubusercontent.com' && segments.length >= 4) {
    resource = segments
  } else if (url.hostname === 'github.com' && segments.length >= 4) {
    const [owner, repo, type, ...rest] = segments
    if (type === 'blob' && rest.length >= 2) resource = [owner, repo, ...rest]
    else if (type === 'tree') resource = [owner, repo, ...rest, 'SKILL.md']
    else return url.toString()
  } else {
    return url.toString()
  }
  try {
    const [owner, repo, ...path] = resource.map(decodeURIComponent)
    return ['github', owner.toLowerCase(), repo.toLowerCase(), ...path]
      .map(encodeURIComponent)
      .join('/')
  } catch {
    return url.toString()
  }
}

