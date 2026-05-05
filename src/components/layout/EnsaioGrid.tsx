// src/components/layout/EnsaioGrid.tsx
'use client'

import { useRouter } from 'next/navigation'

export interface EnsaioItem {
  label: string
  href: string
}

const ENSAIOS: EnsaioItem[] = [
  { label: 'Esclerometria',           href: '/ensaios/esclerometria' },
  { label: 'Pacometria',              href: '/ensaios/pacometria' },
  { label: 'Resistividade do Concreto', href: '/ensaios/resistividade' },
  { label: 'Potencial de Corrosão',   href: '/ensaios/potencial-corrosao' },
  { label: 'Carbonatação',            href: '/ensaios/carbonatacao' },
  { label: 'Ultrassom',               href: '/ensaios/ultrassom' },
]

export default function EnsaioGrid() {
  const router = useRouter()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-sm">
      {ENSAIOS.map((ensaio) => (
        <button
          key={ensaio.href}
          onClick={() => router.push(ensaio.href)}
          className="
            group flex items-center justify-center h-24
            bg-surface-container-lowest border border-outline-variant
            rounded-lg p-sm shadow-sm
            hover:bg-primary-container
            active:scale-95 transition-all duration-150
          "
        >
          <span className="
            text-body-md text-primary-container text-center font-semibold
            group-hover:text-on-primary transition-colors
          ">
            {ensaio.label}
          </span>
        </button>
      ))}
    </div>
  )
}
