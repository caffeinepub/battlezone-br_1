import {
  type AmmoType,
  BUILDING_COUNT,
  LOOT_SPOT_COUNT,
  TREE_COUNT,
  WEAPONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type WeaponType,
} from "./constants";
import type { Building, GameMap, LootItem, Road, Tree } from "./types";

let nextId = 1;
function genId() {
  return nextId++;
}

function rand(
  min: number,
  max: number,
  rng: () => number = Math.random,
): number {
  return min + rng() * (max - min);
}

function randInt(
  min: number,
  max: number,
  rng: () => number = Math.random,
): number {
  return Math.floor(rand(min, max + 1, rng));
}

// Simple seeded RNG (mulberry32)
function createRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  margin = 20,
): boolean {
  return (
    ax - margin < bx + bw &&
    ax + aw + margin > bx &&
    ay - margin < by + bh &&
    ay + ah + margin > by
  );
}

export function generateMap(seed = 42): GameMap {
  const rng = createRng(seed);
  nextId = 1;

  const roads: Road[] = [];
  const buildings: Building[] = [];
  const trees: Tree[] = [];
  const loot: LootItem[] = [];

  const MARGIN = 150;

  // Generate roads (grid-ish pattern)
  const roadWidth = 30;
  const hRoadCount = 4;
  const vRoadCount = 4;

  for (let i = 0; i < hRoadCount; i++) {
    const y =
      MARGIN + ((i + 1) * (WORLD_HEIGHT - 2 * MARGIN)) / (hRoadCount + 1);
    roads.push({
      x: 0,
      y: y - roadWidth / 2,
      w: WORLD_WIDTH,
      h: roadWidth,
      horizontal: true,
    });
  }
  for (let i = 0; i < vRoadCount; i++) {
    const x =
      MARGIN + ((i + 1) * (WORLD_WIDTH - 2 * MARGIN)) / (vRoadCount + 1);
    roads.push({
      x: x - roadWidth / 2,
      y: 0,
      w: roadWidth,
      h: WORLD_HEIGHT,
      horizontal: false,
    });
  }

  // Generate buildings
  let attempts = 0;
  while (buildings.length < BUILDING_COUNT && attempts < 2000) {
    attempts++;
    const w = rand(60, 150, rng);
    const h = rand(60, 150, rng);
    const x = rand(MARGIN, WORLD_WIDTH - MARGIN - w, rng);
    const y = rand(MARGIN, WORLD_HEIGHT - MARGIN - h, rng);

    // Keep away from center spawn area
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    const distFromCenter = Math.hypot(x + w / 2 - cx, y + h / 2 - cy);
    if (distFromCenter < 120) continue;

    // Check overlap with other buildings
    let overlap = false;
    for (const b of buildings) {
      if (rectsOverlap(x, y, w, h, b.x, b.y, b.w, b.h)) {
        overlap = true;
        break;
      }
    }
    if (!overlap) {
      buildings.push({ id: genId(), x, y, w, h });
    }
  }

  // Generate trees
  let treeAttempts = 0;
  while (trees.length < TREE_COUNT && treeAttempts < 5000) {
    treeAttempts++;
    const radius = rand(15, 25, rng);
    const x = rand(MARGIN, WORLD_WIDTH - MARGIN, rng);
    const y = rand(MARGIN, WORLD_HEIGHT - MARGIN, rng);

    // Don't spawn on buildings
    let onBuilding = false;
    for (const b of buildings) {
      if (
        x > b.x - 20 &&
        x < b.x + b.w + 20 &&
        y > b.y - 20 &&
        y < b.y + b.h + 20
      ) {
        onBuilding = true;
        break;
      }
    }
    if (onBuilding) continue;

    // Keep away from center
    if (Math.hypot(x - WORLD_WIDTH / 2, y - WORLD_HEIGHT / 2) < 80) continue;

    trees.push({ id: genId(), x, y, radius });
  }

  // Generate loot
  const weaponTypes: WeaponType[] = ["pistol", "shotgun", "ar", "sniper"];
  const ammoTypes: AmmoType[] = ["pistol", "shotgun", "rifle", "sniper"];

  // Loot near buildings
  for (const building of buildings) {
    const numLoot = randInt(1, 3, rng);
    for (let i = 0; i < numLoot; i++) {
      const side = randInt(0, 3, rng);
      let lx: number;
      let ly: number;
      switch (side) {
        case 0:
          lx = rand(building.x, building.x + building.w, rng);
          ly = building.y - 25;
          break;
        case 1:
          lx = building.x + building.w + 25;
          ly = rand(building.y, building.y + building.h, rng);
          break;
        case 2:
          lx = rand(building.x, building.x + building.w, rng);
          ly = building.y + building.h + 25;
          break;
        default:
          lx = building.x - 25;
          ly = rand(building.y, building.y + building.h, rng);
          break;
      }

      loot.push(createRandomLoot(lx, ly, rng));
    }
  }

  // Additional scattered loot
  while (loot.length < LOOT_SPOT_COUNT + buildings.length * 2) {
    const x = rand(MARGIN, WORLD_WIDTH - MARGIN, rng);
    const y = rand(MARGIN, WORLD_HEIGHT - MARGIN, rng);
    loot.push(createRandomLoot(x, y, rng));
  }

  // Ensure at least some weapons are placed
  for (let i = 0; i < 15; i++) {
    const x = rand(MARGIN, WORLD_WIDTH - MARGIN, rng);
    const y = rand(MARGIN, WORLD_HEIGHT - MARGIN, rng);
    const wType = weaponTypes[i % 4];
    loot.push({
      id: genId(),
      x,
      y,
      type: "weapon",
      weaponType: wType,
      picked: false,
    });
  }

  // Extra ammo packs
  for (let i = 0; i < 20; i++) {
    const x = rand(MARGIN, WORLD_WIDTH - MARGIN, rng);
    const y = rand(MARGIN, WORLD_HEIGHT - MARGIN, rng);
    const aType = ammoTypes[i % 4];
    const amounts: Record<AmmoType, number> = {
      pistol: 12,
      shotgun: 6,
      rifle: 30,
      sniper: 5,
    };
    loot.push({
      id: genId(),
      x,
      y,
      type: "ammo",
      ammoType: aType,
      ammoAmount: amounts[aType],
      picked: false,
    });
  }

  // Ensure at least 10 health packs and 5 armor vests around the map
  for (let i = 0; i < 10; i++) {
    const x = rand(MARGIN, WORLD_WIDTH - MARGIN, rng);
    const y = rand(MARGIN, WORLD_HEIGHT - MARGIN, rng);
    loot.push({
      id: genId(),
      x,
      y,
      type: "health",
      healAmount: 30,
      picked: false,
    });
  }
  for (let i = 0; i < 5; i++) {
    const x = rand(MARGIN, WORLD_WIDTH - MARGIN, rng);
    const y = rand(MARGIN, WORLD_HEIGHT - MARGIN, rng);
    loot.push({
      id: genId(),
      x,
      y,
      type: "armor",
      armorAmount: 50,
      picked: false,
    });
  }

  return { buildings, trees, roads, loot };
}

