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

  // Pacômetro encostado na parede emitindo ondas e identificando vergalhão de aço atrás
  pacometria: (
    <>
      {/* Aparelho pacômetro à esquerda */}
      <rect x="3" y="13" width="14" height="22" rx="2.5" fill="currentColor" fillOpacity=".15" />
      <rect x="6" y="16" width="8" height="7" rx="1" />
      <path d="M8 20.5 L10 18.5 L12 20.5" strokeWidth="1.3" />
      <circle cx="8" cy="27.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="27.5" r=".9" fill="currentColor" stroke="none" />
      <path d="M7.5 31.5 H12.5" strokeWidth="1.4" opacity=".7" />

      {/* Ondas eletromagnéticas atravessando a parede até o aço */}
      <path d="M19.5 20.5 A5 5 0 0 1 19.5 27.5" strokeWidth="1.6" />
      <path d="M23.5 17.5 A9 9 0 0 1 23.5 30.5" strokeWidth="1.6" opacity=".8" />
      <path d="M28 14.5 A13 13 0 0 1 28 33.5" strokeWidth="1.5" strokeDasharray="2.5 2" opacity=".65" />

      {/* Parede em corte à direita */}
      <rect x="23" y="5" width="21" height="38" rx="1.5" fill="currentColor" fillOpacity=".1" />

      {/* Vergalhão (aço) atrás/dentro da parede */}
      <rect x="35" y="8" width="5" height="32" rx="1" fill="currentColor" fillOpacity=".28" />
      <path d="M35 12.5 L40 10.5 M35 17.5 L40 15.5 M35 22.5 L40 20.5 M35 27.5 L40 25.5 M35 32.5 L40 30.5 M35 37.5 L40 35.5" strokeWidth="1.2" opacity=".8" />
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

  // Borrifador aspergindo líquido (fenolftaleína) em um pilar
  carbonatacao: (
    <>
      {/* Frasco do borrifador */}
      <path d="M7 42 H15 A2 2 0 0 0 17 40 V29 C17 25 14 23 13.5 20 H8.5 C8 23 5 25 5 29 V40 A2 2 0 0 0 7 42 Z" fill="currentColor" fillOpacity=".15" />
      <path d="M5.5 34 H16.5" strokeWidth="1.3" opacity=".55" />
      {/* Pescoço, cabeça e bico */}
      <path d="M8.5 20 V16 H13.5 V20" />
      <path d="M8 16 V12.5 A1.5 1.5 0 0 1 9.5 11 H17 L20 12.5 V14.5 L17 16 Z" fill="currentColor" fillOpacity=".15" />
      {/* Gatilho */}
      <path d="M15 16 L17.5 21" strokeWidth="1.8" />

      {/* Jato / aspersão de líquido */}
      <path d="M22.5 11.5 L26 9.5 M28.5 8 L29.8 7.3" strokeWidth="1.6" />
      <path d="M23 13.5 L27 13.5 M29.5 13.5 L30.8 13.5" strokeWidth="1.6" />
      <path d="M22.5 15.5 L26 17.5 M28.5 19 L29.8 19.7" strokeWidth="1.6" />

      {/* Pilar com topo, base e zona reagida na face */}
      <path d="M31 6 H45 M31 42 H45" />
      <rect x="33" y="6" width="10" height="36" fill="currentColor" fillOpacity=".15" />
      <path d="M33 10.5 C36.5 11.5 36.5 17.5 33 18.5 Z" fill="currentColor" fillOpacity=".35" strokeWidth="1.3" />
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

  // Perfil de camadas com cortes laterais, placa metálica na superfície e haste de tração
  aderencia: (
    <>
      {/* Haste e pino de tração (similar ao esquema do módulo aderência) */}
      <path d="M24 7.5 V13" strokeWidth="2.2" />
      <circle cx="24" cy="5.5" r="2.4" fill="currentColor" />

      {/* Placa metálica sobre a superfície com hachura */}
      <rect x="16" y="13" width="16" height="5" fill="currentColor" fillOpacity=".3" />
      <path d="M20 13 V18 M24 13 V18 M28 13 V18" strokeWidth="1.2" opacity=".7" />

      {/* Camadas em perfil (acabamento → intermediárias → substrato) */}
      <rect x="5" y="18" width="38" height="5" fill="currentColor" fillOpacity=".08" />
      <rect x="5" y="23" width="38" height="6" fill="currentColor" fillOpacity=".18" />
      <rect x="5" y="29" width="38" height="6" fill="currentColor" fillOpacity=".1" />
      <rect x="5" y="35" width="38" height="8" fill="currentColor" fillOpacity=".24" />

      {/* Cortes laterais paralelos ao redor da placa nas camadas superiores */}
      <path d="M15.5 18 V29 M32.5 18 V29" strokeWidth="1.6" />
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
