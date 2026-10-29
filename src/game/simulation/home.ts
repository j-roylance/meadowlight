import {
  FURNITURE,
  GRANT_STARTER_HOME_KIT,
  STARTER_HOME_ITEMS,
  getFurniture,
  type FurnitureDefId,
} from "@/game/catalog/expansion";
import type {
  BackyardScene,
  CityState,
  ExpansionState,
  HomeBinding,
  InteriorRoom,
  InteriorScene,
  InventoryItem,
  PlacedEntity,
  SceneItemPlacement,
} from "@/game/types";
import { createEmptyBed } from "./garden";
import { v4 as uuid } from "uuid";

const HOUSE_IDS = new Set(["cottage_a", "cottage_b", "cottage_c"]);

export function isResidentialHouse(entity: PlacedEntity): boolean {
  return HOUSE_IDS.has(entity.definitionId) && !entity.stored;
}

export function defaultInteriorRooms(): InteriorRoom[] {
  // 8×8 arranged into living, sleeping, kitchen, bathroom zones.
  return [
    { id: "room-living", x: 0, y: 0, w: 4, h: 4, zone: "living", wallpaper: "cream", flooring: "oak" },
    { id: "room-sleep", x: 4, y: 0, w: 4, h: 4, zone: "sleeping", wallpaper: "cream", flooring: "oak" },
    { id: "room-kitchen", x: 0, y: 4, w: 4, h: 4, zone: "kitchen", wallpaper: "sage", flooring: "tile" },
    { id: "room-bath", x: 4, y: 4, w: 4, h: 4, zone: "bathroom", wallpaper: "sage", flooring: "tile" },
  ];
}

function grantStarterKit(expansion: ExpansionState): ExpansionState {
  if (expansion.grants[GRANT_STARTER_HOME_KIT]) return expansion;
  const items: InventoryItem[] = [];
  for (const entry of STARTER_HOME_ITEMS) {
    for (let i = 0; i < entry.count; i++) {
      items.push({
        id: uuid(),
        kind: "furniture",
        definitionId: entry.definitionId,
        quantity: 1,
        instanceId: uuid(),
      });
    }
  }
  // One empty raised bed in inventory / ready for backyard starter placement.
  items.push({
    id: uuid(),
    kind: "furniture",
    definitionId: "raised_bed",
    quantity: 1,
    instanceId: uuid(),
    bedState: createEmptyBed(),
  });
  return {
    ...expansion,
    grants: { ...expansion.grants, [GRANT_STARTER_HOME_KIT]: true },
    inventory: [...expansion.inventory, ...items],
  };
}

export function ensureHomeScenes(
  city: CityState,
  houseEntityId: string
): { city: CityState; binding: HomeBinding } {
  let expansion = city.expansion;
  const existing = expansion.homes[houseEntityId];
  if (existing) {
    return { city, binding: existing };
  }

  const interiorId = uuid();
  const backyardId = uuid();
  const interior: InteriorScene = {
    id: interiorId,
    kind: "interior",
    houseEntityId,
    rooms: defaultInteriorRooms(),
    items: [],
    revision: 1,
  };
  const backyard: BackyardScene = {
    id: backyardId,
    kind: "backyard",
    houseEntityId,
    width: 12,
    height: 12,
    items: [],
    revision: 1,
  };

  expansion = grantStarterKit(expansion);

  // Place the starter empty raised bed into backyard once on first home init.
  const bedInv = expansion.inventory.find((i) => i.definitionId === "raised_bed" && i.bedState);
  if (bedInv) {
    backyard.items.push({
      itemId: bedInv.instanceId ?? bedInv.id,
      definitionId: "raised_bed",
      x: 5,
      y: 5,
      rotation: 0,
      layer: "furniture",
      roomId: "backyard",
      bedState: bedInv.bedState,
    });
    expansion = {
      ...expansion,
      inventory: expansion.inventory.filter((i) => i.id !== bedInv.id),
    };
  }

  // Modest seating area.
  const bench = expansion.inventory.find((i) => i.definitionId === "bench");
  if (bench) {
    backyard.items.push({
      itemId: bench.instanceId ?? bench.id,
      definitionId: "bench",
      x: 2,
      y: 8,
      rotation: 0,
      layer: "furniture",
      roomId: "backyard",
    });
    expansion = {
      ...expansion,
      inventory: expansion.inventory.filter((i) => i.id !== bench.id),
    };
  }

  const binding: HomeBinding = {
    houseEntityId,
    interiorSceneId: interiorId,
    backyardSceneId: backyardId,
  };

  expansion = {
    ...expansion,
    homes: { ...expansion.homes, [houseEntityId]: binding },
    interiors: { ...expansion.interiors, [interiorId]: interior },
    backyards: { ...expansion.backyards, [backyardId]: backyard },
  };

  return { city: { ...city, expansion }, binding };
}

