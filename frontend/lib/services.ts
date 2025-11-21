function stripTrailingSlash(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function ensureLeadingSlash(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

export function bookServiceUrl(path: string) {
  const base = process.env.BOOK_SERVICE_URL || 'http://localhost:9000/books'
  return `${stripTrailingSlash(base)}${ensureLeadingSlash(path)}`
}
