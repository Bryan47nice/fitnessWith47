import { useId } from 'react';

export default function BadgeLogo({ size = 200 }) {
  const uid = useId().replace(/:/g, '');
  const ringId = `blRing${uid}`;
  const barbId = `blBarb${uid}`;
  const numId = `blNum${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <defs>
        <linearGradient id={ringId} x1="36" y1="36" x2="476" y2="476" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff6a00" />
          <stop offset="100%" stopColor="#ffd700" />
        </linearGradient>
        <linearGradient id={barbId} x1="56" y1="220" x2="456" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#ff8800" />
          <stop offset="100%" stopColor="#ff4500" />
        </linearGradient>
        <linearGradient id={numId} x1="256" y1="120" x2="256" y2="330" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="100%" stopColor="#ff6a00" />
        </linearGradient>
      </defs>

      {/* Dark circle background */}
      <circle cx="256" cy="256" r="248" fill="#0a0a0f" />

      {/* Orange gradient ring */}
      <circle cx="256" cy="256" r="220" fill="none" stroke={`url(#${ringId})`} strokeWidth="8" />

      {/* "47" — huge, fills most of the badge */}
      <text
        x="256"
        y="330"
        fontFamily="'Barlow Condensed', 'Arial Black', sans-serif"
        fontSize="290"
        fontWeight="900"
        textAnchor="middle"
        fill={`url(#${numId})`}
      >47</text>

      {/* Barbell — rotated -30° overlaid on top of "47" */}
      <g transform="rotate(-30, 256, 220)">
        {/* Horizontal bar */}
        <rect x="130" y="209" width="252" height="24" rx="5"
          fill={`url(#${barbId})`} stroke="#0a0a0f" strokeWidth="4" />
        {/* Left big plate */}
        <rect x="86" y="165" width="44" height="110" rx="7"
          fill={`url(#${barbId})`} stroke="#0a0a0f" strokeWidth="4" />
        {/* Right big plate */}
        <rect x="382" y="165" width="44" height="110" rx="7"
          fill={`url(#${barbId})`} stroke="#0a0a0f" strokeWidth="4" />
        {/* Left small plate */}
        <rect x="56" y="176" width="30" height="88" rx="5"
          fill={`url(#${barbId})`} stroke="#0a0a0f" strokeWidth="4" />
        {/* Right small plate */}
        <rect x="426" y="176" width="30" height="88" rx="5"
          fill={`url(#${barbId})`} stroke="#0a0a0f" strokeWidth="4" />
      </g>

      {/* "FITNESS" */}
      <text
        x="256"
        y="462"
        fontFamily="'Barlow Condensed', Arial, sans-serif"
        fontSize="44"
        fontWeight="900"
        textAnchor="middle"
        letterSpacing="10"
        fill="#777"
      >FITNESS</text>
    </svg>
  );
}