export function designatePrimaryHome(
  city: CityState,
  houseEntityId: string
): { ok: true; city: CityState } | { ok: false; error: string } {
  const entity = city.entities.find((e) => e.id === houseEntityId);
  if (!entity || !isResidentialHouse(entity)) {
    return { ok: false, error: "Select an owned placed house" };
  }
  const ensured = ensureHomeScenes(city, houseEntityId);
  const city2 = {
    ...ensured.city,
    expansion: {
      ...ensured.city.expansion,
      primaryHomeEntityId: houseEntityId,
    },
  };
  return { ok: true, city: city2 };
}

export function footprintTiles(
  defId: string,
  x: number,
  y: number,
  rotation: 0 | 90 | 180 | 270
): { x: number; y: number }[] {
  const def = getFurniture(defId);
  const w = def?.footprint.w ?? 1;
  const h = def?.footprint.h ?? 1;
  const rw = rotation === 90 || rotation === 270 ? h : w;
  const rh = rotation === 90 || rotation === 270 ? w : h;
  const tiles: { x: number; y: number }[] = [];
  for (let dx = 0; dx < rw; dx++) {
    for (let dy = 0; dy < rh; dy++) tiles.push({ x: x + dx, y: y + dy });
  }
  return tiles;
}

export function validateInteriorPlacement(
  scene: InteriorScene,
  defId: string,
  x: number,
  y: number,
  rotation: 0 | 90 | 180 | 270,
  roomId: string,
  ignoreItemId?: string
): { ok: true } | { ok: false; error: string } {
  const def = getFurniture(defId);
  if (!def) return { ok: false, error: "Unknown furniture" };
  if (def.outdoor && !def.indoor) return { ok: false, error: "Outdoor-only item" };
  const room = scene.rooms.find((r) => r.id === roomId);
  if (!room) return { ok: false, error: "Unknown room" };
  const tiles = footprintTiles(defId, x, y, rotation);
  for (const t of tiles) {
    if (t.x < room.x || t.y < room.y || t.x >= room.x + room.w || t.y >= room.y + room.h) {
      return { ok: false, error: "Does not fit in this room" };
    }
  }
  // Door access: keep (room.x, room.y) clear of blocking furniture as doorway.
  const door = { x: room.x, y: room.y };
  if (def.blocks && tiles.some((t) => t.x === door.x && t.y === door.y)) {
    return { ok: false, error: "Blocks doorway access" };
  }
  for (const other of scene.items) {
    if (ignoreItemId && other.itemId === ignoreItemId) continue;
    if (other.roomId !== roomId) continue;
    const otherDef = getFurniture(other.definitionId);
    if (!otherDef) continue;
    // Rugs (floor) can sit under furniture; solid furniture cannot overlap.
    if (!def.blocks && def.layer === "floor") continue;
    if (!otherDef.blocks && otherDef.layer === "floor") continue;
    if (!def.blocks || !otherDef.blocks) {
      if (def.layer === other.layer || (def.blocks && otherDef.blocks)) {
        // allow overlay on furniture
        if (def.layer === "overlay" || other.layer === "overlay") continue;
        if (def.layer === "wall" || other.layer === "wall") continue;
      }
    }
    if (!(def.blocks && otherDef.blocks)) continue;
    const otherTiles = footprintTiles(other.definitionId, other.x, other.y, other.rotation);
    for (const t of tiles) {
      if (otherTiles.some((o) => o.x === t.x && o.y === t.y)) {
        return { ok: false, error: "Overlaps another item" };
      }
    }
  }
  return { ok: true };
}

