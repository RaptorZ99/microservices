import { NextRequest, NextResponse } from 'next/server'
import { bookServiceUrl } from '@/lib/services'

export async function GET(request: NextRequest, context: { params: Promise<{ workId: string }> }) {
  const token = request.cookies.get('access_token')?.value
  if (!token) {
    return NextResponse.json({ detail: 'unauthorized' }, { status: 401 })
  }

  const { workId } = await context.params

  try {
    const target = bookServiceUrl(`/details/${encodeURIComponent(workId)}`)
    const r = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json(data, { status: r.status })
  } catch {
    return NextResponse.json({ detail: 'detail fetch failed' }, { status: 500 })
  }
}
