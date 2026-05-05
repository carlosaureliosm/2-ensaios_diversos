import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "TECOMAT - Ensaios Diversos",
  description: "Plataforma de gestão de ensaios técnicos",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
