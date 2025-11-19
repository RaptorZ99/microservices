import { NextRequest, NextResponse } from 'next/server'

/**
 * DELETE /api/orders/[id]
 *
 * Cette route App Router agit comme un *proxy* :
 * → elle reçoit une requête du navigateur
 * → récupère le JWT stocké en cookie (access_token)
 * → transmet la requête au microservice OrderService (NestJS)
 * → renvoie le résultat au frontend
 */
export async function DELETE(req: NextRequest, context: any) {
  /**
   * Extraction du JWT :
   * Les cookies côté Next.js (App Router) sont accessibles via req.cookies.
   * Les cookies httpOnly sont lisibles côté serveur uniquement (sécurisé).
   */
  const access = req.cookies.get('access_token')?.value
  if (!access) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  /**
   * Récupération du paramètre dynamique [id].
   *
   * ⚠️ Dans l’App Router, context.params est désormais ASYNCHRONE.
   * On doit donc utiliser : await context.params
   *
   * Exemple d’URL :
   *   DELETE /api/orders/42
   *   → id = "42"
   */
  const { id } = await context.params

  /**
   * Proxy vers le microservice NestJS :
   *   /orders/:id  (DELETE)
   *
   * Le JWT est transmis dans le header Authorization,
   * conformément au format standard : "Bearer <token>".
   */
  try {
    const response = await fetch(
      `${process.env.ORDER_SERVICE_URL || 'http://localhost:4000/orders'}/${id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${access}`,
        },
      }
    )

    /**
     * On transmet simplement au navigateur :
     * - le body JSON renvoyé par le service Orders
     * - et le même statut HTTP (204, 404, 401, etc.)
     */
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    /**
     * Gestion d'erreurs réseau ou internes.
     * Ici, cela signifie que la communication entre Next.js et
     * OrderService a échoué (service down, mauvaise URL, etc.).
     */
    return NextResponse.json({ detail: 'delete failed' }, { status: 500 })
  }
}