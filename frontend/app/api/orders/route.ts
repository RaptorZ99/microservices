import { cookies } from 'next/headers'

/**
 * API Gateway – Orders
 * - GET : récupère les commandes depuis le Order Service
 * - POST : crée une commande
 */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return Response.json({ detail: 'unauthorized' }, { status: 401 })
  }

  try {
    const r = await fetch(
      `${process.env.ORDER_SERVICE_URL || 'http://localhost:4000/orders'}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const json = await r.json().catch(() => ({}))
    return Response.json(json, { status: r.status })
  } catch {
    return Response.json({ detail: 'order service unreachable' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    return Response.json({ detail: 'unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const r = await fetch(
      `${process.env.ORDER_SERVICE_URL || 'http://localhost:4000/orders'}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    )

    const json = await r.json().catch(() => ({}))
    return Response.json(json, { status: r.status })
  } catch {
    return Response.json({ detail: 'order creation failed' }, { status: 500 })
  }
}

