/**
 * Widget SVG Constants
 *
 * Inline SVG string assets used by GpsCockpitWidget and GpsCockpitCompactWidget.
 * Extracted from GpsCockpitWidget.tsx to keep the component files focused on layout.
 *
 * All SVGs are self-contained strings — no external files or network fetches.
 */

// ─── Car Silhouette SVG (white hatchback side-profile) ───────────────────────
export const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 56" width="90" height="42">
  <path d="M8 36 Q8 28 16 26 L30 16 Q38 10 52 10 L72 10 Q84 10 90 16 L102 26 Q112 28 114 36 L114 40 Q114 43 111 43 L100 43 Q98 50 90 50 Q82 50 80 43 L40 43 Q38 50 30 50 Q22 50 20 43 L9 43 Q8 43 8 40 Z" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.2"/>
  <path d="M54 12 L36 26 L82 26 L76 12 Z" fill="#7DD3FC" fill-opacity="0.55" stroke="#94A3B8" stroke-width="0.8"/>
  <path d="M92 16 L84 26 L102 26 L98 18 Z" fill="#7DD3FC" fill-opacity="0.45" stroke="#94A3B8" stroke-width="0.8"/>
  <circle cx="90" cy="46" r="9" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
  <circle cx="90" cy="46" r="4.5" fill="#334155"/>
  <circle cx="30" cy="46" r="9" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
  <circle cx="30" cy="46" r="4.5" fill="#334155"/>
  <rect x="108" y="32" width="6" height="5" rx="2" fill="#FDE68A" fill-opacity="0.9"/>
  <rect x="8" y="32" width="5" height="5" rx="2" fill="#FCA5A5" fill-opacity="0.8"/>
  <path d="M36 26 L36 40" stroke="#94A3B8" stroke-width="0.7" stroke-dasharray="2,2"/>
  <path d="M64 26 L64 40" stroke="#94A3B8" stroke-width="0.7" stroke-dasharray="2,2"/>
  <path d="M84 26 L84 40" stroke="#94A3B8" stroke-width="0.7" stroke-dasharray="2,2"/>
</svg>`;

// ─── Two-Wheeler Silhouette SVG (Motorcycle / Scooter side-profile) ───────────
export const BIKE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 75" width="90" height="42">
  <defs>
    <linearGradient id="bikeRed" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FDA4AF"/>
      <stop offset="50%" stop-color="#E11D48"/>
      <stop offset="100%" stop-color="#881337"/>
    </linearGradient>

    <linearGradient id="bikeGold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#92400E"/>
      <stop offset="50%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>

    <linearGradient id="bikeBeam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity=".25"/>
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Wheels and tires -->
  <g fill="#0B0F19" stroke="#475569" stroke-width="1.5">
    <circle cx="34" cy="51" r="15"/>
    <circle cx="125" cy="51" r="15"/>
  </g>

  <!-- Alloy rims -->
  <g fill="#1E293B" stroke="#FBBF24" stroke-width="1.2">
    <circle cx="34" cy="51" r="11"/>
    <circle cx="125" cy="51" r="11"/>
  </g>

  <!-- Alloy spokes -->
  <g stroke="#FBBF24" stroke-width=".8">
    <path d="M34 51L44 51 M34 51L41.1 43.9
             M34 51L34 41 M34 51L26.9 43.9
             M34 51L24 51 M34 51L26.9 58.1
             M34 51L34 61 M34 51L41.1 58.1"/>
    <path d="M125 51L135 51 M125 51L132.1 43.9
             M125 51L125 41 M125 51L117.9 43.9
             M125 51L115 51 M125 51L117.9 58.1
             M125 51L125 61 M125 51L132.1 58.1"/>
  </g>

  <!-- Wheel hubs -->
  <g fill="#334155" stroke="#CBD5E1" stroke-width=".8">
    <circle cx="34" cy="51" r="4"/>
    <circle cx="125" cy="51" r="4"/>
    <circle cx="34" cy="51" r="1.5" fill="#0F172A"/>
    <circle cx="125" cy="51" r="1.5" fill="#0F172A"/>
  </g>

  <!-- Rear swingarm and frame -->
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M34 50L57 44L77 48L54 53Z"
          fill="#1E293B" stroke="#64748B" stroke-width="1.2"/>
    <path d="M52 47L67 33L90 35L76 48"
          stroke="#64748B" stroke-width="2"/>
    <path d="M55 46L65 34"
          stroke="url(#bikeGold)" stroke-width="3"/>
    <path d="M62 35L70 45L81 43L90 35"
          stroke="#475569" stroke-width="1.6"/>
  </g>

  <!-- Exhaust -->
  <path d="M49 51L31 43L25 37L28 35L38 42L52 47Z"
        fill="#0F172A" stroke="#94A3B8" stroke-width="1"/>
  <path d="M25 37L28 35"
        stroke="#FB7185" stroke-width="1.5"/>

  <!-- Fuel tank and bodywork -->
  <path d="M99 24Q87 19 76 25L56 31L43 29L39 33
           Q60 40 77 36L94 34L105 29Z"
        fill="url(#bikeRed)" stroke="#881337" stroke-width=".8"/>

  <!-- Tank highlight -->
  <path d="M97 25Q85 22 76 27L59 32"
        fill="none" stroke="#FDA4AF" stroke-width="1.2"
        stroke-linecap="round"/>

  <!-- Rear seat and tail -->
  <path d="M56 29Q47 28 39 29L22 24L18 25
           L38 33L59 34L69 31Z"
        fill="#090D16" stroke="#334155" stroke-width=".8"/>

  <path d="M22 24L18 25L25 29L32 30L28 26Z"
        fill="#E11D48"/>

  <!-- Front fairing -->
  <path d="M96 31L87 41L78 39L87 32Z"
        fill="#1E293B" stroke="#64748B" stroke-width=".8"/>
  <path d="M88 34L82 39"
        stroke="#FB7185" stroke-width="1.2"/>

  <!-- Engine block -->
  <path d="M70 37L85 36L88 44L81 49L68 47Z"
        fill="#1E293B" stroke="#64748B" stroke-width="1"/>

  <!-- Engine cooling fins -->
  <g stroke="#94A3B8" stroke-width=".8">
    <path d="M71 39H84"/>
    <path d="M70 42H83"/>
    <path d="M70 45H81"/>
  </g>

  <!-- Crankcase -->
  <circle cx="75" cy="47" r="4"
          fill="#334155" stroke="#94A3B8" stroke-width="1"/>
  <circle cx="75" cy="47" r="1.5" fill="#0F172A"/>

  <!-- Front suspension -->
  <path d="M125 51L105 18"
        stroke="url(#bikeGold)" stroke-width="3"
        stroke-linecap="round" fill="none"/>

  <path d="M125 51L116 34"
        stroke="#CBD5E1" stroke-width="2"
        stroke-linecap="round" fill="none"/>

  <!-- Handlebars -->
  <path d="M105 18L100 14L94 15"
        stroke="#CBD5E1" stroke-width="2"
        stroke-linecap="round" fill="none"/>

  <path d="M100 14L94 15"
        stroke="#06B6D4" stroke-width="2.5"
        stroke-linecap="round" fill="none"/>

  <!-- Headlight housing -->
  <path d="M106 22L112 24L108 28L101 26Z"
        fill="#0F172A" stroke="#64748B" stroke-width=".8"/>

  <!-- LED headlight -->
  <path d="M109 24L116 26L110 28Z"
        fill="#67E8F9"/>

  <!-- Headlight beam -->
  <path d="M115 25L159 17L159 37L115 28Z"
        fill="url(#bikeBeam)"/>

  <!-- Front mudguard -->
  <path d="M113 43Q120 34 137 40"
        fill="none" stroke="#FB7185"
        stroke-width="2.2" stroke-linecap="round"/>

  <!-- Rear brake detail -->
  <circle cx="34" cy="51" r="7"
          fill="none" stroke="#94A3B8" stroke-width=".8"
          stroke-dasharray="3 2"/>

  <!-- Front brake detail -->
  <circle cx="125" cy="51" r="7"
          fill="none" stroke="#94A3B8" stroke-width=".8"
          stroke-dasharray="3 2"/>

  <!-- Rear monoshock -->
  <path d="M48 44L57 37"
        stroke="#FBBF24" stroke-width="2.4"
        stroke-linecap="round" fill="none"/>

  <path d="M48 44L57 37"
        stroke="#0F172A" stroke-width=".8"
        stroke-dasharray="1.5 1.5" fill="none"/>
</svg>
`;