export function validateBackyardPlacement(
  scene: BackyardScene,
  defId: string,
  x: number,
  y: number,
  rotation: 0 | 90 | 180 | 270,
  ignoreItemId?: string
): { ok: true } | { ok: false; error: string } {
  const def = getFurniture(defId);
  if (!def) return { ok: false, error: "Unknown item" };
  if (def.indoor && !def.outdoor) return { ok: false, error: "Indoor-only item" };
  const tiles = footprintTiles(defId, x, y, rotation);
  for (const t of tiles) {
    if (t.x < 0 || t.y < 0 || t.x >= scene.width || t.y >= scene.height) {
      return { ok: false, error: "Outside backyard bounds" };
    }
  }
  for (const other of scene.items) {
    if (ignoreItemId && other.itemId === ignoreItemId) continue;
    const otherDef = getFurniture(other.definitionId);
    if (!otherDef?.blocks || !def.blocks) continue;
    const otherTiles = footprintTiles(other.definitionId, other.x, other.y, other.rotation);
    for (const t of tiles) {
      if (otherTiles.some((o) => o.x === t.x && o.y === t.y)) {
        return { ok: false, error: "Overlaps another item" };
      }
    }
  }
  return { ok: true };
}

export function addInteriorRoom(
  scene: InteriorScene
): { ok: true; scene: InteriorScene } | { ok: false; error: string } {
  // Attach a 4×4 addition to the east of living/sleeping if free.
  const occupied = new Set(scene.rooms.map((r) => `${r.x},${r.y}`));
  const candidates = [
    { x: 8, y: 0 },
    { x: 8, y: 4 },
    { x: 0, y: 8 },
    { x: 4, y: 8 },
  ];
  const spot = candidates.find((c) => !occupied.has(`${c.x},${c.y}`));
  if (!spot) return { ok: false, error: "No valid doorway attachment left" };
  const room: InteriorRoom = {
    id: uuid(),
    x: spot.x,
    y: spot.y,
    w: 4,
    h: 4,
    zone: "addition",
    wallpaper: "cream",
    flooring: "oak",
  };
  return {
    ok: true,
    scene: {
      ...scene,
      rooms: [...scene.rooms, room],
      revision: scene.revision + 1,
    },
  };
}

export function placeFromInventory(
  expansion: ExpansionState,
  inventoryItemId: string,
  placement: Omit<SceneItemPlacement, "itemId" | "definitionId" | "bedState"> & {
    definitionId?: string;
  }
): {
  ok: true;
  expansion: ExpansionState;
  placement: SceneItemPlacement;
} | { ok: false; error: string } {
  const inv = expansion.inventory.find((i) => i.id === inventoryItemId);
  if (!inv) return { ok: false, error: "Item not in inventory" };
  const defId = (inv.definitionId as FurnitureDefId) || placement.definitionId;
  if (!defId || !FURNITURE[defId as FurnitureDefId]) {
    return { ok: false, error: "Not placeable furniture" };
  }
  const placed: SceneItemPlacement = {
    itemId: inv.instanceId ?? inv.id,
    definitionId: defId,
    x: placement.x,
    y: placement.y,
    rotation: placement.rotation,
    layer: placement.layer || FURNITURE[defId as FurnitureDefId].layer,
    palette: placement.palette ?? inv.palette,
    roomId: placement.roomId,
    bedState: inv.bedState,
  };
  return {
    ok: true,
    expansion: {
      ...expansion,
      inventory: expansion.inventory.filter((i) => i.id !== inv.id),
    },
    placement: placed,
  };
}

export function storeSceneItem(
  expansion: ExpansionState,
  item: SceneItemPlacement
): ExpansionState {
  const inv: InventoryItem = {
    id: uuid(),
    kind: "furniture",
    definitionId: item.definitionId,
    quantity: 1,
    instanceId: item.itemId,
    palette: item.palette,
    bedState: item.bedState,
  };
  return { ...expansion, inventory: [...expansion.inventory, inv] };
}
