import type { ReactNode } from 'react'
import DashboardNav from '@/components/dashboard-nav'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-screen bg-slate-50">
      <DashboardNav />
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">{children}</div>
    </section>
  )
}