// ─── Telemetry Icon SVGs ─────────────────────────────────────────────────────
export const SPEEDO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none">
  <circle cx="12" cy="13" r="9" stroke="#10B981" stroke-width="1.8"/>
  <path d="M12 13 L7 8" stroke="#10B981" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M5 13 Q5 8 8 6" stroke="#10B981" stroke-width="1.4" stroke-linecap="round" fill="none"/>
  <path d="M19 13 Q19 8 16 6" stroke="#10B981" stroke-width="1.4" stroke-linecap="round" fill="none"/>
  <circle cx="12" cy="13" r="1.5" fill="#10B981"/>
</svg>`;

export const ROAD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none">
  <path d="M4 20 L12 4 L20 20" stroke="#06B6D4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M7.5 13 L16.5 13" stroke="#06B6D4" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M5.5 17.5 L18.5 17.5" stroke="#06B6D4" stroke-width="1.4" stroke-linecap="round"/>
  <line x1="12" y1="4" x2="12" y2="20" stroke="#06B6D4" stroke-width="1.2" stroke-dasharray="2,2.5" stroke-linecap="round"/>
</svg>`;

export const CLOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none">
  <circle cx="12" cy="12" r="9" stroke="#94A3B8" stroke-width="1.8"/>
  <path d="M12 7 L12 12 L15.5 14.5" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export const PAUSE_CLOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none">
  <circle cx="12" cy="12" r="9" stroke="#F59E0B" stroke-width="1.8"/>
  <path d="M12 7 L12 12 L15.5 14.5" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// ─── CNG Tank SVG ─────────────────────────────────────────────────────────────
export const CNG_TANK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 26" width="18" height="24">
  <rect x="7" y="0.5" width="6" height="2.5" rx="1" fill="#D97706" stroke="#B45309" stroke-width="0.5"/>
  <rect x="8.5" y="3" width="3" height="2" fill="#475569"/>
  <rect x="3" y="5" width="14" height="20.5" rx="5.5" fill="#059669"/>
  <rect x="4.5" y="6.5" width="2" height="17.5" rx="1" fill="#FFFFFF" fill-opacity="0.35"/>
  <line x1="3" y1="9.5" x2="17" y2="9.5" stroke="#000000" stroke-opacity="0.15" stroke-width="0.8"/>
  <text x="10" y="17.5" font-size="5" font-family="sans-serif" font-weight="900" fill="#FFFFFF" text-anchor="middle">CNG</text>
</svg>`;
