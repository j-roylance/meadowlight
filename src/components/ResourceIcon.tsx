import type { ResourceKey } from "@/game/types";

const SIZE = { sm: 14, md: 18, lg: 22 } as const;

export function ResourceIcon({
  resource,
  size = "md",
  className = "",
}: {
  resource: ResourceKey;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const px = SIZE[size];
  const common = {
    width: px,
    height: px,
    viewBox: "0 0 24 24",
    className: `inline-block shrink-0 align-[-0.2em] ${className}`,
    "aria-hidden": true as const,
  };

  if (resource === "coins") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9.5" fill="#E8C060" stroke="#8A6A20" strokeWidth="1.4" />
        <circle cx="12" cy="12" r="7" fill="none" stroke="#F5E0A0" strokeWidth="1.2" />
        <text
          x="12"
          y="16"
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fill="#8A6A20"
          fontFamily="Georgia, serif"
        >
          $
        </text>
      </svg>
    );
  }

  if (resource === "wood") {
    return (
      <svg {...common}>
        <ellipse cx="12" cy="20" rx="7" ry="2.2" fill="#5A3A20" opacity="0.35" />
        <rect x="9.5" y="6" width="5" height="13" rx="1.5" fill="#A87850" stroke="#5A3A20" strokeWidth="1" />
        <ellipse cx="12" cy="5" rx="8" ry="5.5" fill="#4A8A3A" stroke="#2F5A28" strokeWidth="1" />
        <ellipse cx="9" cy="3.5" rx="4" ry="3" fill="#6AAA50" opacity="0.7" />
      </svg>
    );
  }

  if (resource === "stone") {
    return (
      <svg {...common}>
        <ellipse cx="12" cy="20" rx="8" ry="2" fill="#4A4030" opacity="0.3" />
        <ellipse cx="8" cy="15" rx="5.5" ry="4" fill="#888070" stroke="#4A4030" strokeWidth="1" />
        <ellipse cx="15" cy="14" rx="5" ry="3.8" fill="#A8A090" stroke="#4A4030" strokeWidth="1" />
        <ellipse cx="11" cy="10" rx="5.5" ry="4.2" fill="#C8C0B0" stroke="#4A4030" strokeWidth="1" />
        <ellipse cx="9" cy="9" rx="2.2" ry="1.3" fill="#E0DCD0" opacity="0.55" />
      </svg>
    );
  }

  if (resource === "research") {
    return (
      <svg {...common}>
        <rect x="4" y="14" width="16" height="4.5" rx="0.8" fill="#C4785A" stroke="#5A3020" strokeWidth="0.9" />
        <rect x="4.5" y="15" width="1.2" height="2.5" fill="#F5E6C8" opacity="0.7" />
        <rect x="5" y="9.5" width="15" height="4.5" rx="0.8" fill="#5A8AB8" stroke="#2A4A68" strokeWidth="0.9" />
        <rect x="5.5" y="10.5" width="1.2" height="2.5" fill="#E8F0F8" opacity="0.7" />
        <rect x="6" y="5" width="14" height="4.5" rx="0.8" fill="#6B9E4A" stroke="#3A5A28" strokeWidth="0.9" />
        <rect x="6.5" y="6" width="1.2" height="2.5" fill="#E8F4D8" opacity="0.7" />
        <rect x="7" y="1.5" width="13" height="3.8" rx="0.8" fill="#B090C8" stroke="#5A4070" strokeWidth="0.9" />
        <rect x="7.5" y="2.3" width="1.1" height="2.2" fill="#F4ECF8" opacity="0.75" />
      </svg>
    );
  }

  // happiness — warm smiley
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9.5" fill="#F0D060" stroke="#A88820" strokeWidth="1.3" />
      <circle cx="9" cy="10" r="1.4" fill="#5A4020" />
      <circle cx="15" cy="10" r="1.4" fill="#5A4020" />
      <path
        d="M7.5 14.5c1.4 2.2 3.2 3.2 4.5 3.2s3.1-1 4.5-3.2"
        fill="none"
        stroke="#5A4020"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const LABELS: Record<ResourceKey, string> = {
  coins: "Coins",
  wood: "Wood",
  stone: "Stone",
  research: "Research",
  happiness: "Happiness",
};

/** Icon + amount (or dash). */
export function ResourceAmount({
  resource,
  amount,
  size = "md",
  showLabel = false,
  className = "",
}: {
  resource: ResourceKey;
  amount: number | string;
  size?: keyof typeof SIZE;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={LABELS[resource]}
    >
      <ResourceIcon resource={resource} size={size} />
      {showLabel && <span className="sr-only">{LABELS[resource]}</span>}
      <span>{amount}</span>
    </span>
  );
}

/** Compact cost/yield chip: icon + number, omitted when 0 unless force. */
export function ResourceCostLine({
  amounts,
  prefix = "",
  suffix = "",
  size = "sm",
}: {
  amounts: Partial<Record<ResourceKey, number>>;
  prefix?: string;
  suffix?: string;
  size?: keyof typeof SIZE;
}) {
  const keys = (Object.keys(amounts) as ResourceKey[]).filter(
    (k) => (amounts[k] ?? 0) !== 0
  );
  if (keys.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {prefix}
      {keys.map((k, i) => (
        <span key={k} className="inline-flex items-center gap-0.5">
          {i > 0 && <span className="opacity-40">·</span>}
          <ResourceAmount resource={k} amount={amounts[k]!} size={size} />
        </span>
      ))}
      {suffix}
    </span>
  );
}

export function ResourceExchangeLabel({
  from,
  to,
  pay,
  receive,
  size = "sm",
}: {
  from: ResourceKey;
  to: ResourceKey;
  pay: number;
  receive: number;
  size?: keyof typeof SIZE;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ResourceAmount resource={from} amount={pay} size={size} />
      <span aria-hidden>→</span>
      <ResourceAmount resource={to} amount={receive} size={size} />
    </span>
  );
}
