// Ícones SVG dos ensaios (tela inicial). Traço único em currentColor:
// a cor vem do CSS do card (cinza → dourado no hover).
import type { ReactNode } from 'react';

const ICONES: Record<string, ReactNode> = {
  esclerometria: (
    <g transform="rotate(-45 24 24)">
      <rect x="1" y="22" width="5" height="4" rx="1" fill="currentColor" fillOpacity=".15" />
      <path d="M6 22.5 L15 18 V30 L6 25.5" fill="currentColor" fillOpacity=".15" />
      <rect x="15" y="16" width="22" height="16" rx="2.5" fill="currentColor" fillOpacity=".15" />
      <rect x="37" y="17" width="6" height="14" rx="2" fill="currentColor" fillOpacity=".15" />
      <rect x="20" y="21" width="12" height="6" rx="1" />
      <path d="M22 21 V23 M24.5 21 V24 M27 21 V23 M29.5 21 V24" strokeWidth="1" />
      <path d="M39.5 20 V28" strokeWidth="1" opacity=".6" />
    </g>
  ),

  pacometria: (
    <>
      <path d="M12 2 V16 M19 2 V16" />
      <path d="M12 5 L19 3 M12 9 L19 7 M12 13 L19 11" strokeWidth="1.2" opacity=".6" />
      <path d="M29 2 V16 M36 2 V16" />
      <path d="M29 5 L36 3 M29 9 L36 7 M29 13 L36 11" strokeWidth="1.2" opacity=".6" />
      <path d="M3 18 H12 L14 16 L18 19 L22 16 L26 19 L30 16 L33 19 L36 17 H45" opacity=".6" />
      <rect x="10" y="21" width="28" height="25" rx="4" fill="currentColor" fillOpacity=".15" />
      <circle cx="24" cy="29" r="4" />
      <path d="M17.5 29 A6.5 6.5 0 0 1 30.5 29 M17.5 29 A6.5 6.5 0 0 0 30.5 29" strokeDasharray="4 3" opacity=".7" />
      <path d="M15 38 H33" strokeWidth="3" strokeDasharray="1.5 1.5" />
      <path d="M24 40.5 V43" strokeWidth="2.5" />
    </>
  ),

  // Método de Wenner: 4 eletrodos e linhas de fluxo de corrente
  resistividade: (
    <>
      <path d="M9 6 V26 M19 6 V26 M29 6 V26 M39 6 V26" />
      <path d="M6 6 H42" strokeWidth="1.5" opacity=".6" />
      <path d="M9 26 L7.5 29 H10.5 Z M19 26 L17.5 29 H20.5 Z M29 26 L27.5 29 H30.5 Z M39 26 L37.5 29 H40.5 Z" fill="currentColor" />
      <path d="M4 30 H44" opacity=".6" />
      <path d="M9 30 A15 15 0 0 0 39 30" />
      <path d="M19 30 A5 5 0 0 0 29 30" />
      <path d="M12.5 30 A11.5 11.5 0 0 0 35.5 30" strokeDasharray="2 2.5" opacity=".6" />
    </>
  ),

  // Eletrodo de referência (meia-célula) sobre a armadura + raio
  potencial: (
    <>
      <rect x="6" y="4" width="10" height="22" rx="2" />
      <path d="M11 26 V32" />
      <path d="M8 34 H14 L11 40 Z" opacity=".6" />
      <path d="M4 42 H44" opacity=".6" />
      <path d="M10 8 H12" strokeLinecap="round" />
      <path d="M33 4 L22 24 H31 L27 38 L42 16 H32 L36 4 Z" />
    </>
  ),

  carbonatacao: (
    <>
      <path d="M24 2 C24 2 19.5 7.5 19.5 10 A4.5 4.5 0 0 0 28.5 10 C28.5 7.5 24 2 24 2 Z" fill="currentColor" fillOpacity=".15" />
      <rect x="6" y="15" width="36" height="22" rx="2" fill="currentColor" fillOpacity=".15" />
      <path d="M6 24 H42" strokeDasharray="3 2.5" />
      <path d="M8 18 H12 M18 21 H22 M30 18 H35 M38 21 H40" strokeWidth="1.2" opacity=".5" />
      <circle cx="24" cy="31" r="3" fill="currentColor" />
      <circle cx="12" cy="31" r="1.3" /><circle cx="36" cy="30" r="1.3" />
      <rect x="6" y="40" width="36" height="6" rx="1" />
      <path d="M12 40 V43 M18 40 V44 M24 40 V43 M30 40 V44 M36 40 V43" strokeWidth="1.2" />
    </>
  ),

  // Transdutores nas extremidades de um corpo de prova + ondas
  ultrassom: (
    <>
      <rect x="12" y="14" width="24" height="20" rx="2" />
      <rect x="4" y="18" width="8" height="12" rx="1.5" />
      <rect x="36" y="18" width="8" height="12" rx="1.5" />
      <path d="M14 24 Q16 16 18 24 T22 24 T26 24 T30 24 Q32 31 34 24" strokeLinecap="round" opacity=".7" />
      <path d="M2 21 Q0.5 24 2 27 M46 21 Q47.5 24 46 27" strokeLinecap="round" opacity=".6" />
    </>
  ),

  aderencia: (
    <>
      <path d="M24 3 V13" />
      <path d="M19 8 L24 3 L29 8" />
      <rect x="17" y="14" width="14" height="6" rx="1" fill="currentColor" fillOpacity=".15" />
      <path d="M24 20 V22" opacity=".6" />
      <rect x="9" y="23" width="30" height="6" rx="1" fill="currentColor" fillOpacity=".15" />
      <path d="M9 29 L7 31 L10 33 L8 35" strokeWidth="1.4" />
      <path d="M39 29 L41 31 L38 33 L40 35" strokeWidth="1.4" />
      <rect x="6" y="34" width="36" height="11" rx="1" />
      <path d="M6 39.5 H42 M16 34 V39.5 M30 34 V39.5 M23 39.5 V45" strokeWidth="1.2" opacity=".6" />
    </>
  ),
};

export function EnsaioIcon({ id, size = 40 }: { id: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {ICONES[id]}
    </svg>
  );
}
