import { cookies } from 'next/headers'
import { bookServiceUrl } from '@/lib/services'

async function ensureToken() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) throw new Error('unauthorized')
  return token
}

export async function GET() {
  try {
    const token = await ensureToken()
    const r = await fetch(bookServiceUrl('/library'), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await r.json().catch(() => ({}))
    return Response.json(data, { status: r.status })
} catch (err) {
  if ((err as Error).message === 'unauthorized') {
    return Response.json({ detail: 'unauthorized' }, { status: 401 })
  }
  console.error('book library route failed', err)
  return Response.json({ detail: 'library fetch failed' }, { status: 500 })
}
}

export async function POST(request: Request) {
  try {
    const token = await ensureToken()
    const body = await request.json().catch(() => ({}))
    if (!body?.workId) {
      return Response.json({ detail: 'workId required' }, { status: 400 })
    }

    const r = await fetch(bookServiceUrl('/library'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workId: body.workId }),
    })

    const data = await r.json().catch(() => ({}))
    return Response.json(data, { status: r.status })
  } catch (err) {
    if ((err as Error).message === 'unauthorized') {
      return Response.json({ detail: 'unauthorized' }, { status: 401 })
    }
    return Response.json({ detail: 'add book failed' }, { status: 500 })
  }
}
