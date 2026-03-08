// World dimensions
export const WORLD_WIDTH = 3000;
export const WORLD_HEIGHT = 3000;

// Player constants
export const PLAYER_RADIUS = 14;
export const PLAYER_SPEED = 180;
export const PLAYER_SPRINT_MULTIPLIER = 1.6;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_MAX_ARMOR = 100;
export const LOOT_PICKUP_RADIUS = 30;

// Bot constants
export const BOT_COUNT = 20;
export const BOT_RADIUS = 14;
export const BOT_SPEED = 155;
export const BOT_CHASE_RANGE = 400;
export const BOT_ATTACK_RANGE = 220;
export const BOT_RETREAT_HEALTH = 30;
export const BOT_SIGHT_RANGE = 500;

// Bullet constants
export const BULLET_RADIUS = 4;

// Safe zone constants
export const ZONE_CENTER_X = WORLD_WIDTH / 2;
export const ZONE_CENTER_Y = WORLD_HEIGHT / 2;
export const ZONE_INITIAL_RADIUS = 1400;

// Zone phases: [waitMs, shrinkMs, newRadius, centerOffsetX, centerOffsetY, damagePerSec]
export const ZONE_PHASES: Array<{
  waitMs: number;
  shrinkMs: number;
  newRadius: number;
  offsetX: number;
  offsetY: number;
  damage: number;
}> = [
  {
    waitMs: 60000,
    shrinkMs: 30000,
    newRadius: 900,
    offsetX: 80,
    offsetY: -60,
    damage: 2,
  },
  {
    waitMs: 45000,
    shrinkMs: 25000,
    newRadius: 550,
    offsetX: -50,
    offsetY: 80,
    damage: 4,
  },
  {
    waitMs: 30000,
    shrinkMs: 20000,
    newRadius: 300,
    offsetX: 40,
    offsetY: -40,
    damage: 6,
  },
  {
    waitMs: 20000,
    shrinkMs: 15000,
    newRadius: 140,
    offsetX: -30,
    offsetY: 30,
    damage: 8,
  },
  {
    waitMs: 10000,
    shrinkMs: 10000,
    newRadius: 50,
    offsetX: 0,
    offsetY: 0,
    damage: 10,
  },
];

// Weapons
export const WEAPONS = {
  pistol: {
    name: "Pistol",
    damage: 25,
    fireRate: 2, // shots per second
    bulletSpeed: 600,
    range: 600,
    maxAmmo: 12,
    pellets: 1,
    color: "#e8d5a3",
    ammoType: "pistol" as const,
  },
  shotgun: {
    name: "Shotgun",
    damage: 15,
    fireRate: 1,
    bulletSpeed: 500,
    range: 300,
    maxAmmo: 6,
    pellets: 5,
    spreadAngle: 0.25,
    color: "#c49a6c",
    ammoType: "shotgun" as const,
  },
  ar: {
    name: "Assault Rifle",
    damage: 20,
    fireRate: 8,
    bulletSpeed: 800,
    range: 800,
    maxAmmo: 30,
    pellets: 1,
    color: "#7fba60",
    ammoType: "rifle" as const,
  },
  sniper: {
    name: "Sniper",
    damage: 90,
    fireRate: 0.5,
    bulletSpeed: 1200,
    range: 1500,
    maxAmmo: 5,
    pellets: 1,
    color: "#6ba3c8",
    ammoType: "sniper" as const,
  },
} as const;

export type WeaponType = keyof typeof WEAPONS;
export type AmmoType = "pistol" | "shotgun" | "rifle" | "sniper";

// Map generation
export const BUILDING_COUNT = 30;
export const TREE_COUNT = 80;
export const LOOT_SPOT_COUNT = 50;
export const ROAD_COUNT = 5; // number of roads each direction

// Colors for canvas drawing (cannot use CSS vars)
export const COLORS = {
  grass: "#2a4a1e",
  grassDark: "#1e3614",
  road: "#5a5a4a",
  roadLine: "#7a7a6a",
  building: "#6b5a3e",
  buildingRoof: "#4a3e2a",
  buildingDoor: "#3a2e1e",
  tree: "#1e3a14",
  treeDark: "#142a0e",
  treeTrunk: "#4a3a2a",
  player: "#d4c070",
  playerOutline: "#f0e090",
  bot: "#c07050",
  botOutline: "#e09070",
  botDead: "#404040",
  bullet: "#ffe060",
  bulletTrail: "#ff8020",
  zoneBlue: "rgba(30, 80, 200, 0.18)",
  zoneBorder: "rgba(60, 120, 255, 0.8)",
  safeZoneBorder: "rgba(255, 255, 255, 0.6)",
  safeZoneNext: "rgba(255, 255, 255, 0.3)",
  healthBar: "#c03030",
  armorBar: "#3060c0",
  healthBarBg: "#301010",
  armorBarBg: "#102030",
  lootWeapon: "#c8a060",
  lootHealth: "#60c860",
  lootArmor: "#6080c8",
  lootAmmo: "#c8c060",
  miniMapBg: "rgba(10, 20, 10, 0.88)",
  miniMapBorder: "rgba(180, 160, 80, 0.6)",
};
