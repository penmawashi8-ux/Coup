'use client';
import type { Character } from '@/lib/types';

// --- Character SVG Icons ---

type IconProps = { size: number };

function IconShogun({ size }: IconProps) {
  // Five-pointed star — military rank
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="currentColor">
      <polygon points="20,2 25.1,14.9 38.5,14.9 28,23.1 32.4,36 20,28.5 7.6,36 12,23.1 1.5,14.9 14.9,14.9" />
      <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
    </svg>
  );
}

function IconAssassin({ size }: IconProps) {
  // Dagger — blade pointing down, ornate crossguard and pommel
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="currentColor">
      {/* Blade */}
      <path d="M20 3 L23.5 21 L20 23.5 L16.5 21 Z" />
      {/* Crossguard */}
      <path d="M11 22 Q15.5 20.5 16.5 21 L16.5 20.5 L20 23.5 L23.5 20.5 L23.5 21 Q24.5 20.5 29 22 L27.5 25.5 Q23.5 24.5 20 24.5 Q16.5 24.5 12.5 25.5 Z" />
      {/* Handle */}
      <rect x="17.5" y="24.5" width="5" height="8" rx="1.5" />
      {/* Pommel */}
      <ellipse cx="20" cy="34" rx="4.5" ry="2.5" />
    </svg>
  );
}

function IconPirate({ size }: IconProps) {
  // Anchor — ring, shaft, crossbar, flukes
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="20" cy="7" r="3.5" strokeWidth="2.5" />
      <line x1="20" y1="10.5" x2="20" y2="33" strokeWidth="2.5" />
      <line x1="10" y1="17" x2="30" y2="17" strokeWidth="2.5" />
      <path d="M8 28 Q9 36 20 36 Q31 36 32 28" strokeWidth="2.5" />
      <circle cx="8" cy="28" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="32" cy="28" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconNinja({ size }: IconProps) {
  // Four-bladed shuriken
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="currentColor">
      <polygon points="20,2 24,17 20,20 16,17" />
      <polygon points="38,20 23,24 20,20 23,16" />
      <polygon points="20,38 16,23 20,20 24,23" />
      <polygon points="2,20 17,16 20,20 17,24" />
      <circle cx="20" cy="20" r="4.5" />
    </svg>
  );
}

function IconQueen({ size }: IconProps) {
  // Crown with three peaks and gems
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="currentColor">
      <path d="M5 30 L6.5 17 L14 24 L20 7.5 L26 24 L33.5 17 L35 30 Z" />
      <rect x="5" y="28.5" width="30" height="6" rx="2.5" />
      <circle cx="6.5" cy="17" r="3.5" />
      <circle cx="20" cy="7.5" r="3.5" />
      <circle cx="33.5" cy="17" r="3.5" />
      {/* Gem highlights */}
      <circle cx="6.5" cy="16" r="1.2" fill="white" opacity="0.25" />
      <circle cx="20" cy="6.5" r="1.2" fill="white" opacity="0.25" />
      <circle cx="33.5" cy="16" r="1.2" fill="white" opacity="0.25" />
    </svg>
  );
}

const charIcons: Record<Character, (p: IconProps) => JSX.Element> = {
  将軍: IconShogun,
  刺客: IconAssassin,
  海賊: IconPirate,
  忍者: IconNinja,
  女王: IconQueen,
};

const charConfig: Record<Character, { grad: string; glow: string; border: string }> = {
  将軍: { grad: 'from-purple-900 to-purple-950', glow: 'rgba(147,51,234,0.55)',  border: 'rgba(147,51,234,0.55)' },
  刺客: { grad: 'from-zinc-700 to-zinc-950',    glow: 'rgba(161,161,170,0.45)', border: 'rgba(113,113,122,0.5)'  },
  海賊: { grad: 'from-blue-800 to-blue-950',    glow: 'rgba(59,130,246,0.55)',  border: 'rgba(59,130,246,0.55)'  },
  忍者: { grad: 'from-amber-700 to-amber-950',  glow: 'rgba(245,158,11,0.6)',   border: 'rgba(245,158,11,0.65)'  },
  女王: { grad: 'from-rose-800 to-rose-950',    glow: 'rgba(239,68,68,0.55)',   border: 'rgba(239,68,68,0.55)'   },
};

