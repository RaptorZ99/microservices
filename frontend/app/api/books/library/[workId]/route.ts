import { NextRequest, NextResponse } from 'next/server'
import { bookServiceUrl } from '@/lib/services'

export async function DELETE(request: NextRequest, context: { params: Promise<{ workId: string }> }) {
  const token = request.cookies.get('access_token')?.value
  if (!token) {
    return NextResponse.json({ detail: 'unauthorized' }, { status: 401 })
  }

  const { workId } = await context.params

  try {
    const target = bookServiceUrl(`/library/${encodeURIComponent(workId)}`)
    const r = await fetch(target, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json(data, { status: r.status })
  } catch {
    return NextResponse.json({ detail: 'remove failed' }, { status: 500 })
  }
}
