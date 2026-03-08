import {
  AmmoType,
  BOT_COUNT,
  PLAYER_MAX_HEALTH,
  PLAYER_SPEED,
  WEAPONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type WeaponType,
} from "./constants";
import type { Bot, Bullet, Player, WeaponInstance } from "./types";

let bulletIdCounter = 0;

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    angle: 0,
    health: PLAYER_MAX_HEALTH,
    armor: 0,
    weapons: [{ type: "pistol", ammo: 12, lastFireTime: 0 }, null],
    activeWeaponIndex: 0,
    speed: PLAYER_SPEED,
    kills: 0,
    alive: true,
    ammo: { pistol: 24, shotgun: 0, rifle: 0, sniper: 0 },
  };
}

// Simple seeded random for bot placement
function seededRand(seed: number, i: number): number {
  const x = Math.sin(seed + i * 127.1) * 43758.5453123;
  return x - Math.floor(x);
}

export function createBots(seed = 42): Bot[] {
  const bots: Bot[] = [];
  const weaponTypes: WeaponType[] = [
    "pistol",
    "pistol",
    "pistol",
    "shotgun",
    "ar",
    "ar",
    "sniper",
  ];
  const margin = 200;

  for (let i = 0; i < BOT_COUNT; i++) {
    const angle = (i / BOT_COUNT) * Math.PI * 2;
    const dist = 600 + seededRand(seed, i * 3) * 900;
    const x = Math.max(
      margin,
      Math.min(
        WORLD_WIDTH - margin,
        WORLD_WIDTH / 2 +
          Math.cos(angle) * dist +
          (seededRand(seed, i * 7) - 0.5) * 200,
      ),
    );
    const y = Math.max(
      margin,
      Math.min(
        WORLD_HEIGHT - margin,
        WORLD_HEIGHT / 2 +
          Math.sin(angle) * dist +
          (seededRand(seed, i * 11) - 0.5) * 200,
      ),
    );

    const wType = weaponTypes[i % weaponTypes.length];
    const weapon = WEAPONS[wType];

    bots.push({
      id: i,
      x,
      y,
      angle: seededRand(seed, i * 13) * Math.PI * 2,
      health: PLAYER_MAX_HEALTH,
      armor: 0,
      weapon: {
        type: wType,
        ammo: weapon.maxAmmo,
        lastFireTime: 0,
      },
      state: "WANDER",
      targetX: x + (seededRand(seed, i * 17) - 0.5) * 300,
      targetY: y + (seededRand(seed, i * 19) - 0.5) * 300,
      targetId: null,
      lastFireTime: 0,
      alive: true,
      stuckTimer: 0,
      wanderTimer: seededRand(seed, i * 23) * 3000,
      ammo: { pistol: 36, shotgun: 18, rifle: 60, sniper: 10 },
    });
  }
  return bots;
}

export function createBullet(
  x: number,
  y: number,
  angle: number,
  weaponType: WeaponType,
  ownerId: number,
  spreadAngle = 0,
): Bullet {
  const weapon = WEAPONS[weaponType];
  const finalAngle = angle + (Math.random() - 0.5) * spreadAngle;
  bulletIdCounter++;
  return {
    id: bulletIdCounter,
    x,
    y,
    vx: Math.cos(finalAngle) * weapon.bulletSpeed,
    vy: Math.sin(finalAngle) * weapon.bulletSpeed,
    damage: weapon.damage,
    range: weapon.range,
    distanceTraveled: 0,
    ownerId,
  };
}

export function createWeaponInstance(type: WeaponType): WeaponInstance {
  return {
    type,
    ammo: WEAPONS[type].maxAmmo,
    lastFireTime: 0,
  };
}
