'use client';
import type { Character } from '@/lib/types';

const charConfig: Record<Character, { grad: string; symbol: string; desc: string; glow: string; border: string }> = {
  将軍: { grad: 'from-purple-900 to-purple-950', symbol: '★', desc: '徴収 / 外国援助ブロック', glow: 'rgba(147,51,234,0.5)', border: 'rgba(147,51,234,0.55)' },
  刺客: { grad: 'from-zinc-700 to-zinc-950',    symbol: '☠', desc: '暗殺',                   glow: 'rgba(161,161,170,0.4)', border: 'rgba(113,113,122,0.5)' },
  海賊: { grad: 'from-blue-800 to-blue-950',    symbol: '⚓', desc: '強奪 / 強奪ブロック',   glow: 'rgba(59,130,246,0.5)',  border: 'rgba(59,130,246,0.55)' },
  忍者: { grad: 'from-amber-700 to-amber-950',  symbol: '✦', desc: '探索 / 強奪ブロック',   glow: 'rgba(245,158,11,0.55)', border: 'rgba(245,158,11,0.65)' },
  女王: { grad: 'from-rose-800 to-rose-950',    symbol: '♛', desc: '暗殺ブロック',           glow: 'rgba(239,68,68,0.5)',   border: 'rgba(239,68,68,0.55)' },
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
  const h = small ? 'h-20 w-14' : 'h-32 w-[88px]';

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
        <span style={{ color: 'rgba(180,83,9,0.35)', fontSize: small ? '1rem' : '1.4rem' }}>◆</span>
      </div>
    );
  }

  if (!cfg || !character) return null;

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
        boxShadow: !dead && !selected ? `inset 0 0 20px rgba(0,0,0,0.5)` : undefined,
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
      <span
        className={small ? 'text-xl' : 'text-3xl'}
        style={{ filter: dead ? undefined : `drop-shadow(0 0 5px ${cfg.glow})` }}
      >
        {cfg.symbol}
      </span>
      <span className={`text-white font-bold ${small ? 'text-xs' : 'text-sm'} text-center px-1`}>{character}</span>
      {!small && <span className="text-white/45 text-xs text-center px-1 leading-tight">{cfg.desc}</span>}
    </div>
  );
}
