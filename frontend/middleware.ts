import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: ['/order/:path*', '/book/:path*'],
}

export function middleware(request: NextRequest) {
  const access = request.cookies.get('access_token')?.value

  if (!access) {
    const loginUrl = new URL('/', request.url)
    loginUrl.searchParams.set('reason', 'auth-required')
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}
