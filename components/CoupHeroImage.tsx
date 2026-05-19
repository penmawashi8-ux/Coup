export default function CoupHeroImage() {
  return (
    <svg
      viewBox="0 0 360 200"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[280px] mx-auto block"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="coupBg" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#292524" />
          <stop offset="100%" stopColor="#0c0a09" />
        </radialGradient>
        <radialGradient id="coupGlow" cx="50%" cy="35%" r="50%">
          <stop offset="0%" stopColor="#d97706" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </radialGradient>
        <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* Background */}
      <rect width="360" height="200" rx="16" fill="url(#coupBg)" />
      <rect width="360" height="200" rx="16" fill="url(#coupGlow)" />
      <rect width="360" height="200" rx="16" fill="none" stroke="#78350f" strokeWidth="1.2" opacity="0.7" />

      {/* Fanned cards — pivot (180, 220), cards are 50×75 centered at (180, 157.5) */}

      {/* 将軍 — −28° */}
      <g transform="rotate(-28, 180, 220)" filter="url(#cardShadow)">
        <rect x="155" y="120" width="50" height="75" rx="5" fill="#1a1230" stroke="#4c1d95" strokeWidth="1.2" />
        <rect x="158" y="123" width="44" height="69" rx="3" fill="none" stroke="#4c1d95" strokeWidth="0.5" opacity="0.5" />
        <text x="180" y="163" textAnchor="middle" dominantBaseline="middle" fill="#7c3aed" fontSize="22" fontFamily="serif">★</text>
        <text x="180" y="185" textAnchor="middle" fill="#6d28d9" fontSize="7.5" fontFamily="sans-serif" letterSpacing="1">将軍</text>
      </g>

      {/* 刺客 — −14° */}
      <g transform="rotate(-14, 180, 220)" filter="url(#cardShadow)">
        <rect x="155" y="120" width="50" height="75" rx="5" fill="#111827" stroke="#374151" strokeWidth="1" />
        <rect x="158" y="123" width="44" height="69" rx="3" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.5" />
        <text x="180" y="163" textAnchor="middle" dominantBaseline="middle" fill="#6b7280" fontSize="22" fontFamily="serif">☠</text>
        <text x="180" y="185" textAnchor="middle" fill="#4b5563" fontSize="7.5" fontFamily="sans-serif" letterSpacing="1">刺客</text>
      </g>

      {/* 女王 — center (highlighted) */}
      <g transform="rotate(0, 180, 220)" filter="url(#cardShadow)">
        <rect x="155" y="118" width="50" height="75" rx="5" fill="#1c1208" stroke="#b45309" strokeWidth="2" />
        <rect x="158" y="121" width="44" height="69" rx="3" fill="none" stroke="#d97706" strokeWidth="0.5" opacity="0.4" />
        <text x="180" y="161" textAnchor="middle" dominantBaseline="middle" fill="#d97706" fontSize="24" fontFamily="serif">♛</text>
        <text x="180" y="183" textAnchor="middle" fill="#b45309" fontSize="7.5" fontFamily="sans-serif" letterSpacing="1">女王</text>
      </g>

      {/* 忍者 — +14° */}
      <g transform="rotate(14, 180, 220)" filter="url(#cardShadow)">
        <rect x="155" y="120" width="50" height="75" rx="5" fill="#1a110a" stroke="#92400e" strokeWidth="1" />
        <rect x="158" y="123" width="44" height="69" rx="3" fill="none" stroke="#92400e" strokeWidth="0.5" opacity="0.5" />
        <text x="180" y="163" textAnchor="middle" dominantBaseline="middle" fill="#b45309" fontSize="22" fontFamily="serif">✦</text>
        <text x="180" y="185" textAnchor="middle" fill="#92400e" fontSize="7.5" fontFamily="sans-serif" letterSpacing="1">忍者</text>
      </g>

      {/* 海賊 — +28° */}
      <g transform="rotate(28, 180, 220)" filter="url(#cardShadow)">
        <rect x="155" y="120" width="50" height="75" rx="5" fill="#0c1322" stroke="#1e3a5f" strokeWidth="1.2" />
        <rect x="158" y="123" width="44" height="69" rx="3" fill="none" stroke="#1e40af" strokeWidth="0.5" opacity="0.5" />
        <text x="180" y="163" textAnchor="middle" dominantBaseline="middle" fill="#1d4ed8" fontSize="22" fontFamily="serif">⚓</text>
        <text x="180" y="185" textAnchor="middle" fill="#1e40af" fontSize="7.5" fontFamily="sans-serif" letterSpacing="1">海賊</text>
      </g>

      {/* Crown */}
      <g transform="translate(180, 68)">
        {/* Crown body */}
        <path d="M-40,20 L-40,-4 L-25,-30 L0,-10 L25,-30 L40,-4 L40,20 Z" fill="#d97706" />
        {/* Crown shading */}
        <path d="M-40,20 L-40,-4 L-25,-30 L0,-10 L25,-30 L40,-4 L40,20 Z"
              fill="url(#coupGlow)" opacity="0.4" />
        {/* Crown outline */}
        <path d="M-40,20 L-40,-4 L-25,-30 L0,-10 L25,-30 L40,-4 L40,20 Z"
              fill="none" stroke="#fbbf24" strokeWidth="0.7" opacity="0.4" />
        {/* Base band */}
        <rect x="-40" y="12" width="80" height="10" rx="2" fill="#92400e" />
        <rect x="-40" y="12" width="80" height="4" rx="1" fill="#b45309" opacity="0.5" />
        {/* Top gem */}
        <ellipse cx="0" cy="-5" rx="5.5" ry="5.5" fill="#fbbf24" />
        <ellipse cx="-1.5" cy="-7" rx="2" ry="2" fill="white" opacity="0.45" />
        {/* Side gems */}
        <ellipse cx="-27" cy="3" rx="3.5" ry="3.5" fill="#f59e0b" />
        <ellipse cx="27" cy="3" rx="3.5" ry="3.5" fill="#f59e0b" />
        <ellipse cx="-28" cy="2" rx="1" ry="1" fill="white" opacity="0.3" />
        <ellipse cx="26" cy="2" rx="1" ry="1" fill="white" opacity="0.3" />
      </g>

      {/* Decorative horizontal rules flanking the crown */}
      <line x1="28" y1="98" x2="115" y2="98" stroke="#44403c" strokeWidth="0.5" opacity="0.5" />
      <line x1="245" y1="98" x2="332" y2="98" stroke="#44403c" strokeWidth="0.5" opacity="0.5" />
      <circle cx="120" cy="98" r="2" fill="#78350f" opacity="0.6" />
      <circle cx="240" cy="98" r="2" fill="#78350f" opacity="0.6" />

      {/* Corner ornaments */}
      <text x="20" y="32" fill="#78350f" fontSize="9" opacity="0.45" fontFamily="serif">✦</text>
      <text x="333" y="32" fill="#78350f" fontSize="9" opacity="0.45" fontFamily="serif">✦</text>
      <text x="20" y="192" fill="#78350f" fontSize="9" opacity="0.3" fontFamily="serif">✦</text>
      <text x="333" y="192" fill="#78350f" fontSize="9" opacity="0.3" fontFamily="serif">✦</text>
    </svg>
  );
}
