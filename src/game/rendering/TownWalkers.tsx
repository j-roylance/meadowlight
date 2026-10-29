import type { WalkerRoute } from "./walkers";
import { palette } from "./palette";

/** Tiny townsfolk — path motion via SMIL only (no rAF / React tick). */
function Person({ shirt, bob }: { shirt: string; bob: boolean }) {
  return (
    <g>
      <ellipse cx={0} cy={5} rx={3.2} ry={1.4} fill={palette.shadow} />
      <rect x={-2.4} y={-2.5} width={4.8} height={5.5} rx={1.6} fill={shirt} />
      <circle cx={0} cy={-5.2} r={2.7} fill="#F3D5B5" />
      <circle cx={-0.9} cy={-5.5} r={0.45} fill={palette.outline} />
      <circle cx={0.9} cy={-5.5} r={0.45} fill={palette.outline} />
      {bob && (
        <animate
          attributeName="transform"
          values="translate(0,0); translate(0,-1.2); translate(0,0)"
          dur="0.55s"
          repeatCount="indefinite"
        />
      )}
    </g>
  );
}

export function TownWalkers({
  routes,
  reducedMotion,
}: {
  routes: WalkerRoute[];
  reducedMotion?: boolean;
}) {
  if (routes.length === 0) return null;

  if (reducedMotion) {
    return (
      <g pointerEvents="none" aria-hidden>
        {routes.map((r) => (
          <g
            key={r.id}
            transform={`translate(${(r.x1 + r.x2) / 2}, ${(r.y1 + r.y2) / 2})`}
          >
            <Person shirt={r.shirt} bob={false} />
          </g>
        ))}
      </g>
    );
  }

  return (
    <g pointerEvents="none" aria-hidden>
      {routes.map((r) => {
        const path = `M ${r.x1} ${r.y1} L ${r.x2} ${r.y2} L ${r.x1} ${r.y1}`;
        return (
          <g key={r.id}>
            <animateMotion
              path={path}
              dur={`${r.durationSec}s`}
              begin={`${r.delaySec}s`}
              repeatCount="indefinite"
            />
            <Person shirt={r.shirt} bob />
          </g>
        );
      })}
    </g>
  );
}
