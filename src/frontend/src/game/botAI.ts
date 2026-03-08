import {
  BOT_ATTACK_RANGE,
  BOT_CHASE_RANGE,
  BOT_RETREAT_HEALTH,
  BOT_SPEED,
  WEAPONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WeaponType,
} from "./constants";
import { createBullet, createWeaponInstance } from "./entities";
import type {
  Bot,
  Building,
  Bullet,
  LootItem,
  Player,
  SafeZone,
} from "./types";

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function isPointInSafeZone(x: number, y: number, zone: SafeZone): boolean {
  return dist(x, y, zone.centerX, zone.centerY) <= zone.radius;
}

function steerAroundBuildings(
  bot: Bot,
  dx: number,
  dy: number,
  speed: number,
  buildings: Building[],
  delta: number,
): { nx: number; ny: number } {
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return { nx: bot.x, ny: bot.y };
  const ndx = dx / len;
  const ndy = dy / len;
  const moveStep = speed * delta;

  // Try direct path
  const nx = bot.x + ndx * moveStep;
  const ny = bot.y + ndy * moveStep;

  if (!collidesWithBuildings(nx, ny, buildings)) {
    return { nx, ny };
  }

  // Try steering left or right
  for (const angle of [0.4, -0.4, 0.8, -0.8, 1.2, -1.2, Math.PI]) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tdx = ndx * cos - ndy * sin;
    const tdy = ndx * sin + ndy * cos;
    const tnx = bot.x + tdx * moveStep;
    const tny = bot.y + tdy * moveStep;
    if (!collidesWithBuildings(tnx, tny, buildings)) {
      return { nx: tnx, ny: tny };
    }
  }

  return { nx: bot.x, ny: bot.y };
}

function collidesWithBuildings(
  x: number,
  y: number,
  buildings: Building[],
  radius = 14,
): boolean {
  for (const b of buildings) {
    if (
      x + radius > b.x &&
      x - radius < b.x + b.w &&
      y + radius > b.y &&
      y - radius < b.y + b.h
    ) {
      return true;
    }
  }
  return false;
}

