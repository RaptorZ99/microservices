import type { ReactNode } from 'react'
import Nav from '@/components/nav'

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-screen bg-slate-50">
      <Nav />
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">{children}</div>
    </section>
  )
}
