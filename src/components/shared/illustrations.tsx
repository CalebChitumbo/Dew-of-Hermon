/**
 * In-app vector illustrations for premium empty states. Drawn in code (no photos)
 * with the warm cream / beige / brown / gold / soft-green palette so blank views
 * feel intentional and on-brand. Each scene is a self-contained, decorative SVG.
 */

const C = {
  cream: "#FFF8F0",
  paper: "#FCF6EC",
  beige: "#F0D0A8",
  sand: "#DEB887",
  clay: "#A0784A",
  clayDark: "#7D5A3C",
  ink: "#5B3A29",
  gold: "#C8963E",
  goldLight: "#E0B872",
  teal: "#4A9B8E",
  tealLight: "#6DB8AB",
  sage: "#8FAE8B",
  green: "#4FAE7E",
  blush: "#D69AAB",
  blushDeep: "#BC7488",
  peri: "#8A90C8",
};

function Sparkles() {
  return (
    <g opacity="0.7">
      <path d="M132 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill={C.goldLight} />
      <circle cx="26" cy="44" r="2.4" fill={C.tealLight} />
      <circle cx="140" cy="92" r="2.2" fill={C.blush} />
    </g>
  );
}

/** Camp scene — tent, pines, sun and birds. (ROPs Camp registrations) */
export function TentScene({ size = 168 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 168 168" fill="none" aria-hidden>
      <circle cx="128" cy="46" r="20" fill={C.gold} opacity="0.18" />
      <circle cx="128" cy="46" r="12" fill={C.goldLight} />
      <path
        d="M40 30 q6 -6 12 0 q6 -6 12 0"
        stroke={C.clay}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      {/* pines */}
      <g>
        <path d="M30 120 l12 -34 12 34z" fill={C.sage} />
        <path d="M33 120 l9 -22 9 22z" fill={C.teal} opacity="0.85" />
        <rect x="40" y="120" width="4" height="10" rx="1.5" fill={C.clayDark} />
      </g>
      <g>
        <path d="M120 122 l10 -28 10 28z" fill={C.teal} opacity="0.8" />
        <rect x="128" y="122" width="4" height="9" rx="1.5" fill={C.clayDark} />
      </g>
      {/* tent */}
      <path d="M58 124 L92 64 L126 124 Z" fill={C.gold} />
      <path d="M92 64 L126 124 L110 124 Z" fill={C.goldLight} opacity="0.85" />
      <path d="M92 124 L80 92 L92 64 L104 92 Z" fill={C.paper} />
      <path d="M92 64 L92 124" stroke={C.clayDark} strokeWidth="2" opacity="0.5" />
      {/* ground */}
      <path
        d="M16 124 q68 14 136 0"
        stroke={C.sand}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="84" cy="138" rx="60" ry="6" fill={C.beige} opacity="0.5" />
      <Sparkles />
    </svg>
  );
}

/** Media scene — a calendar, a clapperboard and a leaf. (Media Requests) */
export function MediaScene({ size = 168 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 168 168" fill="none" aria-hidden>
      {/* calendar */}
      <rect x="26" y="40" width="66" height="62" rx="12" fill={C.paper} stroke={C.beige} strokeWidth="2" />
      <rect x="26" y="40" width="66" height="18" rx="12" fill={C.peri} opacity="0.85" />
      <rect x="36" y="34" width="6" height="14" rx="3" fill={C.clayDark} />
      <rect x="76" y="34" width="6" height="14" rx="3" fill={C.clayDark} />
      <g fill={C.peri} opacity="0.45">
        <circle cx="40" cy="72" r="3.5" /><circle cx="56" cy="72" r="3.5" /><circle cx="72" cy="72" r="3.5" />
        <circle cx="40" cy="88" r="3.5" /><circle cx="56" cy="88" r="3.5" />
      </g>
      <circle cx="72" cy="88" r="5" fill={C.gold} />
      {/* clapperboard */}
      <g transform="rotate(-8 118 104)">
        <rect x="86" y="92" width="60" height="40" rx="8" fill={C.ink} />
        <path d="M86 100 h60 v-7 a8 8 0 0 0 -8 -8 h-44 a8 8 0 0 0 -8 8z" fill={C.clayDark} />
        <g fill={C.cream}>
          <path d="M92 84 l8 12 9 -2 -8 -12z" />
          <path d="M108 82 l8 12 9 -2 -8 -12z" />
          <path d="M124 80 l8 12 9 -2 -8 -12z" />
        </g>
        <circle cx="116" cy="116" r="9" fill="none" stroke={C.gold} strokeWidth="3" />
        <path d="M113 116 l2.5 2.5 4.5 -5" stroke={C.gold} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
      {/* leaf accent */}
      <g opacity="0.9">
        <path d="M120 60 q18 -16 30 -6 q-6 18 -30 6z" fill={C.sage} />
        <path d="M124 58 q14 -6 22 -2" stroke={C.green} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>
      <Sparkles />
    </svg>
  );
}

