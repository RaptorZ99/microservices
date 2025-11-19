'use server'

import { cookies } from 'next/headers'

/**
 * Lecture du token d'accès depuis les cookies.
 * Utilisé dans les pages SSR ou les actions serveur.
 */
export async function getAccessToken() {
  const cookieStore = await cookies()
  return cookieStore.get('access_token')?.value
}

/**
 * Dépôt des tokens côté serveur dans des cookies httpOnly.
 * Ces cookies ne sont jamais accessibles au JavaScript du navigateur.
 */
export async function setTokens({
  access,
  refresh,
}: {
  access: string
  refresh?: string
}) {
  const cookieStore = await cookies()

  // Cookie du token d'accès
  cookieStore.set({
    name: 'access_token',
    value: access,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 heure
  })

  // Cookie du refresh token, si fourni
  if (refresh) {
    cookieStore.set({
      name: 'refresh_token',
      value: refresh,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 jours
    })
  }
}

/**
 * Suppression sécurisée des cookies JWT côté serveur.
 */
export async function clearTokens() {
  const cookieStore = await cookies()
  cookieStore.delete('access_token')
  cookieStore.delete('refresh_token')
}