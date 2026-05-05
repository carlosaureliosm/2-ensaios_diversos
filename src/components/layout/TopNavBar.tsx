// src/components/layout/TopNavBar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface TopNavBarProps {
  userName: string
  userRole: string
  userEmail: string
  userAvatarUrl?: string
  isAdmin?: boolean
}

export default function TopNavBar({
  userName,
  userRole,
  userEmail,
  userAvatarUrl,
  isAdmin = false,
}: TopNavBarProps) {
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const navItems = [
    { label: 'Ensaios', href: '/ensaios' },
    ...(isAdmin ? [{ label: 'Usuários', href: '/usuarios', badge: 'Admin' }] : []),
  ]

  return (
    <header className="
      flex justify-between items-center w-full h-16 px-6 sticky top-0 z-50
      bg-surface-container-lowest border-b border-outline-variant shadow-sm
    ">
      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-10">
        <Link href="/ensaios">
          <span className="text-xl font-black tracking-tighter text-primary-container uppercase select-none">
            TECOMAT
          </span>
        </Link>

        <nav className="flex gap-8 h-full items-center">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <div key={item.href} className="flex items-center gap-1">
                <Link
                  href={item.href}
                  className={`
                    py-5 text-label-sm font-semibold transition-colors
                    ${active
                      ? 'text-primary-container border-b-2 border-primary-container'
                      : 'text-outline hover:text-primary-container'
                    }
                  `}
                >
                  {item.label}
                </Link>
                {item.badge && (
                  <span className="text-[10px] bg-surface-container text-outline px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wide">
                    {item.badge}
                  </span>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      {/* Right: User profile */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-3 py-2 pl-3 rounded-full hover:bg-surface-container transition-colors cursor-pointer"
        >
          <div className="hidden md:block text-right">
            <p className="text-label-xs font-bold text-on-surface leading-none">{userName}</p>
            <p className="text-[10px] text-outline">{userRole}</p>
          </div>
          <div className="h-9 w-9 rounded-full bg-primary-container overflow-hidden border border-outline-variant flex items-center justify-center">
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-on-primary font-bold text-label-sm">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg py-2 z-50">
            <div className="px-4 py-2 border-b border-surface-container">
              <p className="text-label-sm font-bold text-on-surface">{userName}</p>
              <p className="text-label-xs text-outline">{userEmail}</p>
            </div>
            <Link
              href="/perfil"
              className="flex items-center gap-2 px-4 py-2 text-label-sm text-on-surface-variant hover:bg-surface-container transition-colors"
              onClick={() => setDropdownOpen(false)}
            >
              Meu Perfil
            </Link>
            <button
              className="w-full flex items-center gap-2 px-4 py-2 text-label-sm text-error hover:bg-error-container/10 transition-colors"
              onClick={() => {
                setDropdownOpen(false)
                // TODO: supabase.auth.signOut()
              }}
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
