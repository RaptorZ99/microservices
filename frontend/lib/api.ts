/**
 * Client interne basé sur fetch, destiné au SSR et aux API Routes.
 *
 * - Fournit un baseURL configurable
 * - Normalise les méthodes GET et POST
 * - Lance une erreur explicite si la réponse n’est pas OK
 */
export function serverApi(baseURL?: string) {
  const root =
    baseURL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    'http://localhost:3000/api' // fallback local

  return {
    /**
     * Requête GET standardisée
     */
    async get(path: string, options?: RequestInit) {
      const res = await fetch(`${root}${path}`, {
        ...options,
        method: 'GET',
      })

      if (!res.ok) {
        throw new Error(`GET ${path} → ${res.status}`)
      }

      return res.json()
    },

    /**
     * Requête POST standardisée
     */
    async post(path: string, body?: any, options?: RequestInit) {
      const res = await fetch(`${root}${path}`, {
        ...options,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
        body: JSON.stringify(body ?? {}),
      })

      if (!res.ok) {
        throw new Error(`POST ${path} → ${res.status}`)
      }

      return res.json()
    },
  }
}