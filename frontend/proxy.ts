// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Déclare explicitement quelles routes doivent passer par ce proxy.
// Ici : toutes les routes de /dashboard et sous-routes.
export const config = {
  matcher: ['/dashboard/:path*'],
}

/**
 * Proxy SSR chargé de contrôler l'accès aux zones protégées.
 *
 * - Vérifie la présence du cookie `access_token`
 * - En cas d’absence : redirige vers la page de login
 * - Sinon : laisse passer la requête
 */
export function proxy(request: NextRequest) {
  // Extraction du token côté serveur via les cookies de la requête
  const access = request.cookies.get('access_token')?.value

  // Absence du token → redirection vers '/'
  if (!access) {
    const loginUrl = new URL('/', request.url)
    loginUrl.searchParams.set('reason', 'auth-required') // paramètre informatif
    return NextResponse.redirect(loginUrl)
  }

  // Token présent → accès autorisé
  return NextResponse.next()
}