/** Food scene — a clipboard with crossed utensils, a cloud and a leaf. (Food Requests) */
export function FoodScene({ size = 168 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 168 168" fill="none" aria-hidden>
      {/* cloud */}
      <g fill={C.blush} opacity="0.35">
        <circle cx="40" cy="44" r="12" />
        <circle cx="56" cy="40" r="15" />
        <circle cx="72" cy="46" r="11" />
        <rect x="40" y="44" width="32" height="12" rx="6" />
      </g>
      {/* clipboard */}
      <rect x="52" y="48" width="64" height="80" rx="12" fill={C.paper} stroke={C.beige} strokeWidth="2" />
      <rect x="72" y="42" width="24" height="14" rx="6" fill={C.blushDeep} />
      <rect x="78" y="38" width="12" height="9" rx="3" fill={C.clayDark} />
      {/* plate */}
      <circle cx="84" cy="92" r="22" fill={C.cream} stroke={C.blush} strokeWidth="2" />
      <circle cx="84" cy="92" r="13" fill={C.blush} opacity="0.18" />
      {/* fork + knife */}
      <g stroke={C.clayDark} strokeWidth="2.6" strokeLinecap="round">
        <path d="M64 74 v36" />
        <path d="M61 74 v9 M67 74 v9" />
        <path d="M104 74 v36" />
      </g>
      <path d="M104 74 q-7 2 -7 12 q0 5 7 5z" fill={C.clayDark} />
      {/* leaf */}
      <g opacity="0.9">
        <path d="M112 116 q16 -4 22 8 q-14 8 -22 -8z" fill={C.sage} />
        <path d="M114 117 q10 0 16 6" stroke={C.green} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>
      <Sparkles />
    </svg>
  );
}

/** Transport scene — a clipboard, a little bus, a pen and a cup. (Transport Requests) */
export function TransportScene({ size = 168 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 168 168" fill="none" aria-hidden>
      {/* clipboard */}
      <rect x="40" y="36" width="60" height="78" rx="12" fill={C.paper} stroke={C.beige} strokeWidth="2" />
      <rect x="58" y="30" width="24" height="13" rx="6" fill={C.teal} />
      <rect x="64" y="26" width="12" height="9" rx="3" fill={C.clayDark} />
      <g stroke={C.sand} strokeWidth="3" strokeLinecap="round">
        <path d="M52 54 h36" /><path d="M52 66 h36" /><path d="M52 78 h24" />
      </g>
      {/* check ticks */}
      <g stroke={C.green} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9">
        <path d="M50 53 l2 2 3 -4" />
        <path d="M50 65 l2 2 3 -4" />
      </g>
      {/* bus */}
      <g>
        <rect x="92" y="84" width="56" height="34" rx="9" fill={C.gold} />
        <rect x="92" y="84" width="56" height="13" rx="9" fill={C.goldLight} />
        <rect x="98" y="100" width="13" height="11" rx="3" fill={C.cream} />
        <rect x="116" y="100" width="13" height="11" rx="3" fill={C.cream} />
        <rect x="133" y="100" width="9" height="11" rx="3" fill={C.cream} />
        <circle cx="106" cy="120" r="6" fill={C.ink} />
        <circle cx="134" cy="120" r="6" fill={C.ink} />
        <circle cx="106" cy="120" r="2.4" fill={C.cream} />
        <circle cx="134" cy="120" r="2.4" fill={C.cream} />
      </g>
      {/* pen */}
      <g transform="rotate(38 96 60)">
        <rect x="86" y="40" width="9" height="40" rx="3" fill={C.teal} />
        <path d="M86 80 l4.5 9 4.5 -9z" fill={C.clayDark} />
        <rect x="86" y="40" width="9" height="7" rx="3" fill={C.tealLight} />
      </g>
      {/* cup */}
      <g>
        <path d="M118 52 h20 l-2 18 a8 8 0 0 1 -16 0z" fill={C.cream} stroke={C.blush} strokeWidth="2" />
        <path d="M138 56 q7 1 6 8 q-1 6 -7 5" stroke={C.blush} strokeWidth="2" fill="none" />
        <path d="M124 46 q-2 -5 2 -8 M130 46 q-2 -5 2 -8" stroke={C.tealLight} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
      </g>
      <Sparkles />
    </svg>
  );
}

