interface PoseSVGProps {
  width?: number;
  height?: number;
  color?: string;
}

export function FrontPoseSVG({ width = 120, height = 240, color = "rgba(255,255,255,0.15)" }: PoseSVGProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="100" cy="32" rx="22" ry="28" stroke={color} strokeWidth="2" />
      {/* Neck */}
      <path d="M90 58 L90 72 L110 72 L110 58" stroke={color} strokeWidth="2" />
      {/* Trapezius */}
      <path d="M90 68 Q70 72 55 82" stroke={color} strokeWidth="2" />
      <path d="M110 68 Q130 72 145 82" stroke={color} strokeWidth="2" />
      {/* Shoulders */}
      <path d="M55 82 Q48 88 44 100" stroke={color} strokeWidth="2" />
      <path d="M145 82 Q152 88 156 100" stroke={color} strokeWidth="2" />
      {/* Deltoids */}
      <ellipse cx="48" cy="95" rx="12" ry="16" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
      <ellipse cx="152" cy="95" rx="12" ry="16" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
      {/* Chest / pecs */}
      <path d="M70 82 Q80 90 100 92 Q120 90 130 82" stroke={color} strokeWidth="1.5" />
      <path d="M72 88 Q86 98 100 96" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M128 88 Q114 98 100 96" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Torso outline */}
      <path d="M66 82 L62 130 L68 172 L80 185" stroke={color} strokeWidth="2" />
      <path d="M134 82 L138 130 L132 172 L120 185" stroke={color} strokeWidth="2" />
      {/* Abs */}
      <line x1="100" y1="100" x2="100" y2="175" stroke={color} strokeWidth="1" strokeDasharray="3 3" />
      <line x1="82" y1="110" x2="118" y2="110" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
      <line x1="84" y1="126" x2="116" y2="126" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
      <line x1="85" y1="142" x2="115" y2="142" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
      <line x1="86" y1="158" x2="114" y2="158" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
      {/* Arms — slightly away from body */}
      <path d="M44 100 L36 140 L32 170 L30 190" stroke={color} strokeWidth="2" />
      <path d="M156 100 L164 140 L168 170 L170 190" stroke={color} strokeWidth="2" />
      {/* Bicep contours */}
      <path d="M40 105 Q34 125 36 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M160 105 Q166 125 164 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Forearms */}
      <path d="M36 140 Q30 155 30 170" stroke={color} strokeWidth="1.5" />
      <path d="M164 140 Q170 155 170 170" stroke={color} strokeWidth="1.5" />
      {/* Hands */}
      <ellipse cx="29" cy="195" rx="6" ry="10" stroke={color} strokeWidth="1.5" />
      <ellipse cx="171" cy="195" rx="6" ry="10" stroke={color} strokeWidth="1.5" />
      {/* Hips */}
      <path d="M80 185 Q100 195 120 185" stroke={color} strokeWidth="2" />
      {/* Quads */}
      <path d="M80 185 L74 240 L72 280 L78 290" stroke={color} strokeWidth="2" />
      <path d="M120 185 L126 240 L128 280 L122 290" stroke={color} strokeWidth="2" />
      {/* Inner thigh */}
      <path d="M92 195 L90 240 L88 280" stroke={color} strokeWidth="1.5" />
      <path d="M108 195 L110 240 L112 280" stroke={color} strokeWidth="1.5" />
      {/* Quad muscle lines */}
      <path d="M82 210 Q78 235 76 260" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M118 210 Q122 235 124 260" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Knees */}
      <ellipse cx="83" cy="288" rx="10" ry="8" stroke={color} strokeWidth="1.5" />
      <ellipse cx="117" cy="288" rx="10" ry="8" stroke={color} strokeWidth="1.5" />
      {/* Shins */}
      <path d="M78 296 L76 340 L74 370" stroke={color} strokeWidth="2" />
      <path d="M88 296 L88 340 L86 370" stroke={color} strokeWidth="1.5" />
      <path d="M122 296 L124 340 L126 370" stroke={color} strokeWidth="2" />
      <path d="M112 296 L112 340 L114 370" stroke={color} strokeWidth="1.5" />
      {/* Feet */}
      <path d="M70 370 L66 385 L86 390 L90 375" stroke={color} strokeWidth="2" />
      <path d="M130 370 L134 385 L114 390 L110 375" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function SidePoseSVG({ width = 120, height = 240, color = "rgba(255,255,255,0.15)" }: PoseSVGProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head — facing right */}
      <ellipse cx="115" cy="32" rx="20" ry="26" stroke={color} strokeWidth="2" />
      {/* Jaw line */}
      <path d="M128 42 Q130 52 122 58" stroke={color} strokeWidth="1.5" />
      {/* Neck */}
      <path d="M108 56 L106 72" stroke={color} strokeWidth="2" />
      <path d="M122 56 L120 72" stroke={color} strokeWidth="2" />
      {/* Upper back / traps */}
      <path d="M106 72 Q100 78 96 90 L92 120" stroke={color} strokeWidth="2" />
      {/* Chest front */}
      <path d="M120 72 Q132 82 134 100 L130 120" stroke={color} strokeWidth="2" />
      {/* Chest contour */}
      <path d="M125 80 Q134 92 132 105" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Shoulder / deltoid */}
      <path d="M96 85 Q88 82 84 90 Q82 100 86 110" stroke={color} strokeWidth="2" />
      <ellipse cx="88" cy="96" rx="10" ry="12" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Back curve — spine to glutes */}
      <path d="M92 120 Q88 150 90 170 Q92 180 96 190" stroke={color} strokeWidth="2" />
      {/* Front torso — chest to hip */}
      <path d="M130 120 Q128 145 126 165 Q122 178 118 190" stroke={color} strokeWidth="2" />
      {/* Ab contour */}
      <path d="M128 125 Q126 145 124 160" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Arm — hanging at side */}
      <path d="M86 110 L82 145 L80 170 L78 190" stroke={color} strokeWidth="2" />
      <path d="M92 110 L88 145 L86 170 L84 190" stroke={color} strokeWidth="1.5" />
      {/* Tricep contour */}
      <path d="M84 115 Q80 132 82 145" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Hand */}
      <ellipse cx="81" cy="196" rx="6" ry="9" stroke={color} strokeWidth="1.5" />
      {/* Glutes */}
      <path d="M96 190 Q90 195 92 208 Q96 215 104 210" stroke={color} strokeWidth="2" />
      <path d="M96 198 Q92 202 94 208" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      {/* Hip front */}
      <path d="M118 190 Q124 200 120 210 Q116 215 104 210" stroke={color} strokeWidth="2" />
      {/* Thigh — front (quad) */}
      <path d="M120 210 L124 250 L122 280 L118 290" stroke={color} strokeWidth="2" />
      {/* Thigh — back (hamstring) */}
      <path d="M96 210 L94 250 L96 280 L100 290" stroke={color} strokeWidth="2" />
      {/* Quad contour */}
      <path d="M118 215 Q124 240 122 265" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Hamstring contour */}
      <path d="M98 215 Q94 240 96 265" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Knee */}
      <ellipse cx="109" cy="288" rx="12" ry="8" stroke={color} strokeWidth="1.5" />
      {/* Calf */}
      <path d="M100 296 L98 330 Q100 350 104 370" stroke={color} strokeWidth="2" />
      <path d="M118 296 L120 325 Q118 345 114 370" stroke={color} strokeWidth="2" />
      {/* Calf muscle */}
      <path d="M102 300 Q96 318 100 340" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Foot — facing right */}
      <path d="M104 370 L100 380 L90 386 L130 390 L120 375" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function BackPoseSVG({ width = 120, height = 240, color = "rgba(255,255,255,0.15)" }: PoseSVGProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="100" cy="32" rx="22" ry="28" stroke={color} strokeWidth="2" />
      {/* Neck */}
      <path d="M90 58 L90 72 L110 72 L110 58" stroke={color} strokeWidth="2" />
      {/* Trapezius */}
      <path d="M90 65 Q70 70 55 82" stroke={color} strokeWidth="2" />
      <path d="M110 65 Q130 70 145 82" stroke={color} strokeWidth="2" />
      <path d="M92 68 Q85 74 78 80" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M108 68 Q115 74 122 80" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Shoulders */}
      <path d="M55 82 Q48 88 44 100" stroke={color} strokeWidth="2" />
      <path d="M145 82 Q152 88 156 100" stroke={color} strokeWidth="2" />
      {/* Rear deltoids */}
      <ellipse cx="48" cy="95" rx="12" ry="16" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
      <ellipse cx="152" cy="95" rx="12" ry="16" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
      {/* Lats — V-taper */}
      <path d="M66 82 L60 110 L62 140 L68 172 L80 185" stroke={color} strokeWidth="2" />
      <path d="M134 82 L140 110 L138 140 L132 172 L120 185" stroke={color} strokeWidth="2" />
      {/* Lat muscle contours */}
      <path d="M68 90 Q62 115 64 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M132 90 Q138 115 136 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Spine */}
      <line x1="100" y1="72" x2="100" y2="180" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Scapulae */}
      <path d="M76 88 Q82 96 84 110 Q82 118 76 120" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      <path d="M124 88 Q118 96 116 110 Q118 118 124 120" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      {/* Lower back */}
      <path d="M88 150 Q100 155 112 150" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      <path d="M90 162 Q100 167 110 162" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      {/* Arms */}
      <path d="M44 100 L36 140 L32 170 L30 190" stroke={color} strokeWidth="2" />
      <path d="M156 100 L164 140 L168 170 L170 190" stroke={color} strokeWidth="2" />
      {/* Tricep contours */}
      <path d="M42 105 Q36 120 36 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M158 105 Q164 120 164 140" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Forearms */}
      <path d="M36 140 Q30 155 30 170" stroke={color} strokeWidth="1.5" />
      <path d="M164 140 Q170 155 170 170" stroke={color} strokeWidth="1.5" />
      {/* Hands */}
      <ellipse cx="29" cy="195" rx="6" ry="10" stroke={color} strokeWidth="1.5" />
      <ellipse cx="171" cy="195" rx="6" ry="10" stroke={color} strokeWidth="1.5" />
      {/* Glutes */}
      <path d="M80 185 Q90 195 100 194 Q110 195 120 185" stroke={color} strokeWidth="2" />
      <path d="M84 188 Q92 196 100 194" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M116 188 Q108 196 100 194" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Glute crease */}
      <line x1="100" y1="185" x2="100" y2="200" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      {/* Hamstrings */}
      <path d="M80 200 L74 240 L72 280 L78 290" stroke={color} strokeWidth="2" />
      <path d="M120 200 L126 240 L128 280 L122 290" stroke={color} strokeWidth="2" />
      <path d="M92 200 L90 240 L88 280" stroke={color} strokeWidth="1.5" />
      <path d="M108 200 L110 240 L112 280" stroke={color} strokeWidth="1.5" />
      {/* Hamstring contours */}
      <path d="M84 210 Q78 235 76 260" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M116 210 Q122 235 124 260" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Knees */}
      <ellipse cx="83" cy="288" rx="10" ry="8" stroke={color} strokeWidth="1.5" />
      <ellipse cx="117" cy="288" rx="10" ry="8" stroke={color} strokeWidth="1.5" />
      {/* Calves */}
      <path d="M78 296 L76 330 Q78 350 80 370" stroke={color} strokeWidth="2" />
      <path d="M88 296 L88 330 Q86 350 84 370" stroke={color} strokeWidth="1.5" />
      <path d="M122 296 L124 330 Q122 350 120 370" stroke={color} strokeWidth="2" />
      <path d="M112 296 L112 330 Q114 350 116 370" stroke={color} strokeWidth="1.5" />
      {/* Calf muscle contours */}
      <path d="M80 300 Q74 320 78 345" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      <path d="M120 300 Q126 320 122 345" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
      {/* Feet */}
      <path d="M70 370 L66 385 L86 390 L90 375" stroke={color} strokeWidth="2" />
      <path d="M130 370 L134 385 L114 390 L110 375" stroke={color} strokeWidth="2" />
    </svg>
  );
}
