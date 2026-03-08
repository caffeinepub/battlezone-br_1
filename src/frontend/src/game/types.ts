import type { AmmoType, WeaponType } from "./constants";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WeaponInstance {
  type: WeaponType;
  ammo: number;
  lastFireTime: number; // timestamp ms
}

export interface Player {
  x: number;
  y: number;
  angle: number; // radians
  health: number;
  armor: number;
  weapons: [WeaponInstance | null, WeaponInstance | null];
  activeWeaponIndex: 0 | 1;
  speed: number;
  kills: number;
  alive: boolean;
  ammo: Record<AmmoType, number>;
}

export type BotState = "WANDER" | "CHASE" | "ATTACK" | "RETREAT" | "ZONE_FLEE";

export interface Bot {
  id: number;
  x: number;
  y: number;
  angle: number;
  health: number;
  armor: number;
  weapon: WeaponInstance | null;
  state: BotState;
  targetX: number;
  targetY: number;
  targetId: number | null; // bot id or -1 for player
  lastFireTime: number;
  alive: boolean;
  stuckTimer: number;
  wanderTimer: number;
  ammo: Record<AmmoType, number>;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  range: number;
  distanceTraveled: number;
  ownerId: number; // -1 = player, 0+ = bot id
  pelletCount?: number;
}

export type LootType = "weapon" | "health" | "armor" | "ammo" | "bandage";

export interface LootItem {
  id: number;
  x: number;
  y: number;
  type: LootType;
  weaponType?: WeaponType;
  ammoType?: AmmoType;
  ammoAmount?: number;
  healAmount?: number;
  armorAmount?: number;
  picked: boolean;
}

export interface Building extends Rect {
  id: number;
}

export interface Tree {
  id: number;
  x: number;
  y: number;
  radius: number;
}

export interface Road {
  x: number;
  y: number;
  w: number;
  h: number;
  horizontal: boolean;
}

export interface SafeZone {
  centerX: number;
  centerY: number;
  radius: number;
  nextCenterX: number;
  nextCenterY: number;
  nextRadius: number;
  phase: number; // current phase index
  phaseState: "wait" | "shrink";
  phaseTimer: number; // ms remaining in current state
  damage: number; // damage per second outside zone
}

export interface GameMap {
  buildings: Building[];
  trees: Tree[];
  roads: Road[];
  loot: LootItem[];
}

export interface GameState {
  player: Player;
  bots: Bot[];
  bullets: Bullet[];
  loot: LootItem[];
  safeZone: SafeZone;
  map: GameMap;
  tick: number;
  gameOver: boolean;
  won: boolean;
  survivalTime: number; // seconds
  placement: number;
  killNotifications: KillNotification[];
}

export interface KillNotification {
  id: number;
  text: string;
  timestamp: number;
}

export interface HUDState {
  health: number;
  armor: number;
  ammo: number;
  maxAmmo: number;
  weaponName: string;
  secondaryWeapon: string | null;
  kills: number;
  aliveCount: number;
  zoneText: string;
  zoneWarning: boolean;
  gameOver: boolean;
  won: boolean;
  survivalTime: number;
  placement: number;
  killNotifications: KillNotification[];
}

export interface InputState {
  keys: Set<string>;
  mouseX: number;
  mouseY: number;
  mouseDown: boolean;
  mouseClicked: boolean;
}

export interface Camera {
  x: number;
  y: number;
}