export function updateBots(
  bots: Bot[],
  player: Player,
  _bullets: Bullet[],
  loot: LootItem[],
  buildings: Building[],
  safeZone: SafeZone,
  delta: number, // seconds
  now: number, // ms timestamp
  addBullets: (newBullets: Bullet[]) => void,
  _onBotKilled: (bot: Bot) => void,
  _onPlayerHit: (damage: number) => void,
): void {
  for (const bot of bots) {
    if (!bot.alive) continue;

    const speedMultiplier = bot.health < BOT_RETREAT_HEALTH ? 1.2 : 1.0;
    const botSpeed = BOT_SPEED * speedMultiplier;

    // Check if outside safe zone
    const inZone = isPointInSafeZone(bot.x, bot.y, safeZone);
    if (!inZone) {
      bot.state = "ZONE_FLEE";
    } else {
      // Determine AI state
      const distToPlayer = player.alive
        ? dist(bot.x, bot.y, player.x, player.y)
        : Number.POSITIVE_INFINITY;

      // Find nearest visible bot
      let nearestBotDist = Number.POSITIVE_INFINITY;
      let nearestBotId: number | null = null;
      for (const other of bots) {
        if (!other.alive || other.id === bot.id) continue;
        const d = dist(bot.x, bot.y, other.x, other.y);
        if (d < nearestBotDist) {
          nearestBotDist = d;
          nearestBotId = other.id;
        }
      }

      if (bot.health < BOT_RETREAT_HEALTH) {
        bot.state = "RETREAT";
      } else if (player.alive && distToPlayer < BOT_CHASE_RANGE) {
        if (distToPlayer < BOT_ATTACK_RANGE) {
          bot.state = "ATTACK";
          bot.targetId = -1; // player
        } else {
          bot.state = "CHASE";
          bot.targetId = -1;
        }
      } else if (nearestBotDist < BOT_CHASE_RANGE * 0.7) {
        if (nearestBotDist < BOT_ATTACK_RANGE) {
          bot.state = "ATTACK";
          bot.targetId = nearestBotId;
        } else {
          bot.state = "CHASE";
          bot.targetId = nearestBotId;
        }
      } else {
        bot.state = "WANDER";
      }
    }

    // Execute state
    switch (bot.state) {
      case "WANDER": {
        bot.wanderTimer -= delta * 1000;
        if (
          bot.wanderTimer <= 0 ||
          dist(bot.x, bot.y, bot.targetX, bot.targetY) < 30
        ) {
          bot.targetX = clamp(
            bot.x + (Math.random() - 0.5) * 400,
            100,
            WORLD_WIDTH - 100,
          );
          bot.targetY = clamp(
            bot.y + (Math.random() - 0.5) * 400,
            100,
            WORLD_HEIGHT - 100,
          );
          bot.wanderTimer = 2000 + Math.random() * 3000;
        }

        // Try picking up loot
        for (const item of loot) {
          if (item.picked) continue;
          if (dist(bot.x, bot.y, item.x, item.y) < 40) {
            pickupLootBot(bot, item);
            item.picked = true;
          }
        }

        const dx = bot.targetX - bot.x;
        const dy = bot.targetY - bot.y;
        const { nx, ny } = steerAroundBuildings(
          bot,
          dx,
          dy,
          botSpeed,
          buildings,
          delta,
        );
        bot.angle = Math.atan2(dy, dx);
        bot.x = clamp(nx, 14, WORLD_WIDTH - 14);
        bot.y = clamp(ny, 14, WORLD_HEIGHT - 14);
        break;
      }

      case "CHASE": {
        let tx: number;
        let ty: number;
        if (bot.targetId === -1) {
          tx = player.x;
          ty = player.y;
        } else {
          const target = bots.find((b) => b.id === bot.targetId);
          if (!target || !target.alive) {
            bot.state = "WANDER";
            break;
          }
          tx = target.x;
          ty = target.y;
        }
        const dx = tx - bot.x;
        const dy = ty - bot.y;
        bot.angle = Math.atan2(dy, dx);
        const { nx, ny } = steerAroundBuildings(
          bot,
          dx,
          dy,
          botSpeed,
          buildings,
          delta,
        );
        bot.x = clamp(nx, 14, WORLD_WIDTH - 14);
        bot.y = clamp(ny, 14, WORLD_HEIGHT - 14);
        break;
      }

      case "ATTACK": {
        let tx: number;
        let ty: number;
        if (bot.targetId === -1) {
          if (!player.alive) {
            bot.state = "WANDER";
            break;
          }
          tx = player.x;
          ty = player.y;
        } else {
          const target = bots.find((b) => b.id === bot.targetId);
          if (!target || !target.alive) {
            bot.state = "WANDER";
            break;
          }
          tx = target.x;
          ty = target.y;
        }

        const dx = tx - bot.x;
        const dy = ty - bot.y;
        bot.angle = Math.atan2(dy, dx);

        // Shoot
        if (bot.weapon && bot.weapon.ammo > 0) {
          const weapon = WEAPONS[bot.weapon.type];
          const fireInterval = 1000 / weapon.fireRate;
          if (now - bot.lastFireTime >= fireInterval) {
            bot.lastFireTime = now;
            bot.weapon.ammo--;

            const newBullets: Bullet[] = [];
            const spreadAngles =
              weapon.pellets > 1
                ? Array.from({ length: weapon.pellets }, (_, i) => {
                    const spread =
                      (weapon as { spreadAngle?: number }).spreadAngle ?? 0;
                    return (
                      ((i - (weapon.pellets - 1) / 2) * spread) /
                      (weapon.pellets - 1)
                    );
                  })
                : [0];

            for (const spread of spreadAngles) {
              const bullet = createBullet(
                bot.x,
                bot.y,
                bot.angle + spread,
                bot.weapon.type,
                bot.id,
              );
              newBullets.push(bullet);
            }
            addBullets(newBullets);

            // Check if bullet hits player (simplified hit check happens in main loop)
          }
        } else if (bot.weapon) {
          // Reload - refill from ammo
          const ammoType = WEAPONS[bot.weapon.type].ammoType;
          const refill = Math.min(
            bot.ammo[ammoType],
            WEAPONS[bot.weapon.type].maxAmmo - bot.weapon.ammo,
          );
          bot.weapon.ammo += refill;
          bot.ammo[ammoType] -= refill;
        }
        break;
      }

      case "RETREAT": {
        // Move away from nearest threat
        let threatX = WORLD_WIDTH / 2;
        let threatY = WORLD_HEIGHT / 2;
        if (player.alive) {
          threatX = player.x;
          threatY = player.y;
        }
        const dx = bot.x - threatX;
        const dy = bot.y - threatY;
        bot.angle = Math.atan2(-dy, -dx) + Math.PI; // face away
        const { nx, ny } = steerAroundBuildings(
          bot,
          dx,
          dy,
          botSpeed * 1.3,
          buildings,
          delta,
        );
        bot.x = clamp(nx, 14, WORLD_WIDTH - 14);
        bot.y = clamp(ny, 14, WORLD_HEIGHT - 14);
        break;
      }

      case "ZONE_FLEE": {
        const dx = safeZone.centerX - bot.x;
        const dy = safeZone.centerY - bot.y;
        bot.angle = Math.atan2(dy, dx);
        const { nx, ny } = steerAroundBuildings(
          bot,
          dx,
          dy,
          botSpeed * 1.5,
          buildings,
          delta,
        );
        bot.x = clamp(nx, 14, WORLD_WIDTH - 14);
        bot.y = clamp(ny, 14, WORLD_HEIGHT - 14);
        break;
      }
    }
  }
}

function pickupLootBot(bot: Bot, item: LootItem): void {
  if (item.type === "weapon" && item.weaponType) {
    if (!bot.weapon) {
      bot.weapon = createWeaponInstance(item.weaponType);
    }
  } else if (item.type === "ammo" && item.ammoType && item.ammoAmount) {
    bot.ammo[item.ammoType] += item.ammoAmount;
  } else if (item.type === "health" && item.healAmount) {
    bot.health = Math.min(100, bot.health + item.healAmount);
  } else if (item.type === "bandage" && item.healAmount) {
    bot.health = Math.min(100, bot.health + item.healAmount);
  } else if (item.type === "armor" && item.armorAmount) {
    bot.armor = Math.min(100, bot.armor + item.armorAmount);
  }
}