function createRandomLoot(x: number, y: number, rng: () => number): LootItem {
  const r = rng();
  const weaponTypes: WeaponType[] = ["pistol", "shotgun", "ar", "sniper"];
  const ammoTypes: AmmoType[] = ["pistol", "shotgun", "rifle", "sniper"];

  if (r < 0.25) {
    const wType = weaponTypes[Math.floor(rng() * 4)];
    return {
      id: genId(),
      x,
      y,
      type: "weapon",
      weaponType: wType,
      picked: false,
    };
  }
  if (r < 0.45) {
    const aType = ammoTypes[Math.floor(rng() * 4)];
    const amounts: Record<AmmoType, number> = {
      pistol: 12,
      shotgun: 6,
      rifle: 30,
      sniper: 5,
    };
    return {
      id: genId(),
      x,
      y,
      type: "ammo",
      ammoType: aType,
      ammoAmount: amounts[aType],
      picked: false,
    };
  }
  if (r < 0.65) {
    return { id: genId(), x, y, type: "health", healAmount: 30, picked: false };
  }
  if (r < 0.8) {
    return {
      id: genId(),
      x,
      y,
      type: "bandage",
      healAmount: 15,
      picked: false,
    };
  }
  return { id: genId(), x, y, type: "armor", armorAmount: 50, picked: false };
}

export function createInitialSafeZone() {
  return {
    centerX: WORLD_WIDTH / 2,
    centerY: WORLD_HEIGHT / 2,
    radius: 1400,
    nextCenterX: WORLD_WIDTH / 2 + 80,
    nextCenterY: WORLD_HEIGHT / 2 - 60,
    nextRadius: 900,
    phase: 0,
    phaseState: "wait" as const,
    phaseTimer: 60000,
    damage: 2,
  };
}
