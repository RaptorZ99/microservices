import { cookies } from 'next/headers'
import { bookServiceUrl } from '@/lib/services'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return Response.json({ detail: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const scope = searchParams.get('scope') === 'author' ? 'author' : 'title'

  if (!query) {
    return Response.json({ detail: 'missing query' }, { status: 400 })
  }

  const target = new URL(bookServiceUrl('/search'))
  target.searchParams.set('q', query)
  if (scope === 'author') target.searchParams.set('scope', 'author')

  try {
    const r = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    const data = await r.json().catch(() => ({}))
    return Response.json(data, { status: r.status })
  } catch {
    return Response.json({ detail: 'book service unreachable' }, { status: 503 })
  }
}
