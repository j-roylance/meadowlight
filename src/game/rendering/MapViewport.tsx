"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { CityState, PlacedEntity, ToolMode, WorldCoord } from "@/game/types";

const VoxelMapCanvas = dynamic(
  () =>
    import("./voxel/VoxelMapCanvas").then((m) => m.VoxelMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <div className="meadow-panel p-4 meadow-title text-xl">Sculpting the meadow…</div>
      </div>
    ),
  }
);

interface Props {
  city: CityState;
  readOnly?: boolean;
  tool: ToolMode;
  buildDefId?: string;
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
  /** Decorative / login backdrop: no pan/zoom/click. */
  interactive?: boolean;
  initialCam?: { x: number; y: number; zoom: number };
}

/** City map viewport — full-voxel Three.js isometric view. */
export function MapViewport(props: Props) {
  return <VoxelMapCanvas {...props} />;
}
