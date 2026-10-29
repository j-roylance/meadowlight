import type { PlacedEntity } from "@/game/types";

/** Finished Space Center project site (or legacy direct-build entity). */
export function isSpaceCenterEntity(e: PlacedEntity): boolean {
  if (e.stored) return false;
  if (e.definitionId === "space_center") return true;
  return (
    e.definitionId === "project_site" &&
    e.appearance?.stage === "complete" &&
    e.appearance.projectType === "space_center"
  );
}