interface Props {
  character?: Character;
  faceDown?: boolean;
  small?: boolean;
  selected?: boolean;
  onClick?: () => void;
  dead?: boolean;
}

export default function CardDisplay({ character, faceDown, small, selected, onClick, dead }: Props) {
  const cfg = character ? charConfig[character] : null;
  const Icon = character ? charIcons[character] : null;
  const h = small ? 'h-20 w-14' : 'h-32 w-[88px]';
  const iconSize = small ? 30 : 46;

  if (faceDown) {
    return (
      <div
        className={`${h} rounded relative flex items-center justify-center cursor-default select-none`}
        style={{ background: 'linear-gradient(145deg, #1c1208 0%, #090604 100%)', border: '1px solid rgba(180,83,9,0.35)' }}
      >
        <span className="absolute top-[-1px] left-[-1px] w-2 h-2 border-t border-l border-amber-700/50 pointer-events-none" />
        <span className="absolute top-[-1px] right-[-1px] w-2 h-2 border-t border-r border-amber-700/50 pointer-events-none" />
        <span className="absolute bottom-[-1px] left-[-1px] w-2 h-2 border-b border-l border-amber-700/50 pointer-events-none" />
        <span className="absolute bottom-[-1px] right-[-1px] w-2 h-2 border-b border-r border-amber-700/50 pointer-events-none" />
        {/* Decorative diamond lattice */}
        <svg width={small ? 22 : 32} height={small ? 22 : 32} viewBox="0 0 28 28" fill="none">
          <path d="M14 2 L26 14 L14 26 L2 14 Z" stroke="rgba(180,83,9,0.35)" strokeWidth="1.2" />
          <path d="M14 7 L21 14 L14 21 L7 14 Z" stroke="rgba(180,83,9,0.28)" strokeWidth="1" />
          <circle cx="14" cy="14" r="2.5" fill="rgba(180,83,9,0.22)" />
          <circle cx="14" cy="2"  r="1.2" fill="rgba(180,83,9,0.18)" />
          <circle cx="14" cy="26" r="1.2" fill="rgba(180,83,9,0.18)" />
          <circle cx="2"  cy="14" r="1.2" fill="rgba(180,83,9,0.18)" />
          <circle cx="26" cy="14" r="1.2" fill="rgba(180,83,9,0.18)" />
        </svg>
      </div>
    );
  }

  if (!cfg || !character || !Icon) return null;

  return (
    <div
      onClick={onClick}
      className={`
        ${h} rounded relative bg-gradient-to-br ${cfg.grad}
        flex flex-col items-center justify-center gap-1
        cursor-${onClick ? 'pointer' : 'default'}
        select-none transition-all duration-150
        ${selected ? 'scale-105' : ''}
        ${dead ? 'opacity-35 grayscale' : ''}
        ${onClick && !dead ? 'hover:scale-105' : ''}
      `}
      style={{
        border: selected
          ? '2px solid rgba(251,191,36,0.9)'
          : dead
          ? '1px solid rgba(75,85,99,0.3)'
          : `1px solid ${cfg.border}`,
        boxShadow: !dead && !selected ? 'inset 0 0 20px rgba(0,0,0,0.5)' : undefined,
      }}
    >
      {!dead && (
        <>
          <span className="absolute top-[-1px] left-[-1px] w-1.5 h-1.5 border-t border-l pointer-events-none" style={{ borderColor: cfg.border }} />
          <span className="absolute top-[-1px] right-[-1px] w-1.5 h-1.5 border-t border-r pointer-events-none" style={{ borderColor: cfg.border }} />
          <span className="absolute bottom-[-1px] left-[-1px] w-1.5 h-1.5 border-b border-l pointer-events-none" style={{ borderColor: cfg.border }} />
          <span className="absolute bottom-[-1px] right-[-1px] w-1.5 h-1.5 border-b border-r pointer-events-none" style={{ borderColor: cfg.border }} />
        </>
      )}
      <div style={{ color: 'rgba(255,255,255,0.92)', filter: dead ? undefined : `drop-shadow(0 0 7px ${cfg.glow})` }}>
        <Icon size={iconSize} />
      </div>
      <span className={`font-bold ${small ? 'text-xs' : 'text-sm'} text-center px-1`} style={{ color: 'rgba(255,255,255,0.85)' }}>
        {character}
      </span>
    </div>
  );
}
