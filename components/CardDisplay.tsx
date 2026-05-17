'use client';
import type { Character } from '@/lib/types';

const charConfig: Record<Character, { color: string; symbol: string; desc: string }> = {
  Duke: { color: 'from-purple-700 to-purple-900', symbol: '★', desc: 'Tax / Block Foreign Aid' },
  Assassin: { color: 'from-gray-800 to-black', symbol: '☠', desc: 'Assassinate' },
  Captain: { color: 'from-blue-600 to-blue-900', symbol: '⚓', desc: 'Steal / Block Steal' },
  Ambassador: { color: 'from-amber-500 to-amber-700', symbol: '◆', desc: 'Exchange / Block Steal' },
  Contessa: { color: 'from-red-600 to-red-900', symbol: '♛', desc: 'Block Assassination' },
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
  const h = small ? 'h-20 w-14' : 'h-32 w-22 w-[88px]';

  if (faceDown) {
    return (
      <div
        className={`${h} rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 border-2 border-slate-500 flex items-center justify-center cursor-default select-none`}
      >
        <span className="text-slate-400 text-2xl">?</span>
      </div>
    );
  }

  if (!cfg || !character) return null;

  return (
    <div
      onClick={onClick}
      className={`
        ${h} rounded-lg bg-gradient-to-br ${cfg.color}
        border-2 ${selected ? 'border-yellow-400 scale-105' : dead ? 'border-red-500 opacity-50' : 'border-white/20'}
        flex flex-col items-center justify-center gap-1 cursor-${onClick ? 'pointer' : 'default'}
        select-none transition-all duration-150
        ${onClick && !dead ? 'hover:scale-105 hover:border-yellow-300' : ''}
      `}
    >
      <span className={`${small ? 'text-xl' : 'text-3xl'}`}>{cfg.symbol}</span>
      <span className={`text-white font-bold ${small ? 'text-xs' : 'text-sm'} text-center px-1`}>{character}</span>
      {!small && <span className="text-white/60 text-xs text-center px-1 leading-tight">{cfg.desc}</span>}
    </div>
  );
}
