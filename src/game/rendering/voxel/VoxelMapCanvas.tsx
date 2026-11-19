"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ViewRotation } from "@/game/simulation/coords";
import { findEntityAt } from "@/game/simulation/placement";
import type { BuildingDefId, CityState, PlacedEntity, ToolMode, WorldCoord } from "@/game/types";
import { palette } from "@/game/rendering/palette";
import {
  TerrainLayer,
  RoadPreviewLayer,
  TERRAIN_RADIUS,
  clampZoom,
  viewSizeForZoom,
} from "./TerrainLayer";
import { BuildingsLayer, GhostBuilding } from "./BuildingsLayer";
import { Walkers3D } from "./Walkers3D";
import { resolveWorldSample } from "@/game/simulation/terrain";
import { VOXELS_PER_TILE, terrainY, tileToWorld, worldToTile } from "./voxelScale";

export interface VoxelMapProps {
  city: CityState;
  readOnly?: boolean;
  tool: ToolMode;
  buildDefId?: string;
  /** Hosted project being placed — ghost shows the finished building. */
  pendingProjectId?: string;
  ghostValid?: boolean;
  ghostReason?: ReactNode;
  roadPreview?: WorldCoord[];
  selectedEntityId?: string | null;
  selectedHarvest?: { x: bigint; y: bigint; kind: "tree" | "stone_pile" } | null;
  onTileClick?: (x: bigint, y: bigint) => void;
  onTileHover?: (x: bigint, y: bigint) => void;
  onEntityClick?: (entity: PlacedEntity) => void;
  reducedMotion?: boolean;
  interactive?: boolean;
  initialCam?: { x: number; y: number; zoom: number };
}

/** Classic isometric elevation — kept constant so rotate is a clean 90° orbit. */
const VIEW_ELEVATION = Math.atan(1 / Math.sqrt(2));
/** Wall-clock duration for a 90° camera turn. */
const ROTATE_MS = 1000;

function entityAtTile(city: CityState, tx: bigint, ty: bigint): PlacedEntity | undefined {
  return findEntityAt(city, tx, ty) ?? undefined;
}

function shortestAngleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function azimForRot(rot: ViewRotation): number {
  return Math.PI / 4 + rot * (Math.PI / 2);
}

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function CameraRig({
  cam,
  rot,
  reducedMotion,
}: {
  cam: { x: number; y: number; zoom: number };
  rot: ViewRotation;
  reducedMotion?: boolean;
}) {
  const { camera, size } = useThree();
  const azimRef = useRef(azimForRot(0));
  const elevRef = useRef(VIEW_ELEVATION);
  const targetRef = useRef(new THREE.Vector3());
  const rotAnim = useRef<{
    from: number;
    delta: number;
    startMs: number;
  } | null>(null);
  const prevRot = useRef(rot);

  // Kick a 1s azimuth tween whenever the discrete view rotation changes
  useEffect(() => {
    if (prevRot.current === rot) return;
    prevRot.current = rot;
    const to = azimForRot(rot);
    if (reducedMotion) {
      azimRef.current = to;
      rotAnim.current = null;
      return;
    }
    rotAnim.current = {
      from: azimRef.current,
      delta: shortestAngleDelta(azimRef.current, to),
      startMs: performance.now(),
    };
  }, [rot, reducedMotion]);

  useFrame(() => {
    const ortho = camera as THREE.OrthographicCamera;
    const aspect = size.width / Math.max(1, size.height);
    // Zoom maps 1:1 onto ortho size (clamping happens when zoom state changes).
    const zoom = clampZoom(cam.zoom, aspect);
    const viewSize = viewSizeForZoom(zoom);
    ortho.left = -viewSize * aspect;
    ortho.right = viewSize * aspect;
    ortho.top = viewSize;
    ortho.bottom = -viewSize;
    ortho.near = 0.1;
    ortho.far = 800;
    ortho.updateProjectionMatrix();

    const anim = rotAnim.current;
    if (anim) {
      const t = smoothstep01((performance.now() - anim.startMs) / ROTATE_MS);
      azimRef.current = anim.from + anim.delta * t;
      if (t >= 1) {
        azimRef.current = anim.from + anim.delta;
        rotAnim.current = null;
      }
    } else if (reducedMotion) {
      azimRef.current = azimForRot(rot);
    }
    elevRef.current = VIEW_ELEVATION;

    const target = targetRef.current;
    target.set(
      tileToWorld(cam.x) + VOXELS_PER_TILE * 0.5,
      2.5,
      tileToWorld(cam.y) + VOXELS_PER_TILE * 0.5
    );

    const dist = 42;
    const azim = azimRef.current;
    const elev = elevRef.current;
    ortho.position.set(
      target.x + dist * Math.sin(azim) * Math.cos(elev),
      target.y + dist * Math.sin(elev),
      target.z + dist * Math.cos(azim) * Math.cos(elev)
    );
    ortho.up.set(0, 1, 0);
    ortho.lookAt(target);
    ortho.updateMatrixWorld();
  });

  return null;
}