/** Approval scene — a stamped document under a soft arch. (Accounts Approvals) */
export function ApprovalScene({ size = 168 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 168 168" fill="none" aria-hidden>
      {/* arch */}
      <path
        d="M44 128 V86 a40 40 0 0 1 80 0 v42"
        fill="none"
        stroke={C.beige}
        strokeWidth="3"
        opacity="0.8"
      />
      {/* plant */}
      <g>
        <path d="M128 128 v-22" stroke={C.green} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M128 112 q12 -2 14 -14 q-12 0 -14 14z" fill={C.sage} />
        <path d="M128 118 q-11 -1 -13 -12 q11 0 13 12z" fill={C.teal} opacity="0.8" />
        <path d="M120 128 h16" stroke={C.clayDark} strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* document */}
      <rect x="56" y="58" width="56" height="68" rx="10" fill={C.paper} stroke={C.beige} strokeWidth="2" />
      <g stroke={C.sand} strokeWidth="3" strokeLinecap="round">
        <path d="M66 74 h36" /><path d="M66 86 h36" /><path d="M66 98 h22" />
      </g>
      {/* approval seal */}
      <circle cx="100" cy="112" r="15" fill={C.green} opacity="0.16" />
      <circle cx="100" cy="112" r="15" fill="none" stroke={C.green} strokeWidth="2.5" />
      <path
        d="M93 112 l5 5 9 -10"
        fill="none"
        stroke={C.green}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Sparkles />
    </svg>
  );
}

/** Fallback braai/grill illustration when the PNG asset is absent. (Fundraising) */
export function BraaiGrillArt({ size = 200 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 160" fill="none" aria-hidden>
      {/* flames */}
      <g>
        <path d="M100 30 q14 16 6 30 q-3 6 -10 6 q-12 -2 -10 -16 q1 -10 14 -20z" fill={C.gold} />
        <path d="M100 44 q7 8 3 16 q-2 4 -7 3 q-6 -2 -4 -10 q1 -5 8 -9z" fill={C.goldLight} />
        <path d="M82 40 q8 10 3 20 q-9 -2 -8 -12z" fill={C.gold} opacity="0.7" />
        <path d="M118 40 q8 10 3 20 q-9 -2 -8 -12z" fill={C.gold} opacity="0.7" />
      </g>
      {/* grill bowl */}
      <path d="M58 78 h84 a42 30 0 0 1 -84 0z" fill={C.ink} />
      <ellipse cx="100" cy="78" rx="42" ry="9" fill={C.clayDark} />
      <g stroke={C.sand} strokeWidth="3" strokeLinecap="round" opacity="0.85">
        <path d="M70 78 h60" /><path d="M74 84 h52" />
      </g>
      {/* food */}
      <circle cx="84" cy="78" r="5" fill={C.clay} />
      <circle cx="104" cy="80" r="5" fill={C.clay} />
      <rect x="112" y="74" width="14" height="7" rx="3.5" fill={C.clay} />
      {/* legs */}
      <g stroke={C.clayDark} strokeWidth="5" strokeLinecap="round">
        <path d="M70 104 l-12 28" /><path d="M130 104 l12 28" /><path d="M100 108 v26" />
      </g>
      {/* ground */}
      <ellipse cx="100" cy="140" rx="70" ry="7" fill={C.beige} opacity="0.5" />
    </svg>
  );
}
