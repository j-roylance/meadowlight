/** Demo tools / simulated neighbors unlock only when the map name is exactly "demo". */
export function isDemoMapName(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "demo";
}
