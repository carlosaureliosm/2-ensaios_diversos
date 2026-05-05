import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  const isPrivateRoute = request.nextUrl.pathname.startsWith('/ensaios') || request.nextUrl.pathname.startsWith('/usuarios')

  if (!session && isPrivateRoute) return NextResponse.redirect(new URL('/login', request.url))
  if (session && isAuthRoute) return NextResponse.redirect(new URL('/ensaios', request.url))

  return response
}

export const config = {
  matcher: ['/ensaios/:path*', '/usuarios/:path*', '/login'],
}
