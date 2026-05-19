export default function CoupHeroImage() {
  const cx = 110;
  const cy = 150;

  const shortRays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 15) * Math.PI / 180;
    return { x1: cx + 38 * Math.cos(a), y1: cy + 38 * Math.sin(a), x2: cx + 60 * Math.cos(a), y2: cy + 60 * Math.sin(a) };
  });

  const longRays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30) * Math.PI / 180;
    return { x1: cx + 38 * Math.cos(a), y1: cy + 38 * Math.sin(a), x2: cx + 76 * Math.cos(a), y2: cy + 76 * Math.sin(a) };
  });

  return (
    <svg
      viewBox="0 0 220 300"
      xmlns="http://www.w3.org/2000/svg"
      className="w-44 mx-auto block"
      style={{ filter: 'drop-shadow(0 16px 48px rgba(180,83,9,0.55)) drop-shadow(0 0 8px rgba(217,119,6,0.2))' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hBorderGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
          <stop offset="30%" stopColor="#d97706" stopOpacity="0.85" />
          <stop offset="70%" stopColor="#92400e" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="hCardBg" cx="50%" cy="20%" r="90%">
          <stop offset="0%" stopColor="#1e1208" />
          <stop offset="100%" stopColor="#060402" />
        </radialGradient>
        <radialGradient id="hEyeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d97706" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </radialGradient>
        <filter id="hGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="hStrongGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Shadow */}
      <rect x="15" y="16" width="200" height="276" rx="12" fill="#000" opacity="0.55" />

      {/* Card body */}
      <rect x="10" y="10" width="200" height="276" rx="12" fill="url(#hCardBg)" />

      {/* Outer gold border */}
      <rect x="10" y="10" width="200" height="276" rx="12" fill="none"
        stroke="url(#hBorderGold)" strokeWidth="1.8" />

      {/* Inner border */}
      <rect x="19" y="19" width="182" height="258" rx="8" fill="none"
        stroke="#78350f" strokeWidth="0.8" opacity="0.55" />

      {/* Second inner border */}
      <rect x="25" y="25" width="170" height="246" rx="5" fill="none"
        stroke="#451a03" strokeWidth="0.5" opacity="0.35" />

      {/* Corner ornaments — TL */}
      <path d="M19,40 L19,21 L40,21" fill="none" stroke="#d97706" strokeWidth="1.2" opacity="0.8" />
      <path d="M23,34 L23,26 L32,26" fill="none" stroke="#b45309" strokeWidth="0.6" opacity="0.5" />
      {/* TR */}
      <path d="M201,40 L201,21 L180,21" fill="none" stroke="#d97706" strokeWidth="1.2" opacity="0.8" />
      <path d="M197,34 L197,26 L188,26" fill="none" stroke="#b45309" strokeWidth="0.6" opacity="0.5" />
      {/* BL */}
      <path d="M19,256 L19,275 L40,275" fill="none" stroke="#d97706" strokeWidth="1.2" opacity="0.8" />
      <path d="M23,262 L23,270 L32,270" fill="none" stroke="#b45309" strokeWidth="0.6" opacity="0.5" />
      {/* BR */}
      <path d="M201,256 L201,275 L180,275" fill="none" stroke="#d97706" strokeWidth="1.2" opacity="0.8" />
      <path d="M197,262 L197,270 L188,270" fill="none" stroke="#b45309" strokeWidth="0.6" opacity="0.5" />

      {/* Eye glow backdrop */}
      <circle cx={cx} cy={cy} r="88" fill="url(#hEyeGlow)" />

      {/* Long starburst */}
      {longRays.map((r, i) => (
        <line key={`lr${i}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
          stroke="#b45309" strokeWidth="1" opacity="0.5" />
      ))}
      {/* Short rays */}
      {shortRays.map((r, i) => (
        <line key={`sr${i}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
          stroke="#92400e" strokeWidth="0.7" opacity="0.35" />
      ))}

      {/* Outer dashed ring */}
      <circle cx={cx} cy={cy} r="80" fill="none" stroke="#78350f" strokeWidth="0.6"
        strokeDasharray="6 5" opacity="0.35" />
      {/* Mid ring */}
      <circle cx={cx} cy={cy} r="64" fill="none" stroke="#92400e" strokeWidth="0.7" opacity="0.4" />
      {/* Main decorative ring */}
      <circle cx={cx} cy={cy} r="46" fill="none" stroke="#d97706" strokeWidth="1.1" opacity="0.75"
        filter="url(#hGlow)" />
      {/* Inner circle base */}
      <circle cx={cx} cy={cy} r="32" fill="#0a0703" />
      <circle cx={cx} cy={cy} r="32" fill="none" stroke="#d97706" strokeWidth="1" opacity="0.85" />

      {/* Geometric marks on main ring */}
      {[0, 90, 180, 270].map((deg, i) => {
        const a = deg * Math.PI / 180;
        return (
          <circle key={i} cx={cx + 46 * Math.cos(a)} cy={cy + 46 * Math.sin(a)}
            r="2.5" fill="#d97706" opacity="0.8" />
        );
      })}

      {/* Eye shape */}
      <ellipse cx={cx} cy={cy} rx="24" ry="14" fill="#100b05" />
      {/* Top lid */}
      <path d={`M${cx - 24},${cy} Q${cx},${cy - 20} ${cx + 24},${cy}`}
        fill="none" stroke="#d97706" strokeWidth="1" opacity="0.9" />
      {/* Bottom lid */}
      <path d={`M${cx - 24},${cy} Q${cx},${cy + 15} ${cx + 24},${cy}`}
        fill="none" stroke="#d97706" strokeWidth="1" opacity="0.9" />

      {/* Iris */}
      <circle cx={cx} cy={cy} r="11" fill="#7c2d0a" filter="url(#hStrongGlow)" opacity="0.9" />
      <circle cx={cx} cy={cy} r="9" fill="#c2410c" opacity="0.7" />
      {/* Pupil */}
      <circle cx={cx} cy={cy} r="5.5" fill="#050302" />
      {/* Eye highlights */}
      <circle cx={cx - 3} cy={cy - 3} r="2" fill="white" opacity="0.35" />
      <circle cx={cx + 4} cy={cy + 2} r="1" fill="white" opacity="0.15" />

      {/* Sparkle dots */}
      <circle cx="42" cy="52" r="1.8" fill="#fbbf24" opacity="0.65" />
      <path d="M42,47 L42,57 M37,52 L47,52" stroke="#fbbf24" strokeWidth="0.7" opacity="0.45" />

      <circle cx="180" cy="46" r="1.2" fill="#fbbf24" opacity="0.5" />
      <path d="M180,42 L180,50 M176,46 L184,46" stroke="#fbbf24" strokeWidth="0.6" opacity="0.35" />

      <circle cx="32" cy="175" r="1.2" fill="#fbbf24" opacity="0.4" />
      <circle cx="192" cy="210" r="1" fill="#fbbf24" opacity="0.35" />
      <circle cx="168" cy="252" r="1.5" fill="#fbbf24" opacity="0.5" />
      <path d="M168,248 L168,256 M164,252 L172,252" stroke="#fbbf24" strokeWidth="0.6" opacity="0.35" />
    </svg>
  );
}