/** Soft fog that hugs the terrain square edge so any residual skirt stays hidden. */
function FogForView() {
  const near = Math.max(40, TERRAIN_RADIUS * 0.85);
  const far = Math.max(near + 30, TERRAIN_RADIUS * 1.55 + 42);
  return <fog attach="fog" args={["#D4E8C8", near, far]} />;
}

function SceneContent({
  city,
  cam,
  rot,
  roadPreview,
  selectedEntityId,
  selectedHarvest,
  ghost,
  reducedMotion,
}: {
  city: CityState;
  cam: { x: number; y: number; zoom: number };
  rot: ViewRotation;
  roadPreview: WorldCoord[];
  selectedEntityId?: string | null;
  selectedHarvest?: { x: bigint; y: bigint; kind: "tree" | "stone_pile" } | null;
  ghost: {
    defId?: BuildingDefId;
    tile: WorldCoord | null;
    valid?: boolean;
    show: boolean;
    projectType?: string;
  };
  reducedMotion?: boolean;
}) {
  return (
    <>
      <CameraRig cam={cam} rot={rot} reducedMotion={reducedMotion} />
      <color attach="background" args={[palette.creamDeep]} />
      <FogForView />
      <ambientLight intensity={0.72} />
      <directionalLight
        position={[20, 35, 15]}
        intensity={1.05}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-near={5}
        shadow-camera-far={160}
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
      />
      <hemisphereLight args={["#B8D4E8", "#8B6A45", 0.35]} />

      <TerrainLayer
        city={city}
        camX={cam.x}
        camY={cam.y}
        rot={rot}
        zoom={cam.zoom}
        selectedHarvest={selectedHarvest}
      />
      <BuildingsLayer city={city} selectedEntityId={selectedEntityId} />
      <Walkers3D city={city} reducedMotion={reducedMotion} />
      {roadPreview.length > 0 && <RoadPreviewLayer tiles={roadPreview} city={city} />}
      {ghost.show && ghost.defId && ghost.tile && (
        <GhostBuilding
          city={city}
          defId={ghost.defId}
          tile={ghost.tile}
          valid={ghost.valid}
          projectType={ghost.projectType}
        />
      )}
    </>
  );
}

/**
 * Pick the world tile under the cursor.
 * Intersects a horizontal plane at the local terrain surface (not Y=0) so the
 * ghost tracks the cursor on raised meadow columns.
 */
