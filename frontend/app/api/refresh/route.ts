import { cookies } from 'next/headers'

/**
 * Renouvelle le token d'accès à partir du refresh token stocké
 * dans un cookie httpOnly.
 *
 * Utilise l'API cookies() (asynchrone) :
 *   const cookieStore = await cookies()
 */
export async function POST(request: Request) {
  const cookieStore = await cookies()

  // Lecture du refresh_token dans les cookies
  const refresh = cookieStore.get('refresh_token')?.value

  if (!refresh) {
    return Response.json({ detail: 'missing refresh token' }, { status: 401 })
  }

  try {
    // Appel au Auth Service
    const r = await fetch(
      `${process.env.AUTH_SERVICE_URL || 'http://localhost:8000'}/auth/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ refresh_token: refresh }),
      }
    )

    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      return Response.json(
        { detail: err.detail || 'refresh failed' },
        { status: r.status }
      )
    }

    const { access_token } = await r.json()

    // Mise à jour du cookie access_token via cookieStore.set
    cookieStore.set({
      name: 'access_token',
      value: access_token,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600, // 1 heure
    })

    return Response.json({ ok: true })
  } catch {
    return Response.json({ detail: 'refresh failed' }, { status: 500 })
  }
}