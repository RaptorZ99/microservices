'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

interface BookPreview {
  workId: string
  title: string
  authors: string[]
  editionTitle?: string | null
  publishYear?: number | null
  publishDate?: string | null
  coverUrl?: string | null
}

interface LibraryEntry extends BookPreview {
  entryId: number
  addedAt: string
}

interface BookDetail extends BookPreview {
  description?: string | null
  subjects: string[]
  coverGallery: string[]
  links: { title: string; url: string }[]
  editions: { key: string; title: string; publishDate?: string | null; coverUrl?: string | null }[]
}

type Banner = { kind: 'success' | 'error'; text: string }

const getErrorDetail = (payload: unknown) => {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail
    return typeof detail === 'string' ? detail : ''
  }
  return ''
}

const asBookPreviews = (payload: unknown): BookPreview[] =>
  Array.isArray(payload) ? (payload as BookPreview[]) : []

const asLibraryEntries = (payload: unknown): LibraryEntry[] =>
  Array.isArray(payload) ? (payload as LibraryEntry[]) : []

export default function BookDashboard() {
  const [titleQuery, setTitleQuery] = useState('')
  const [authorQuery, setAuthorQuery] = useState('')
  const [searchResults, setSearchResults] = useState<BookPreview[]>([])
  const [searchScope, setSearchScope] = useState<'title' | 'author'>('title')
  const [searchState, setSearchState] = useState<'title' | 'author' | null>(null)
  const [searchError, setSearchError] = useState('')

  const [library, setLibrary] = useState<LibraryEntry[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)

  const [detail, setDetail] = useState<BookDetail | null>(null)
  const detailCache = useRef<Record<string, BookDetail>>({})
  const [detailLoading, setDetailLoading] = useState(false)

  const [banner, setBanner] = useState<Banner | null>(null)

  useEffect(() => {
    const timer = banner ? setTimeout(() => setBanner(null), 4000) : undefined
    return () => timer && clearTimeout(timer)
  }, [banner])

  const notify = useCallback(
    (kind: Banner['kind'], text: string) => setBanner({ kind, text }),
    []
  )

  const fetchSearch = async (scope: 'title' | 'author', query: string) => {
    const value = query.trim()
    if (!value) return

    setSearchError('')
    setSearchState(scope)

    try {
      const params = new URLSearchParams({ q: value })
      if (scope === 'author') params.set('scope', 'author')
      const res = await fetch(`/api/books/search?${params.toString()}`, { cache: 'no-store' })
      const payload = (await res.json().catch(() => [])) as unknown
      if (!res.ok) {
        throw new Error(getErrorDetail(payload) || 'Recherche impossible')
      }
      setSearchScope(scope)
      setSearchResults(asBookPreviews(payload))
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Recherche impossible')
      setSearchResults([])
    } finally {
      setSearchState(null)
    }
  }

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch('/api/books/library', { cache: 'no-store' })
      const payload = (await res.json().catch(() => [])) as unknown
      if (!res.ok) throw new Error(getErrorDetail(payload) || 'Chargement impossible')
      setLibrary(asLibraryEntries(payload))
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Bibliothèque indisponible')
      setLibrary([])
    } finally {
      setLibraryLoading(false)
    }
  }, [notify])

  useEffect(() => {
    loadLibrary()
  }, [loadLibrary])

  const addBook = async (workId: string) => {
    try {
      const res = await fetch('/api/books/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId }),
      })
      const payload = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) throw new Error(getErrorDetail(payload) || 'Ajout impossible')
      notify('success', 'Livre ajouté dans votre bibliothèque')
      loadLibrary()
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Ajout impossible')
    }
  }

  const removeBook = async (workId: string) => {
    if (!confirm('Retirer ce livre de votre bibliothèque ?')) return
    try {
      const res = await fetch(`/api/books/library/${encodeURIComponent(workId)}`, {
        method: 'DELETE',
      })
      const payload = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) throw new Error(getErrorDetail(payload) || 'Suppression impossible')
      notify('success', 'Livre retiré')
      loadLibrary()
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Suppression impossible')
    }
  }

  const showDetails = async (workId: string) => {
    if (detailCache.current[workId]) {
      setDetail(detailCache.current[workId])
      return
    }

    setDetailLoading(true)
    try {
      const res = await fetch(`/api/books/details/${encodeURIComponent(workId)}`, {
        cache: 'no-store',
      })
      const payload = (await res.json().catch(() => ({}))) as unknown
      if (!res.ok) throw new Error(getErrorDetail(payload) || 'Impossible de récupérer les détails')
      const detailData = payload as BookDetail
      detailCache.current[workId] = detailData
      setDetail(detailData)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Détails indisponibles')
    } finally {
      setDetailLoading(false)
    }
  }

  const formatEdition = (book: BookPreview) => {
    if (book.editionTitle && book.publishDate) return `${book.editionTitle} (${book.publishDate})`
    if (book.editionTitle) return book.editionTitle
    if (book.publishYear) return `Édition ${book.publishYear}`
    return 'Édition inconnue'
  }

  return (
    <div className="space-y-8">
      {banner && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            banner.kind === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {banner.text}
        </div>
      )}

      <section className="bg-white shadow rounded-2xl p-6 space-y-6">
        <h2 className="text-xl font-semibold">🔎 Rechercher des livres</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              fetchSearch('title', titleQuery)
            }}
            className="space-y-2"
          >
            <label className="text-sm text-gray-600">Par titre</label>
            <div className="flex gap-2">
              <input
                value={titleQuery}
                onChange={(e) => setTitleQuery(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                placeholder="ex: The Hobbit"
              />
              <button
                type="submit"
                disabled={!titleQuery.trim() || searchState === 'title'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                {searchState === 'title' ? 'Recherche…' : 'Rechercher'}
              </button>
            </div>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              fetchSearch('author', authorQuery)
            }}
            className="space-y-2"
          >
            <label className="text-sm text-gray-600">Par auteur</label>
            <div className="flex gap-2">
              <input
                value={authorQuery}
                onChange={(e) => setAuthorQuery(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                placeholder="ex: Jane Austen"
              />
              <button
                type="submit"
                disabled={!authorQuery.trim() || searchState === 'author'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                {searchState === 'author' ? 'Recherche…' : 'Rechercher'}
              </button>
            </div>
          </form>
        </div>
        {searchError && <p className="text-sm text-red-600">{searchError}</p>}
      </section>

      <section className="bg-white shadow rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Résultats ({searchScope === 'author' ? 'auteur' : 'titre'})</h2>
          {searchState && <p className="text-sm text-gray-500">Recherche en cours…</p>}
        </div>
        {searchResults.length === 0 ? (
          <p className="text-gray-500">Lancez une recherche pour afficher des résultats.</p>
        ) : (
          <ul className="space-y-4">
            {searchResults.map((book) => (
              <li
                key={book.workId}
                className="flex flex-col sm:flex-row gap-4 border border-gray-200 rounded-xl p-4"
              >
                {book.coverUrl ? (
                  <Image
                    src={book.coverUrl}
                    alt={book.title}
                    width={96}
                    height={128}
                    sizes="96px"
                    className="w-24 h-32 object-cover rounded"
                  />
                ) : (
                  <div className="w-24 h-32 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                    N/A
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">{book.title}</h3>
                  <p className="text-sm text-gray-600">
                    {book.authors?.length ? book.authors.join(', ') : 'Auteur inconnu'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{formatEdition(book)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => addBook(book.workId)}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                    >
                      Ajouter
                    </button>
                    <button
                      onClick={() => showDetails(book.workId)}
                      className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                    >
                      Informations
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white shadow rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">📚 Ma bibliothèque</h2>
          {libraryLoading && <span className="text-sm text-gray-500">Chargement…</span>}
        </div>
        {library.length === 0 ? (
          <p className="text-gray-500">Ajoutez un livre pour le retrouver ici.</p>
        ) : (
          <ul className="space-y-3">
            {library.map((entry) => (
              <li
                key={entry.entryId}
                className="flex flex-col sm:flex-row gap-3 border border-gray-200 rounded-xl p-4"
              >
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{entry.title}</p>
                  <p className="text-sm text-gray-600">
                    {entry.authors?.length ? entry.authors.join(', ') : 'Auteur inconnu'}
                  </p>
                  <p className="text-xs text-gray-400">
                    Ajouté le {new Date(entry.addedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => showDetails(entry.workId)}
                    className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                  >
                    Informations
                  </button>
                  <button
                    onClick={() => removeBook(entry.workId)}
                    className="px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white shadow rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">ℹ️ Informations du livre</h2>
          {detailLoading && <span className="text-sm text-gray-500">Chargement…</span>}
        </div>
        {!detail ? (
          <p className="text-gray-500">Sélectionnez « Informations » sur un livre pour afficher ses détails.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-semibold text-gray-900">{detail.title}</p>
              <p className="text-sm text-gray-600">
                {detail.authors?.length ? detail.authors.join(', ') : 'Auteur inconnu'}
              </p>
              <p className="text-sm text-gray-500">{formatEdition(detail)}</p>
            </div>
            {detail.description && (
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {detail.description}
              </p>
            )}
            {detail.coverGallery?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Covers</p>
                <div className="flex gap-3 overflow-x-auto">
                  {detail.coverGallery.map((cover) => (
                    <Image
                      key={cover}
                      src={cover}
                      alt="Cover"
                      width={80}
                      height={112}
                      sizes="80px"
                      className="w-20 h-28 object-cover rounded"
                    />
                  ))}
                </div>
              </div>
            )}
            {detail.subjects?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {detail.subjects.map((subject) => (
                  <span key={subject} className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                    {subject}
                  </span>
                ))}
              </div>
            )}
            {detail.editions?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Éditions populaires</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {detail.editions.slice(0, 4).map((edition) => (
                    <div key={edition.key} className="border border-gray-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-800">{edition.title}</p>
                      <p className="text-xs text-gray-500">{edition.publishDate || 'Date inconnue'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detail.links?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Liens externes</p>
                <ul className="list-disc list-inside text-sm text-blue-600">
                  {detail.links.map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {link.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