function pickWorldTile(
  clientX: number,
  clientY: number,
  el: HTMLElement,
  camera: THREE.Camera,
  city: CityState
): { x: bigint; y: bigint } | null {
  const rect = el.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  let planeY = 3; // town-green default; refined from the hit tile
  for (let i = 0; i < 4; i++) {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    const tx = BigInt(worldToTile(hit.x));
    const ty = BigInt(worldToTile(hit.z));
    const sample = resolveWorldSample(city, tx, ty);
    const h = sample.kind === "water" ? 0 : sample.height;
    // Top of the surface voxel (matches building/ghost footing)
    const nextY = terrainY(h) + 1;
    if (Math.abs(nextY - planeY) < 0.05) {
      return { x: tx, y: ty };
    }
    planeY = nextY;
  }
  return {
    x: BigInt(worldToTile(hit.x)),
    y: BigInt(worldToTile(hit.z)),
  };
}

function CameraBridge({ cameraRef }: { cameraRef: React.MutableRefObject<THREE.Camera | null> }) {
  const { camera } = useThree();
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera, cameraRef]);
  return null;
}

export function VoxelMapCanvas({
  city,
  readOnly,
  tool,
  buildDefId,
  pendingProjectId,
  ghostValid,
  ghostReason,
  roadPreview = [],
  selectedEntityId,
  selectedHarvest,
  onTileClick,
  onTileHover,
  onEntityClick,
  reducedMotion,
  interactive = true,
  initialCam,
}: VoxelMapProps) {
  const startCam = initialCam ?? { x: 2, y: 2, zoom: 1 };
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const camRef = useRef({ ...startCam });
  const rotRef = useRef<ViewRotation>(0);
  const cityRef = useRef(city);
  cityRef.current = city;
  const [cam, setCam] = useState({ ...startCam });
  const [rot, setRot] = useState<ViewRotation>(0);
  const [hover, setHover] = useState<WorldCoord | null>(null);
  const drag = useRef<{
    active: boolean;
    moved: boolean;
    sx: number;
    sy: number;
    cx: number;
    cy: number;
  } | null>(null);

  // Keep stored zoom inside the aspect-safe range when the map resizes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => {
      const aspect = el.clientWidth / Math.max(1, el.clientHeight);
      const zoom = clampZoom(camRef.current.zoom, aspect);
      if (zoom === camRef.current.zoom) return;
      const next = { ...camRef.current, zoom };
      camRef.current = next;
      setCam(next);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pickTile = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    const camera = cameraRef.current;
    if (!el || !camera) return null;
    // Keep camera matrices in sync with the latest CameraRig frame
    camera.updateMatrixWorld();
    return pickWorldTile(clientX, clientY, el, camera, cityRef.current);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    const c = camRef.current;
    drag.current = {
      active: true,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      cx: c.x,
      cy: c.y,
    };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive) return;
    if (!drag.current?.active) {
      if (
        tool === "build" ||
        tool === "portal" ||
        tool === "project" ||
        tool === "road" ||
        tool === "erase_road" ||
        tool === "inspect"
      ) {
        const t = pickTile(e.clientX, e.clientY);
        if (t) {
          setHover((prev) => (prev && prev.x === t.x && prev.y === t.y ? prev : t));
          onTileHover?.(t.x, t.y);
        }
      }
      return;
    }

    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.current.moved = true;

    const zoom = camRef.current.zoom;
    const r = rotRef.current;
    const azim = Math.PI / 4 + r * (Math.PI / 2);
    const sens = 0.045 / zoom;
    const forwardX = Math.sin(azim);
    const forwardZ = Math.cos(azim);
    const rightX = Math.cos(azim);
    const rightZ = -Math.sin(azim);
    const next = {
      x: drag.current.cx - dx * sens * rightX - dy * sens * forwardX,
      y: drag.current.cy - dx * sens * rightZ - dy * sens * forwardZ,
      zoom,
    };
    camRef.current = next;
    setCam(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!interactive) return;
    const d = drag.current;
    drag.current = null;
    setCam({ ...camRef.current });
    if (!d || d.moved) return;
    const t = pickTile(e.clientX, e.clientY);
    if (!t) return;
    const ent = entityAtTile(city, t.x, t.y);
    if (
      ent &&
      (tool === "inspect" ||
        tool === "move" ||
        tool === "store" ||
        tool === "build" ||
        tool === "portal" ||
        tool === "project")
    ) {
      onEntityClick?.(ent);
    } else {
      onTileClick?.(t.x, t.y);
    }
  };

  const aspectNow = () => {
    const el = containerRef.current;
    if (!el) return 1.6;
    return el.clientWidth / Math.max(1, el.clientHeight);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    const nextZoom = clampZoom(
      camRef.current.zoom * (e.deltaY > 0 ? 0.9 : 1.1),
      aspectNow()
    );
    const next = { ...camRef.current, zoom: nextZoom };
    camRef.current = next;
    setCam(next);
  };

  const jumpTo = (x: number, y: number) => {
    const next = { ...camRef.current, x, y };
    camRef.current = next;
    setCam(next);
  };

  const setZoom = (factor: number) => {
    const next = {
      ...camRef.current,
      zoom: clampZoom(camRef.current.zoom * factor, aspectNow()),
    };
    camRef.current = next;
    setCam(next);
  };

  const rotateBy = (delta: 1 | 3) => {
    const nextRot = (((rotRef.current + delta) % 4) + 4) % 4 as ViewRotation;
    rotRef.current = nextRot;
    setRot(nextRot);
  };

  /** Map chrome must not start a pan / steal the click via pointer capture. */
  const stopMapPointer = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
  };

  const ghostTile = hover;
  const showGhost =
    Boolean(ghostTile && buildDefId) &&
    (tool === "build" || tool === "portal" || tool === "project") &&
    !readOnly;

  const tip = useMemo(() => ghostReason ?? null, [ghostReason]);

  return (
    <div
      className="relative h-full w-full overflow-hidden select-none touch-none"
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      role="img"
      aria-label="City map"
    >
      <Canvas
        orthographic
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false }}
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(180deg, #B8D4E8 0%, #D4E8C8 35%, ${palette.creamDeep} 100%)`,
        }}
      >
        <CameraBridge cameraRef={cameraRef} />
        <SceneContent
          city={city}
          cam={cam}
          rot={rot}
          roadPreview={roadPreview}
          selectedEntityId={selectedEntityId}
          selectedHarvest={selectedHarvest}
          reducedMotion={reducedMotion}
          ghost={{
            defId: buildDefId as BuildingDefId | undefined,
            tile: ghostTile,
            valid: ghostValid,
            show: showGhost,
            projectType:
              tool === "project" ? pendingProjectId ?? undefined : undefined,
          }}
        />
      </Canvas>

      {interactive && (
        <div
          className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2"
          onPointerDown={stopMapPointer}
          onPointerUp={stopMapPointer}
          onPointerMove={stopMapPointer}
        >
          <button
            type="button"
            className="meadow-btn"
            onClick={() => jumpTo(1, 1)}
            aria-label="Jump to town hall"
          >
            Town hall
          </button>
          <button
            type="button"
            className="meadow-btn"
            onClick={() => setZoom(1.15)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="meadow-btn"
            onClick={() => setZoom(0.87)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="meadow-btn"
            onClick={() => rotateBy(3)}
            aria-label="Rotate view 90 degrees left"
            title="Rotate view 90° left"
          >
            Rotate L
          </button>
          <button
            type="button"
            className="meadow-btn"
            onClick={() => rotateBy(1)}
            aria-label="Rotate view 90 degrees right"
            title="Rotate view 90° right"
          >
            Rotate R
          </button>
        </div>
      )}

      {interactive && tip && (tool === "inspect" ? hover : ghostTile) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 meadow-chip max-w-[90%] text-sm z-10">
          {tip}
        </div>
      )}

      {interactive && readOnly && (
        <div className="absolute top-3 left-3 meadow-chip bg-amber-100/90 text-amber-950 z-10">
          Visiting — read only
        </div>
      )}
    </div>
  );
}
