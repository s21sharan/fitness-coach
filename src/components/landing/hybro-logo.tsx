"use client";

export function HybroLogo({ className = "", size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Abstract H with forward motion — represents hybrid athlete */}
      <rect x="6" y="8" width="5" height="32" rx="2.5" fill="currentColor" />
      <rect x="6" y="20" width="20" height="5" rx="2.5" fill="currentColor" />
      <rect x="21" y="8" width="5" height="32" rx="2.5" fill="currentColor" />
      {/* Forward motion lines — speed/endurance */}
      <rect x="32" y="14" width="12" height="3" rx="1.5" fill="#F97316" opacity="0.9" />
      <rect x="35" y="22" width="9" height="3" rx="1.5" fill="#F97316" opacity="0.6" />
      <rect x="32" y="30" width="12" height="3" rx="1.5" fill="#F97316" opacity="0.9" />
    </svg>
  );
}

export function HybroWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <HybroLogo size={36} />
      <span className="text-2xl font-bold tracking-tight">Hybro</span>
    </div>
  );
}
