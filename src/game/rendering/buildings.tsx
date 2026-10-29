import { palette as p } from "./palette";

export const TW = 64;
export const TH = 32;

/** Isometric diamond for a w×h tile footprint. */
export function IsoBase({
  w = 1,
  h = 1,
  fill,
  stroke = p.outline,
  opacity = 1,
}: {
  w?: number;
  h?: number;
  fill: string;
  stroke?: string;
  opacity?: number;
}) {
  const t: [number, number] = [(w - h) * 16, 0];
  const r: [number, number] = [t[0] + w * 32, t[1] + w * 16];
  const l: [number, number] = [t[0] - h * 32, t[1] + h * 16];
  const b: [number, number] = [l[0] + w * 32, l[1] + w * 16];
  return (
    <polygon
      points={`${t[0]},${t[1]} ${r[0]},${r[1]} ${b[0]},${b[1]} ${l[0]},${l[1]}`}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke === "none" ? 0 : 0.8}
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

function Shadow({ w = 1, h = 1 }: { w?: number; h?: number }) {
  return (
    <g transform="translate(2, 3)" opacity={0.35}>
      <IsoBase w={w} h={h} fill="#3A2818" stroke="none" />
    </g>
  );
}

function GrassTuft({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <path d="M0,4 Q-2,0 -1,-3" stroke={p.grassDark} strokeWidth={1.2} fill="none" />
      <path d="M0,4 Q2,-1 1,-4" stroke={p.grassMid} strokeWidth={1.2} fill="none" />
    </g>
  );
}

export function TerrainTile({ kind }: { kind: string }) {
  if (kind === "water") {
    return (
      <g>
        <IsoBase fill={p.waterDeep} stroke="none" />
        <IsoBase fill={p.water} stroke="none" opacity={0.85} />
        <ellipse cx={-4} cy={10} rx={8} ry={3} fill={p.waterHighlight} opacity={0.35} />
        <ellipse cx={8} cy={16} rx={5} ry={2} fill={p.waterHighlight} opacity={0.25} />
      </g>
    );
  }
  if (kind === "sand") {
    return (
      <g>
        <IsoBase fill={p.sand} />
        <circle cx={-6} cy={12} r={1} fill="#D8C080" opacity={0.5} />
        <circle cx={8} cy={14} r={1.2} fill="#D8C080" opacity={0.4} />
      </g>
    );
  }
  if (kind === "grass_flowers") {
    return (
      <g>
        <IsoBase fill={p.grassMid} />
        <IsoBase fill={p.grassLight} opacity={0.35} stroke="none" />
        <GrassTuft x={-8} y={8} />
        <circle cx={-6} cy={8} r={2.4} fill={p.flowerPink} />
        <circle cx={-6} cy={8} r={1} fill="#FFF0F4" />
        <circle cx={8} cy={10} r={2.2} fill={p.flowerYellow} />
        <circle cx={8} cy={10} r={0.8} fill="#FFF8D0" />
        <circle cx={2} cy={16} r={2} fill={p.flowerPurple} />
      </g>
    );
  }
  if (kind === "tree" || kind === "stone_pile") {
    // Ground only — props are drawn in the depth-sorted layer.
    return <IsoBase fill={p.grassMid} stroke="none" />;
  }
  if (kind === "path") {
    return <IsoBase fill={p.pathDirt} />;
  }
  // Keep default grass to a single diamond — most common tile, must stay cheap.
  return <IsoBase fill={p.grassLight} stroke="none" />;
}

/** Tall tree prop for the depth-sorted layer (no ground diamond). */
export function TreeProp() {
  return (
    <g>
      <ellipse cx={2} cy={18} rx={10} ry={4} fill={p.shadow} />
      <rect x={-2.5} y={-2} width={5} height={16} rx={1.5} fill={p.treeTrunk} />
      <ellipse cx={0} cy={-12} rx={18} ry={14} fill={p.treeCanopy} />
      <ellipse cx={-5} cy={-16} rx={11} ry={9} fill={p.treeCanopyLight} opacity={0.75} />
      <ellipse cx={6} cy={-10} rx={8} ry={6} fill={p.grassDark} opacity={0.25} />
    </g>
  );
}

/** Stone pile prop for the depth-sorted layer. */
export function StonePileProp() {
  return (
    <g>
      <ellipse cx={1} cy={20} rx={14} ry={5} fill={p.shadow} />
      <ellipse cx={-6} cy={14} rx={9} ry={6} fill={p.stoneDark} stroke={p.outline} strokeWidth={1} />
      <ellipse cx={8} cy={16} rx={8} ry={5.5} fill={p.stone} stroke={p.outline} strokeWidth={1} />
      <ellipse cx={0} cy={8} rx={10} ry={7} fill={p.pathStone} stroke={p.outline} strokeWidth={1} />
      <ellipse cx={-4} cy={6} rx={4} ry={2.5} fill="#C8C4B8" opacity={0.55} />
      <ellipse cx={6} cy={10} rx={3.5} ry={2} fill="#D0CCC0" opacity={0.4} />
    </g>
  );
}

export function RoadTileArt({
  n,
  e,
  s,
  w,
}: {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}) {
  return (
    <g>
      <IsoBase fill="#B89060" />
      <IsoBase fill={p.pathDirt} opacity={0.85} stroke="none" />
      {n && (
        <line x1={0} y1={2} x2={0} y2={14} stroke={p.pathStone} strokeWidth={7} opacity={0.45} />
      )}
      {s && (
        <line x1={0} y1={18} x2={0} y2={30} stroke={p.pathStone} strokeWidth={7} opacity={0.45} />
      )}
      {e && (
        <line x1={6} y1={16} x2={22} y2={16} stroke={p.pathStone} strokeWidth={6} opacity={0.45} />
      )}
      {w && (
        <line
          x1={-22}
          y1={16}
          x2={-6}
          y2={16}
          stroke={p.pathStone}
          strokeWidth={6}
          opacity={0.45}
        />
      )}
      <ellipse cx={0} cy={14} rx={11} ry={5} fill="#E8D4B0" opacity={0.35} />
    </g>
  );
}

/** Parallelogram flush to a wall face. `side: "left"` follows SW face, `"right"` SE face. */
function IsoWallPanel({
  side,
  along0,
  along1,
  yBottom,
  height,
  fill,
  stroke = p.outline,
  /** Horizontal reach of the wall base from the front corner (cottage default 20). */
  halfW = 20,
}: {
  side: "left" | "right";
  /** 0–1 along the wall base from the front corner outward. */
  along0: number;
  along1: number;
  yBottom: number;
  height: number;
  fill: string;
  stroke?: string;
  halfW?: number;
}) {
  // Iso 2:1 — left base goes to (-halfW, yBottom - halfW/2); right to (+halfW, yBottom - halfW/2).
  const front = { x: 0, y: yBottom };
  const outer =
    side === "left"
      ? { x: -halfW, y: yBottom - halfW / 2 }
      : { x: halfW, y: yBottom - halfW / 2 };
  const at = (t: number) => ({
    x: front.x + (outer.x - front.x) * t,
    y: front.y + (outer.y - front.y) * t,
  });
  const a = at(along0);
  const b = at(along1);
  const pts = `${a.x},${a.y} ${b.x},${b.y} ${b.x},${b.y - height} ${a.x},${a.y - height}`;
  return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={1} strokeLinejoin="round" />;
}

/** Small isometric chimney box planted on the right roof slope. */
function IsoChimney({ roofPeakY }: { roofPeakY: number }) {
  // Sit on the right roof face, slightly below the ridge so it reads flush.
  const baseY = roofPeakY + 10;
  const bx = 8;
  const w = 5;
  const d = 4;
  const h = 11;
  // Mini iso footprint top-corner at (bx, baseY)
  const t = { x: bx, y: baseY };
  const r = { x: bx + w, y: baseY + w * 0.5 };
  const l = { x: bx - d, y: baseY + d * 0.5 };
  const b = { x: bx + w - d, y: baseY + (w + d) * 0.5 };
  return (
    <g>
      {/* Left face */}
      <polygon
        points={`${l.x},${l.y} ${t.x},${t.y} ${t.x},${t.y - h} ${l.x},${l.y - h}`}
        fill={p.stone}
        stroke={p.outline}
        strokeWidth={1}
      />
      {/* Right face */}
      <polygon
        points={`${t.x},${t.y} ${r.x},${r.y} ${r.x},${r.y - h} ${t.x},${t.y - h}`}
        fill={p.stoneDark}
        stroke={p.outline}
        strokeWidth={1}
      />
      {/* Cap */}
      <polygon
        points={`${t.x},${t.y - h} ${r.x},${r.y - h} ${b.x},${b.y - h} ${l.x},${l.y - h}`}
        fill="#B8B0A0"
        stroke={p.outline}
        strokeWidth={1}
      />
      <ellipse cx={bx} cy={baseY - h - 5} rx={4} ry={2.2} fill="#E8E0D8" opacity={0.4} />
    </g>
  );
}

function HouseBody({
  roof,
  accent,
  level,
}: {
  roof: string;
  accent: string;
  level: 1 | 2;
}) {
  const h = level === 2 ? 30 : 22;
  const wallBottom = 20;
  const roofPeakY = 20 - h - 18;
  return (
    <g>
      <Shadow />
      {/* Left wall */}
      <polygon
        points={`-20,10 0,20 0,${20 - h} -20,${10 - h}`}
        fill={p.wallCream}
        stroke={p.outline}
        strokeWidth={1}
      />
      {/* Right wall */}
      <polygon
        points={`0,20 20,10 20,${10 - h} 0,${20 - h}`}
        fill={p.wallWarm}
        stroke={p.outline}
        strokeWidth={1}
      />
      {/* Door on left (SW) face — parallelogram matching the wall */}
      <IsoWallPanel
        side="left"
        along0={0.18}
        along1={0.55}
        yBottom={wallBottom}
        height={12}
        fill={p.wood}
      />
      {/* Door knob — sits on the door plane */}
      <circle cx={-3} cy={wallBottom - 6} r={0.9} fill={p.windowGlow} />
      {/* Window on right (SE) face */}
      <IsoWallPanel
        side="right"
        along0={0.28}
        along1={0.62}
        yBottom={wallBottom - 8}
        height={7}
        fill={p.windowGlow}
      />
      {/* Window muntins along iso axes */}
      <line
        x1={0 + 20 * 0.45}
        y1={wallBottom - 8 - 10 * 0.45 - 3.5}
        x2={0 + 20 * 0.45}
        y2={wallBottom - 8 - 10 * 0.45}
        stroke={p.outline}
        strokeWidth={0.6}
      />
      <line
        x1={0 + 20 * 0.28}
        y1={wallBottom - 8 - 10 * 0.28 - 3.5}
        x2={0 + 20 * 0.62}
        y2={wallBottom - 8 - 10 * 0.62 - 3.5}
        stroke={p.outline}
        strokeWidth={0.6}
      />
      {/* Flower box under window — thin iso ledge on right wall */}
      <IsoWallPanel
        side="right"
        along0={0.26}
        along1={0.64}
        yBottom={wallBottom - 7}
        height={2.5}
        fill={p.woodDark}
      />
      <circle cx={8} cy={wallBottom - 9} r={1.5} fill={p.flowerPink} />
      <circle cx={11} cy={wallBottom - 10.5} r={1.4} fill={p.flowerYellow} />
      <circle cx={14} cy={wallBottom - 12} r={1.3} fill={p.flowerPurple} />
      {/* Roof left */}
      <polygon
        points={`-24,${10 - h + 2} 0,${roofPeakY} 0,${20 - h + 2} -20,${10 - h + 6}`}
        fill={roof}
        stroke={p.outline}
        strokeWidth={1}
      />
      {/* Roof right */}
      <polygon
        points={`0,${roofPeakY} 24,${10 - h + 2} 20,${10 - h + 6} 0,${20 - h + 2}`}
        fill={accent}
        stroke={p.outline}
        strokeWidth={1}
      />
      {level === 2 && (
        <>
          <IsoWallPanel
            side="left"
            along0={0.55}
            along1={0.85}
            yBottom={wallBottom - 14}
            height={6}
            fill={p.windowGlow}
          />
          <polygon
            points={`-6,${roofPeakY} 0,${roofPeakY - 10} 6,${roofPeakY}`}
            fill={roof}
            stroke={p.outline}
          />
        </>
      )}
      <IsoChimney roofPeakY={roofPeakY} />
    </g>
  );
}

/** Finished 4×4 host landmarks — distinct silhouettes per project type. */
function CompletedProjectArt({ projectType }: { projectType?: string }) {
  const type = projectType ?? "riverside_park";

  if (type === "space_center") {
    return <BuildingArt definitionId="space_center" />;
  }

  if (type === "skyline_tower") {
    // Tall skyscraper filling the full 4×4 diamond (sides ≈ ±128).
    const podiumL = -110;
    const podiumR = 110;
    const podiumMid = 58;
    const podiumFront = 118;
    const towerL = -72;
    const towerR = 72;
    const towerFront = 78;
    const towerMid = 42;
    const towerTop = -130;
    const crownPeak = -168;
    return (
      <g>
        <Shadow w={4} h={4} />
        <IsoBase w={4} h={4} fill={p.grassMid} />
        {/* Plaza podium — covers nearly the whole plot */}
        <polygon
          points={`${podiumL},${podiumMid} 0,${podiumFront} ${podiumR},${podiumMid} ${podiumR},34 0,12 ${podiumL},34`}
          fill="#D8D0C0"
          stroke={p.outline}
        />
        <polygon
          points={`0,${podiumFront} ${podiumR},${podiumMid} ${podiumR},34 0,56`}
          fill="#C0B8A8"
          opacity={0.45}
        />
        {/* Lower podium ring / planted edge */}
        <ellipse cx={-78} cy={92} rx={18} ry={8} fill={p.grassDark} opacity={0.7} />
        <ellipse cx={78} cy={92} rx={18} ry={8} fill={p.grassDark} opacity={0.7} />
        <circle cx={-78} cy={88} r={4} fill={p.flowerPink} />
        <circle cx={78} cy={88} r={4} fill={p.flowerYellow} />
        <circle cx={0} cy={108} r={3.5} fill={p.flowerPurple} />
        {/* Main tower shaft — wide enough to read as a real building */}
        <polygon
          points={`${towerL},${towerMid} 0,${towerFront} ${towerR},${towerMid} ${towerR},${towerTop + 18} 0,${towerTop} ${towerL},${towerTop + 18}`}
          fill="#C8D0D8"
          stroke={p.outline}
        />
        <polygon
          points={`0,${towerFront} ${towerR},${towerMid} ${towerR},${towerTop + 18} 0,${towerTop}`}
          fill="#A8B4C0"
          stroke={p.outline}
        />
        {/* Window bands across both faces */}
        {[-110, -90, -70, -50, -30, -10, 10, 30, 50].map((y) => (
          <g key={y}>
            <polygon
              points={`${towerL + 10},${y + 10} -8,${y + 22} -8,${y + 12} ${towerL + 10},${y}`}
              fill={p.windowGlow}
              opacity={0.85}
            />
            <polygon
              points={`8,${y + 22} ${towerR - 10},${y + 10} ${towerR - 10},${y} 8,${y + 12}`}
              fill={p.windowNight}
              opacity={0.75}
            />
          </g>
        ))}
        {/* Crown / antenna */}
        <polygon
          points={`${towerL + 16},${towerTop + 18} 0,${crownPeak} ${towerR - 16},${towerTop + 18} 0,${towerTop + 6}`}
          fill="#E8F0F8"
          stroke={p.outline}
        />
        <line
          x1={0}
          y1={crownPeak}
          x2={0}
          y2={crownPeak - 18}
          stroke={p.outline}
          strokeWidth={2}
        />
        <circle cx={0} cy={crownPeak - 20} r={3} fill="#E8C060" stroke={p.outline} />
      </g>
    );
  }

  if (type === "municipal_rec") {
    // Large recreation center with courts
    return (
      <g>
        <Shadow w={4} h={4} />
        <IsoBase w={4} h={4} fill={p.grassMid} />
        {/* Main hall */}
        <polygon
          points="-50,28 0,53 50,28 50,-20 0,-45 -50,-20"
          fill="#E8D8B8"
          stroke={p.outline}
        />
        <polygon points="0,53 50,28 50,-20 0,5" fill="#D0C0A0" opacity={0.45} />
        {/* Gym roof */}
        <polygon
          points="-54,-16 0,-58 54,-16 0,8"
          fill="#5A9A6A"
          stroke={p.outline}
        />
        <polygon points="0,-58 54,-16 0,8" fill="#3F7A50" opacity={0.4} />
        {/* Big entrance */}
        <polygon points="-14,30 0,37 0,8 -14,1" fill={p.wood} stroke={p.outline} />
        <polygon points="0,37 14,30 14,1 0,8" fill={p.woodDark} stroke={p.outline} />
        {/* Court markings */}
        <ellipse cx={-36} cy={42} rx={14} ry={7} fill="#D4C090" stroke={p.outline} />
        <ellipse cx={36} cy={42} rx={14} ry={7} fill="#D4C090" stroke={p.outline} />
        <line x1={-36} y1={42} x2={-36} y2={42} stroke={p.outline} />
        <circle cx={-36} cy={42} r={3} fill="none" stroke="#C4785A" strokeWidth={1.5} />
        <circle cx={36} cy={42} r={3} fill="none" stroke="#C4785A" strokeWidth={1.5} />
        {/* Side windows */}
        <polygon points="-42,0 -28,7 -28,-6 -42,-13" fill={p.windowGlow} stroke={p.outline} />
        <polygon points="28,7 42,0 42,-13 28,-6" fill={p.windowGlow} stroke={p.outline} />
      </g>
    );
  }

  if (type === "community_university") {
    return (
      <g>
        <Shadow w={4} h={4} />
        <IsoBase w={4} h={4} fill={p.grassMid} />
        <polygon
          points="-48,30 0,54 48,30 48,-18 0,-42 -48,-18"
          fill="#E4D8C0"
          stroke={p.outline}
        />
        <polygon points="0,54 48,30 48,-18 0,6" fill={p.stoneDark} opacity={0.22} />
        <rect x={-12} y={-72} width={24} height={40} fill="#D0C4A8" stroke={p.outline} />
        <polygon points="-18,-72 0,-96 18,-72" fill={p.roofClay} stroke={p.outline} />
        <circle cx={0} cy={-54} r={7} fill={p.cream} stroke={p.outline} />
        <ellipse cx={-36} cy={12} rx={10} ry={7} fill={p.treeCanopy} />
        <ellipse cx={38} cy={16} rx={9} ry={6} fill={p.treeCanopyLight} />
      </g>
    );
  }

  if (type === "town_bank") {
    return (
      <g>
        <Shadow w={4} h={4} />
        <IsoBase w={4} h={4} fill="#D8D0C0" />
        <polygon
          points="-46,28 0,51 46,28 46,-16 0,-39 -46,-16"
          fill="#E0D8C8"
          stroke={p.outline}
        />
        <polygon points="-52,-10 0,-48 52,-10" fill="#C8C0B0" stroke={p.outline} />
        {[-28, -10, 8, 26].map((x) => (
          <rect key={x} x={x - 3} y={-6} width={6} height={28} fill="#E8E0D0" stroke={p.outline} />
        ))}
        <ellipse cx={16} cy={18} rx={8} ry={4} fill="#E8C060" opacity={0.9} />
      </g>
    );
  }

  if (type === "community_museum") {
    // Coliseum-esque museum: arched colonnade ring + warm gallery core
    return (
      <g>
        <Shadow w={4} h={4} />
        <IsoBase w={4} h={4} fill="#D8D0C0" />
        {/* Outer colonnade ellipse (arena feel) */}
        <ellipse cx={0} cy={28} rx={52} ry={24} fill="#C8C0B0" stroke={p.outline} />
        <ellipse cx={0} cy={22} rx={44} ry={18} fill="#B8B0A0" stroke={p.outline} />
        {/* Arch columns around the ring */}
        {[-40, -24, -8, 8, 24, 40].map((x, i) => (
          <g key={x}>
            <rect
              x={x - 3}
              y={6 - Math.abs(i - 2.5) * 2}
              width={6}
              height={22}
              fill="#E8E0D0"
              stroke={p.outline}
            />
            <path
              d={`M${x - 5},${8 - Math.abs(i - 2.5) * 2} Q${x},${-2 - Math.abs(i - 2.5)} ${x + 5},${8 - Math.abs(i - 2.5) * 2}`}
              fill="none"
              stroke={p.outline}
              strokeWidth={1.5}
            />
          </g>
        ))}
        {/* Inner civic gallery */}
        <polygon
          points="-28,18 0,32 28,18 28,-24 0,-38 -28,-24"
          fill={p.wallCream}
          stroke={p.outline}
        />
        <polygon points="0,32 28,18 28,-24 0,-10" fill={p.wallWarm} opacity={0.5} />
        <polygon points="-32,-20 0,-52 32,-20 0,-4" fill={p.roofClay} stroke={p.outline} />
        <polygon points="0,-52 32,-20 0,-4" fill={p.roofClayDark} opacity={0.35} />
        {/* Pediment sculpture glow */}
        <circle cx={0} cy={-28} r={5} fill={p.windowGlow} stroke={p.outline} />
        <polygon points="-10,14 0,19 0,-2 -10,-7" fill={p.wood} stroke={p.outline} />
        <polygon points="0,19 10,14 10,-7 0,-2" fill={p.woodDark} stroke={p.outline} />
        {/* Banner */}
        <rect x={-6} y={-18} width={12} height={8} fill="#D46050" stroke={p.outline} />
      </g>
    );
  }

  // Park — paths, pond, trees, flowers, benches
  return (
    <g>
      <Shadow w={4} h={4} />
      <IsoBase w={4} h={4} fill={p.grassMid} />
      <ellipse cx={0} cy={28} rx={30} ry={14} fill={p.water} opacity={0.8} />
      <ellipse cx={-2} cy={24} rx={12} ry={5} fill={p.waterHighlight} opacity={0.35} />
      <ellipse cx={-32} cy={4} rx={18} ry={14} fill={p.treeCanopy} />
      <ellipse cx={-34} cy={-2} rx={10} ry={8} fill={p.treeCanopyLight} opacity={0.7} />
      <ellipse cx={34} cy={10} rx={16} ry={12} fill={p.treeCanopyLight} />
      <ellipse cx={8} cy={-8} rx={12} ry={9} fill={p.treeCanopy} />
      <circle cx={-12} cy={40} r={4} fill={p.flowerPink} />
      <circle cx={16} cy={44} r={4} fill={p.flowerYellow} />
      <circle cx={28} cy={36} r={3.5} fill={p.flowerPurple} />
      <rect x={-14} y={16} width={14} height={3.5} rx={1} fill={p.wood} />
      <rect x={18} y={20} width={12} height={3.5} rx={1} fill={p.wood} />
      {/* Path */}
      <polygon points="-8,48 8,40 16,48 0,56" fill={p.pathDirt} opacity={0.7} />
    </g>
  );
}

/** Smaller 2×2 cosmetic blueprint copies of the finished landmarks. */
function LandmarkArt({ definitionId }: { definitionId: string }) {
  if (definitionId === "landmark_tower") {
    // 2×2 blueprint — still fills its diamond (sides ≈ ±64).
    const podiumL = -56;
    const podiumR = 56;
    const towerL = -36;
    const towerR = 36;
    const towerFront = 48;
    const towerMid = 28;
    const towerTop = -78;
    return (
      <g>
        <Shadow w={2} h={2} />
        <IsoBase w={2} h={2} fill={p.grassMid} />
        <polygon
          points={`${podiumL},32 0,60 ${podiumR},32 ${podiumR},18 0,6 ${podiumL},18`}
          fill="#D8D0C0"
          stroke={p.outline}
        />
        <polygon
          points={`${towerL},${towerMid} 0,${towerFront} ${towerR},${towerMid} ${towerR},${towerTop + 12} 0,${towerTop} ${towerL},${towerTop + 12}`}
          fill="#C8D0D8"
          stroke={p.outline}
        />
        <polygon
          points={`0,${towerFront} ${towerR},${towerMid} ${towerR},${towerTop + 12} 0,${towerTop}`}
          fill="#A8B4C0"
          stroke={p.outline}
        />
        {[-60, -42, -24, -6, 12, 28].map((y) => (
          <g key={y}>
            <polygon
              points={`${towerL + 6},${y + 7} -4,${y + 14} -4,${y + 7} ${towerL + 6},${y}`}
              fill={p.windowGlow}
              opacity={0.85}
            />
            <polygon
              points={`4,${y + 14} ${towerR - 6},${y + 7} ${towerR - 6},${y} 4,${y + 7}`}
              fill={p.windowNight}
              opacity={0.75}
            />
          </g>
        ))}
        <polygon
          points={`${towerL + 8},${towerTop + 12} 0,${towerTop - 22} ${towerR - 8},${towerTop + 12} 0,${towerTop + 4}`}
          fill="#E8F0F8"
          stroke={p.outline}
        />
      </g>
    );
  }
  if (definitionId === "landmark_rec") {
    return (
      <g>
        <Shadow w={2} h={2} />
        <IsoBase w={2} h={2} fill={p.grassMid} />
        <polygon
          points="-36,20 0,38 36,20 36,-12 0,-30 -36,-12"
          fill="#E8D8B8"
          stroke={p.outline}
        />
        <polygon points="-40,-8 0,-42 40,-8 0,8" fill="#5A9A6A" stroke={p.outline} />
        <ellipse cx={-22} cy={30} rx={10} ry={5} fill="#D4C090" stroke={p.outline} />
        <ellipse cx={22} cy={30} rx={10} ry={5} fill="#D4C090" stroke={p.outline} />
      </g>
    );
  }
  if (definitionId === "landmark_museum") {
    return (
      <g>
        <Shadow w={2} h={2} />
        <IsoBase w={2} h={2} fill="#D8D0C0" />
        <ellipse cx={0} cy={22} rx={34} ry={16} fill="#C8C0B0" stroke={p.outline} />
        {[-22, -8, 8, 22].map((x) => (
          <rect key={x} x={x - 2.5} y={4} width={5} height={16} fill="#E8E0D0" stroke={p.outline} />
        ))}
        <polygon
          points="-18,14 0,23 18,14 18,-16 0,-25 -18,-16"
          fill={p.wallCream}
          stroke={p.outline}
        />
        <polygon points="-22,-12 0,-36 22,-12 0,0" fill={p.roofClay} stroke={p.outline} />
        <circle cx={0} cy={-18} r={4} fill={p.windowGlow} stroke={p.outline} />
      </g>
    );
  }
  if (definitionId === "landmark_university") {
    const fb = 43;
    return (
      <g>
        <Shadow w={2} h={2} />
        <polygon
          points="-42,22 0,43 42,22 42,-14 0,-36 -42,-14"
          fill="#E4D8C0"
          stroke={p.outline}
        />
        <polygon points="0,43 42,22 42,-14 0,6" fill={p.stoneDark} opacity={0.22} />
        <IsoWallPanel
          side="left"
          along0={0.08}
          along1={0.35}
          yBottom={fb}
          height={18}
          fill={p.woodDark}
          halfW={42}
        />
        <rect x={-8} y={-52} width={16} height={28} fill="#D0C4A8" stroke={p.outline} />
        <polygon points="-12,-52 0,-68 12,-52" fill={p.roofClay} stroke={p.outline} />
        <circle cx={0} cy={-40} r={5} fill={p.cream} stroke={p.outline} />
        <line x1={0} y1={-40} x2={0} y2={-44} stroke={p.outline} strokeWidth={1.2} />
        <line x1={0} y1={-40} x2={3} y2={-40} stroke={p.outline} strokeWidth={1} />
      </g>
    );
  }
  if (definitionId === "landmark_bank") {
    return (
      <g>
        <Shadow w={2} h={2} />
        <polygon
          points="-36,22 0,40 36,22 36,-8 0,-26 -36,-8"
          fill="#D8D0C0"
          stroke={p.outline}
        />
        <polygon points="-40,-4 0,-32 40,-4" fill="#C8C0B0" stroke={p.outline} />
        <rect x={-18} y={-2} width={5} height={22} fill="#E8E0D0" stroke={p.outline} />
        <rect x={-3} y={-2} width={5} height={22} fill="#E0D8C8" stroke={p.outline} />
        <rect x={12} y={-2} width={5} height={22} fill="#D8D0C0" stroke={p.outline} />
        <ellipse cx={10} cy={12} rx={6} ry={3} fill="#E8C060" opacity={0.85} />
      </g>
    );
  }
  // landmark_park
  return (
    <g>
      <Shadow w={2} h={2} />
      <IsoBase w={2} h={2} fill={p.grassMid} />
      <ellipse cx={0} cy={22} rx={16} ry={8} fill={p.water} opacity={0.8} />
      <ellipse cx={-14} cy={6} rx={12} ry={9} fill={p.treeCanopy} />
      <ellipse cx={16} cy={12} rx={10} ry={8} fill={p.treeCanopyLight} />
      <circle cx={-8} cy={28} r={3} fill={p.flowerPink} />
      <circle cx={12} cy={30} r={3} fill={p.flowerYellow} />
      <rect x={-6} y={14} width={10} height={3} fill={p.wood} />
    </g>
  );
}

export function BuildingArt({
  definitionId,
  level = 1,
  stage,
  projectType,
}: {
  definitionId: string;
  level?: 1 | 2;
  stage?: string;
  projectType?: string;
}) {
  switch (definitionId) {
    case "cottage_a":
      return <HouseBody roof={p.roofThatch} accent="#A88848" level={level} />;
    case "cottage_b":
      return <HouseBody roof={p.roofClay} accent={p.roofClayDark} level={level} />;
    case "cottage_c":
      return <HouseBody roof={p.roofMoss} accent={p.grassDark} level={level} />;
    case "town_hall": {
      // 3×3 footprint — body fills the diamond (sides ≈ ±96, front tip ≈ 96).
      const lx = -88;
      const rx = 88;
      const midY = 46;
      const fb = 88;
      const wallTopL = -28;
      const wallTopC = -52;
      const wallTopR = -28;
      // Hip roof: high far ridge, eaves drop toward the player (front corner).
      const roofPeak = { x: 0, y: wallTopC - 28 };
      const roofLeft = { x: lx - 12, y: wallTopL + 6 };
      const roofRight = { x: rx + 12, y: wallTopR + 6 };
      const roofFront = { x: 0, y: 22 };
      const roofLeftIn = { x: lx + 8, y: wallTopL + 14 };
      const roofRightIn = { x: rx - 8, y: wallTopR + 14 };
      const door = (
        along0: number,
        along1: number,
        side: "left" | "right",
        height: number,
        yOff = 0
      ) => {
        const front = { x: 0, y: fb + yOff };
        const outer =
          side === "left"
            ? { x: lx, y: midY + yOff }
            : { x: rx, y: midY + yOff };
        const at = (t: number) => ({
          x: front.x + (outer.x - front.x) * t,
          y: front.y + (outer.y - front.y) * t,
        });
        const a = at(along0);
        const b = at(along1);
        return `${a.x},${a.y} ${b.x},${b.y} ${b.x},${b.y - height} ${a.x},${a.y - height}`;
      };
      return (
        <g>
          <Shadow w={3} h={3} />
          <IsoBase w={3} h={3} fill={p.pathStone} opacity={0.55} />
          {/* Main stone mass — nearly full 3×3 plot */}
          <polygon
            points={`${lx},${midY} 0,${fb} ${rx},${midY} ${rx},${wallTopR} 0,${wallTopC} ${lx},${wallTopL}`}
            fill={p.wallStone}
            stroke={p.outline}
          />
          <polygon
            points={`0,${fb} ${rx},${midY} ${rx},${wallTopR} 0,${wallTopC + 24}`}
            fill={p.stoneDark}
            opacity={0.28}
          />
          {/* Twin doors at the front corner */}
          <polygon points={door(0.04, 0.28, "left", 30)} fill={p.wood} stroke={p.outline} />
          <polygon points={door(0.04, 0.28, "right", 30)} fill={p.woodDark} stroke={p.outline} />
          <circle cx={-9} cy={fb - 16} r={1.4} fill={p.windowGlow} />
          <circle cx={9} cy={fb - 16} r={1.4} fill={p.windowGlow} />
          {/* Window rows on each face */}
          <polygon points={door(0.38, 0.58, "left", 14, -22)} fill={p.windowGlow} stroke={p.outline} />
          <polygon points={door(0.65, 0.88, "left", 14, -22)} fill={p.windowGlow} stroke={p.outline} />
          <polygon points={door(0.38, 0.58, "right", 14, -22)} fill={p.windowGlow} stroke={p.outline} />
          <polygon points={door(0.65, 0.88, "right", 14, -22)} fill={p.windowGlow} stroke={p.outline} />
          <polygon points={door(0.45, 0.72, "left", 12, -42)} fill={p.windowNight} stroke={p.outline} />
          <polygon points={door(0.45, 0.72, "right", 12, -42)} fill={p.windowNight} stroke={p.outline} />
          {/* Left roof face */}
          <polygon
            points={`${roofLeft.x},${roofLeft.y} ${roofPeak.x},${roofPeak.y} ${roofFront.x},${roofFront.y} ${roofLeftIn.x},${roofLeftIn.y}`}
            fill={p.roofClay}
            stroke={p.outline}
          />
          {/* Right roof face — slopes down to the player-facing eave */}
          <polygon
            points={`${roofPeak.x},${roofPeak.y} ${roofRight.x},${roofRight.y} ${roofRightIn.x},${roofRightIn.y} ${roofFront.x},${roofFront.y}`}
            fill={p.roofClayDark}
            stroke={p.outline}
          />
          <line
            x1={roofPeak.x}
            y1={roofPeak.y}
            x2={roofFront.x}
            y2={roofFront.y}
            stroke={p.outline}
            strokeWidth={1.2}
            opacity={0.55}
          />
          <circle
            cx={0}
            cy={(roofPeak.y + roofFront.y) / 2 - 8}
            r={5}
            fill="#E8C060"
            stroke={p.outline}
          />
          {/* Side wing accents so the plot corners feel occupied */}
          <ellipse cx={-62} cy={58} rx={14} ry={7} fill={p.flowerPink} opacity={0.85} />
          <ellipse cx={62} cy={58} rx={14} ry={7} fill={p.flowerYellow} opacity={0.85} />
        </g>
      );
    }
    case "wood_workshop":
      return (
        <g>
          <Shadow />
          <polygon
            points="-22,12 0,23 22,12 22,-6 0,-18 -22,-6"
            fill={p.wood}
            stroke={p.outline}
          />
          <polygon points="0,23 22,12 22,-6 0,4" fill={p.woodDark} opacity={0.4} />
          {/* Workshop door on left face */}
          <IsoWallPanel
            side="left"
            along0={0.2}
            along1={0.58}
            yBottom={23}
            height={14}
            fill={p.cream}
          />
          <polygon points="-24,-4 0,-24 24,-4 0,4" fill={p.roofThatch} stroke={p.outline} />
          <ellipse cx={14} cy={10} rx={7} ry={3.5} fill={p.woodDark} />
          <ellipse cx={14} cy={7} rx={7} ry={3.5} fill={p.wood} />
          <ellipse cx={14} cy={4} rx={7} ry={3.5} fill="#C49060" />
        </g>
      );
    case "stone_yard":
      return (
        <g>
          <Shadow />
          <polygon
            points="-22,12 0,23 22,12 22,-2 0,-14 -22,-2"
            fill="#B8B0A0"
            stroke={p.outline}
          />
          <rect x={-16} y={-20} width={11} height={16} fill={p.stoneDark} stroke={p.outline} />
          <rect x={-3} y={-26} width={14} height={22} fill={p.stone} stroke={p.outline} />
          <rect x={10} y={-16} width={9} height={12} fill={p.stoneDark} stroke={p.outline} />
          <line x1={-10} y1={-12} x2={-10} y2={-4} stroke="#D0C8B8" strokeWidth={1} />
        </g>
      );
    case "neighborhood_market":
      return (
        <g>
          <Shadow />
          {/* Left / right stall walls */}
          <polygon
            points="-24,12 0,24 0,-4 -24,-16"
            fill={p.wallCream}
            stroke={p.outline}
          />
          <polygon
            points="0,24 24,12 24,-16 0,-4"
            fill={p.wallWarm}
            stroke={p.outline}
          />
          {/* Open stall recesses (iso), not flat front-facing doors */}
          <IsoWallPanel
            side="left"
            along0={0.1}
            along1={0.78}
            yBottom={24}
            height={13}
            fill="#5A4030"
            halfW={24}
          />
          <IsoWallPanel
            side="right"
            along0={0.1}
            along1={0.78}
            yBottom={24}
            height={13}
            fill="#4A3428"
            halfW={24}
          />
          {/* Counter ledges flush to each face */}
          <IsoWallPanel
            side="left"
            along0={0.08}
            along1={0.8}
            yBottom={24}
            height={4}
            fill={p.wood}
            halfW={24}
          />
          <IsoWallPanel
            side="right"
            along0={0.08}
            along1={0.8}
            yBottom={24}
            height={4}
            fill={p.woodDark}
            halfW={24}
          />
          {/* Awning / roof */}
          <polygon points="-28,-2 0,-24 28,-2 0,8" fill="#D46050" stroke={p.outline} />
          <polygon points="0,-24 28,-2 0,8" fill="#B04840" opacity={0.4} />
          {/* Produce on the counters, following each face */}
          <circle cx={-10} cy={14} r={3} fill={p.flowerYellow} />
          <circle cx={-6} cy={16} r={2.5} fill="#80C060" />
          <circle cx={10} cy={14} r={3} fill={p.flowerPink} />
          <circle cx={6} cy={16} r={2.5} fill={p.flowerYellow} />
        </g>
      );
    case "flower_garden":
      return (
        <g>
          <Shadow />
          <IsoBase fill={p.grassDark} />
          <ellipse cx={0} cy={14} rx={16} ry={8} fill={p.grassMid} />
          <circle cx={-10} cy={8} r={4.5} fill={p.flowerPink} />
          <circle cx={-10} cy={8} r={1.5} fill="#FFF0F4" />
          <circle cx={6} cy={10} r={4.5} fill={p.flowerYellow} />
          <circle cx={6} cy={10} r={1.5} fill="#FFF8D0" />
          <circle cx={0} cy={16} r={4} fill={p.flowerPurple} />
          <circle cx={12} cy={6} r={3.5} fill={p.flowerPink} />
          <rect x={-2} y={-6} width={4} height={12} fill={p.treeCanopy} />
        </g>
      );
    case "pocket_park":
      return (
        <g>
          <Shadow w={2} h={2} />
          <IsoBase w={2} h={2} fill={p.grassMid} />
          <ellipse cx={-12} cy={10} rx={16} ry={12} fill={p.treeCanopy} />
          <ellipse cx={-14} cy={6} rx={10} ry={8} fill={p.treeCanopyLight} opacity={0.7} />
          <ellipse cx={18} cy={20} rx={14} ry={10} fill={p.treeCanopyLight} />
          <ellipse cx={4} cy={30} rx={12} ry={6} fill={p.water} opacity={0.85} />
          <ellipse cx={2} cy={28} rx={6} ry={2.5} fill={p.waterHighlight} opacity={0.4} />
          <circle cx={-22} cy={26} r={3.5} fill={p.flowerPink} />
          <circle cx={24} cy={14} r={3.5} fill={p.flowerYellow} />
          <rect x={-4} y={22} width={10} height={3} fill={p.wood} />
        </g>
      );
    case "portal":
      return (
        <g>
          <Shadow />
          <ellipse cx={0} cy={18} rx={20} ry={8} fill={p.portalGlow} opacity={0.4} />
          <ellipse
            cx={0}
            cy={2}
            rx={15}
            ry={22}
            fill="none"
            stroke={p.portalRing}
            strokeWidth={5}
          />
          <ellipse cx={0} cy={2} rx={11} ry={17} fill={p.portalGlow} opacity={0.55} />
          <ellipse cx={0} cy={-2} rx={7} ry={12} fill="#F4FAFF" opacity={0.85} />
          <circle cx={0} cy={2} r={3} fill="#FFFFFF" opacity={0.7} />
        </g>
      );
    case "landmark_space_center":
    case "space_center":
      // 4×4 launch pad: diamond centre is (0, 64); bottom tip is (0, 128).
      return (
        <g>
          <Shadow w={4} h={4} />
          <IsoBase w={4} h={4} fill={p.grassMid} />
          {/* Paved pad with a darker inner ring */}
          <polygon
            points="0,18 100,64 0,110 -100,64"
            fill={p.pathStone}
            stroke={p.outline}
            strokeWidth={0.8}
          />
          <polygon
            points="0,34 68,64 0,94 -68,64"
            fill={p.stoneDark}
            stroke={p.outline}
            strokeWidth={0.8}
          />
          <polygon points="0,46 42,64 0,82 -42,64" fill={p.stone} opacity={0.8} />
          {/* Hazard dashes on the pad edge */}
          {[
            { x: 50, y: 41, r: 24.7 },
            { x: -50, y: 41, r: -24.7 },
            { x: 50, y: 87, r: -24.7 },
            { x: -50, y: 87, r: 24.7 },
          ].map((d) => (
            <rect
              key={`${d.x},${d.y}`}
              x={d.x - 6}
              y={d.y - 1.5}
              width={12}
              height={3}
              fill={p.flowerYellow}
              opacity={0.85}
              transform={`rotate(${d.r} ${d.x} ${d.y})`}
            />
          ))}
          {/* Gantry tower (left of rocket) */}
          <rect x={-34} y={-6} width={5} height={62} fill={p.woodDark} stroke={p.outline} strokeWidth={0.8} />
          <rect x={-34} y={6} width={22} height={3.5} fill={p.wood} stroke={p.outline} strokeWidth={0.6} />
          <rect x={-34} y={26} width={22} height={3.5} fill={p.wood} stroke={p.outline} strokeWidth={0.6} />
          <line x1={-34} y1={9} x2={-12} y2={26} stroke={p.woodDark} strokeWidth={1} opacity={0.6} />
          {/* Rocket silhouette */}
          <ellipse cx={0} cy={62} rx={16} ry={6} fill={p.shadow} />
          <polygon points="-11,52 -22,66 -11,64" fill={p.roofClayDark} stroke={p.outline} strokeWidth={0.9} />
          <polygon points="11,52 22,66 11,64" fill={p.roofClay} stroke={p.outline} strokeWidth={0.9} />
          <path
            d="M-11,62 L-11,-14 Q-11,-34 0,-48 Q11,-34 11,-14 L11,62 Q0,68 -11,62 Z"
            fill="#F4EEE0"
            stroke={p.outline}
            strokeWidth={1}
          />
          <path
            d="M0,-48 Q11,-34 11,-14 L11,62 Q6,65 0,66 Z"
            fill={p.wallStone}
            opacity={0.45}
          />
          <path d="M-11,-14 Q-11,-34 0,-48 Q11,-34 11,-14 Z" fill={p.roofClay} stroke={p.outline} strokeWidth={1} />
          <circle cx={0} cy={4} r={5} fill={p.windowGlow} stroke={p.outline} strokeWidth={1} />
          <rect x={-11} y={26} width={22} height={4} fill={p.roofClay} opacity={0.85} />
          <polygon points="-5,64 5,64 0,76" fill={p.flowerYellow} opacity={0.85} />
          {/* Control hut */}
          <polygon
            points="48,92 68,102 88,92 88,76 68,66 48,76"
            fill={p.wallCream}
            stroke={p.outline}
            strokeWidth={0.8}
          />
          <polygon points="68,102 88,92 88,76 68,86" fill={p.wallWarm} opacity={0.7} />
          <polygon points="44,76 68,62 92,76 68,88" fill={p.roofMoss} stroke={p.outline} strokeWidth={0.8} />
          <circle cx={62} cy={90} r={2.2} fill={p.windowGlow} />
        </g>
      );
    case "project_site": {
      if (stage === "complete") {
        return <CompletedProjectArt projectType={projectType} />;
      }
      return (
        <g>
          <Shadow w={4} h={4} />
          <IsoBase w={4} h={4} fill="#E0D0A8" />
          <rect x={-24} y={-8} width={9} height={28} fill={p.wood} opacity={0.7} />
          <rect x={12} y={2} width={9} height={22} fill={p.wood} opacity={0.55} />
          <polygon
            points="-48,12 0,-8 48,12"
            fill="none"
            stroke={p.outline}
            strokeDasharray="5 4"
            opacity={0.7}
          />
          <circle cx={-8} cy={20} r={3} fill="#C4A070" opacity={0.5} />
        </g>
      );
    }
    case "landmark_park":
    case "landmark_museum":
    case "landmark_rec":
    case "landmark_tower":
    case "landmark_university":
    case "landmark_bank":
      return <LandmarkArt definitionId={definitionId} />;
    default:
      return <IsoBase fill={p.wallCream} />;
  }
}
