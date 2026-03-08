import { useCallback, useEffect, useRef, useState } from "react";
import { updateBots } from "./botAI";
import {
  type AmmoType,
  BOT_RADIUS,
  BULLET_RADIUS,
  LOOT_PICKUP_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PLAYER_SPRINT_MULTIPLIER,
  WEAPONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONE_PHASES,
} from "./constants";
import { createBots, createBullet, createPlayer } from "./entities";
import { createInitialSafeZone, generateMap } from "./mapGen";
import { renderGame, renderMiniMap } from "./renderer";
import {
  Bullet,
  type Camera,
  type GameState,
  type HUDState,
  type InputState,
  type LootItem,
} from "./types";
import { useGameLoop } from "./useGameLoop";
import { useInput } from "./useInput";

interface GameCanvasProps {
  onHUDUpdate: (state: HUDState) => void;
  running: boolean;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function rectOverlap(
  px: number,
  py: number,
  pr: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return px + pr > bx && px - pr < bx + bw && py + pr > by && py - pr < by + bh;
}

function rectOverlapBullet(
  bx: number,
  by: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  return (
    bx > rx - BULLET_RADIUS &&
    bx < rx + rw + BULLET_RADIUS &&
    by > ry - BULLET_RADIUS &&
    by < ry + rh + BULLET_RADIUS
  );
}

let notifIdCounter = 0;

export function GameCanvas({ onHUDUpdate, running }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniMapRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0 });
  const inputRef = useInput(canvasRef);

  // Initialize game state
  useEffect(() => {
    if (!running) return;
    const map = generateMap(Date.now() % 10000);
    const player = createPlayer(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    const bots = createBots(Date.now() % 1000);
    const safeZone = createInitialSafeZone();

    gameStateRef.current = {
      player,
      bots,
      bullets: [],
      loot: map.loot,
      safeZone,
      map,
      tick: 0,
      gameOver: false,
      won: false,
      survivalTime: 0,
      placement: 21,
      killNotifications: [],
    };
  }, [running]);

  // Resize canvas to window
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Focus canvas on mount
  useEffect(() => {
    if (running) {
      canvasRef.current?.focus();
    }
  }, [running]);

  const gameLoop = useCallback(
    (delta: number, timestamp: number) => {
      const state = gameStateRef.current;
      const canvas = canvasRef.current;
      const miniCanvas = miniMapRef.current;
      if (!state || !canvas || state.gameOver) return;

      const ctx = canvas.getContext("2d");
      const miniCtx = miniCanvas?.getContext("2d");
      if (!ctx) return;

      const cw = canvas.width;
      const ch = canvas.height;
      const input = inputRef.current;

      // ========= UPDATE PHASE =========

      // 1. Update survival time
      state.survivalTime += delta;

      // 2. Update player
      if (state.player.alive) {
        updatePlayer(state, input, delta, timestamp, cw, ch);
      }

      // 3. Update bots
      updateBots(
        state.bots,
        state.player,
        state.bullets,
        state.loot,
        state.map.buildings,
        state.safeZone,
        delta,
        timestamp,
        (newBullets) => {
          state.bullets.push(...newBullets);
        },
        (bot) => {
          // Bot killed - drop loot
          if (bot.weapon) {
            state.loot.push({
              id: Date.now() + Math.random() * 1000,
              x: bot.x + (Math.random() - 0.5) * 30,
              y: bot.y + (Math.random() - 0.5) * 30,
              type: "weapon",
              weaponType: bot.weapon.type,
              picked: false,
            });
          }
        },
        (_damage) => {
          // Bot bullet hit player (handled in bullet collision)
        },
      );

      // 4. Update bullets
      const bulletsToRemove = new Set<number>();
      for (const bullet of state.bullets) {
        const spd = Math.hypot(bullet.vx, bullet.vy);
        bullet.x += bullet.vx * delta;
        bullet.y += bullet.vy * delta;
        bullet.distanceTraveled += spd * delta;

        // Remove if out of range or out of world
        if (
          bullet.distanceTraveled > bullet.range ||
          bullet.x < 0 ||
          bullet.x > WORLD_WIDTH ||
          bullet.y < 0 ||
          bullet.y > WORLD_HEIGHT
        ) {
          bulletsToRemove.add(bullet.id);
          continue;
        }

        // Check building collision
        let hitBuilding = false;
        for (const b of state.map.buildings) {
          if (rectOverlapBullet(bullet.x, bullet.y, b.x, b.y, b.w, b.h)) {
            hitBuilding = true;
            break;
          }
        }
        if (hitBuilding) {
          bulletsToRemove.add(bullet.id);
          continue;
        }

        // Check player hit (by bot bullets)
        if (bullet.ownerId !== -1 && state.player.alive) {
          if (
            dist(bullet.x, bullet.y, state.player.x, state.player.y) <
            PLAYER_RADIUS + BULLET_RADIUS
          ) {
            applyDamage(state.player, bullet.damage);
            bulletsToRemove.add(bullet.id);

            if (!state.player.alive) {
              state.gameOver = true;
              // Count alive bots
              const aliveBots = state.bots.filter((b) => b.alive).length;
              state.placement = aliveBots + 1;
            }
            continue;
          }
        }

        // Check bot hits (by player bullets)
        if (bullet.ownerId === -1) {
          let hitBot = false;
          for (const bot of state.bots) {
            if (!bot.alive) continue;
            if (
              dist(bullet.x, bullet.y, bot.x, bot.y) <
              BOT_RADIUS + BULLET_RADIUS
            ) {
              applyDamageToBot(state, bot, bullet.damage);
              bulletsToRemove.add(bullet.id);
              hitBot = true;
              if (!bot.alive) {
                state.player.kills++;
                notifIdCounter++;
                state.killNotifications.push({
                  id: notifIdCounter,
                  text: `Eliminated enemy #${bot.id + 1}`,
                  timestamp: timestamp,
                });
              }
              break;
            }
          }
          if (hitBot) continue;

          // Bot-vs-bot
          for (const shooter of state.bots) {
            if (!shooter.alive || shooter.id === bullet.ownerId) continue;
            // Bot bullets vs other bots
          }
        } else {
          // Bot bullet vs other bots
          for (const bot of state.bots) {
            if (!bot.alive || bot.id === bullet.ownerId) continue;
            if (
              dist(bullet.x, bullet.y, bot.x, bot.y) <
              BOT_RADIUS + BULLET_RADIUS
            ) {
              applyDamageToBot(state, bot, bullet.damage);
              bulletsToRemove.add(bullet.id);
              break;
            }
          }
        }
      }

      state.bullets = state.bullets.filter((b) => !bulletsToRemove.has(b.id));

      // 5. Check loot pickup (player auto-pickup)
      if (state.player.alive) {
        for (const item of state.loot) {
          if (item.picked) continue;
          if (
            dist(state.player.x, state.player.y, item.x, item.y) <
            LOOT_PICKUP_RADIUS
          ) {
            pickupLootPlayer(state, item);
          }
        }
      }

      // 6. Update safe zone
      updateSafeZone(state, delta);

      // 7. Apply zone damage
      if (state.player.alive) {
        const inZone =
          dist(
            state.player.x,
            state.player.y,
            state.safeZone.centerX,
            state.safeZone.centerY,
          ) <= state.safeZone.radius;
        if (!inZone) {
          state.player.health -= state.safeZone.damage * delta;
          if (state.player.health <= 0) {
            state.player.health = 0;
            state.player.alive = false;
            state.gameOver = true;
            const aliveBots = state.bots.filter((b) => b.alive).length;
            state.placement = aliveBots + 1;
          }
        }
      }

      // Apply zone damage to bots
      for (const bot of state.bots) {
        if (!bot.alive) continue;
        const inZone =
          dist(bot.x, bot.y, state.safeZone.centerX, state.safeZone.centerY) <=
          state.safeZone.radius;
        if (!inZone) {
          bot.health -= state.safeZone.damage * delta;
          if (bot.health <= 0) {
            bot.alive = false;
            bot.health = 0;
          }
        }
      }

      // 8. Check win condition
      const aliveBots = state.bots.filter((b) => b.alive).length;
      if (aliveBots === 0 && state.player.alive) {
        state.gameOver = true;
        state.won = true;
        state.placement = 1;
      }

      // Kill old notifications
      state.killNotifications = state.killNotifications.filter(
        (n) => timestamp - n.timestamp < 3000,
      );

      // ========= CAMERA =========
      const cam = cameraRef.current;
      const targetCamX = state.player.x - cw / 2;
      const targetCamY = state.player.y - ch / 2;
      cam.x = clamp(targetCamX, 0, WORLD_WIDTH - cw);
      cam.y = clamp(targetCamY, 0, WORLD_HEIGHT - ch);

      // ========= RENDER =========
      renderGame(ctx, state, cam, cw, ch);
      if (miniCtx) {
        renderMiniMap(miniCtx, state, 160, 160, WORLD_WIDTH, WORLD_HEIGHT);
      }

      // ========= HUD UPDATE =========
      const activeWeapon = state.player.weapons[state.player.activeWeaponIndex];
      const secondaryIdx = state.player.activeWeaponIndex === 0 ? 1 : 0;
      const secondaryWeapon = state.player.weapons[secondaryIdx];

      let zoneText = "";
      const zone = state.safeZone;
      if (zone.phase < ZONE_PHASES.length) {
        if (zone.phaseState === "wait") {
          zoneText = `Zone closes in ${Math.ceil(zone.phaseTimer / 1000)}s`;
        } else {
          zoneText = "Zone shrinking!";
        }
      } else {
        zoneText = "Final zone!";
      }

      const isOutsideZone =
        dist(state.player.x, state.player.y, zone.centerX, zone.centerY) >
        zone.radius;

      onHUDUpdate({
        health: Math.max(0, state.player.health),
        armor: state.player.armor,
        ammo: activeWeapon?.ammo ?? 0,
        maxAmmo: activeWeapon ? WEAPONS[activeWeapon.type].maxAmmo : 0,
        weaponName: activeWeapon
          ? WEAPONS[activeWeapon.type].name
          : "No weapon",
        secondaryWeapon: secondaryWeapon
          ? WEAPONS[secondaryWeapon.type].name
          : null,
        kills: state.player.kills,
        aliveCount: aliveBots + (state.player.alive ? 1 : 0),
        zoneText,
        zoneWarning: isOutsideZone,
        gameOver: state.gameOver,
        won: state.won,
        survivalTime: state.survivalTime,
        placement: state.placement,
        killNotifications: [...state.killNotifications],
      });

      // Clear clicked flag after processing
      input.mouseClicked = false;
      state.tick++;
    },
    [onHUDUpdate, inputRef],
  );

  useGameLoop(gameLoop, running);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="block w-full h-full outline-none"
        style={{ cursor: "crosshair" }}
      />
      <canvas
        ref={miniMapRef}
        width={160}
        height={160}
        className="absolute top-16 right-4 rounded"
        style={{ imageRendering: "pixelated", pointerEvents: "none" }}
      />
    </div>
  );
}

// ============ HELPER FUNCTIONS ============

function updatePlayer(
  state: GameState,
  input: InputState,
  delta: number,
  timestamp: number,
  cw: number,
  ch: number,
): void {
  const player = state.player;
  const cam = { x: player.x - cw / 2, y: player.y - ch / 2 };
  // Clamp camera same way as render
  cam.x = clamp(cam.x, 0, WORLD_WIDTH - cw);
  cam.y = clamp(cam.y, 0, WORLD_HEIGHT - ch);

  const keys = input.keys;
  const sprint = keys.has("shift");
  const speed = PLAYER_SPEED * (sprint ? PLAYER_SPRINT_MULTIPLIER : 1.0);

  let dx = 0;
  let dy = 0;
  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;

    let nx = player.x + dx * speed * delta;
    let ny = player.y + dy * speed * delta;

    // Building collision resolution
    for (const b of state.map.buildings) {
      if (rectOverlap(nx, ny, PLAYER_RADIUS, b.x, b.y, b.w, b.h)) {
        // Push out - try just X movement first
        if (rectOverlap(nx, player.y, PLAYER_RADIUS, b.x, b.y, b.w, b.h)) {
          nx = player.x;
        }
        if (rectOverlap(player.x, ny, PLAYER_RADIUS, b.x, b.y, b.w, b.h)) {
          ny = player.y;
        }
      }
    }

    player.x = clamp(nx, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
    player.y = clamp(ny, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);
  }

  // Mouse aim - convert screen to world
  const worldMouseX = input.mouseX + cam.x;
  const worldMouseY = input.mouseY + cam.y;
  player.angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);

  // Weapon swap
  if (keys.has("q")) {
    keys.delete("q"); // consume
    player.activeWeaponIndex = player.activeWeaponIndex === 0 ? 1 : 0;
  }

  // Shoot
  if (input.mouseDown) {
    const weapon = player.weapons[player.activeWeaponIndex];
    if (weapon && weapon.ammo > 0) {
      const fireInterval = 1000 / WEAPONS[weapon.type].fireRate;
      if (timestamp - weapon.lastFireTime >= fireInterval) {
        weapon.lastFireTime = timestamp;
        weapon.ammo--;

        const weaponDef = WEAPONS[weapon.type];
        const pellets = weaponDef.pellets;
        const spread = (weaponDef as { spreadAngle?: number }).spreadAngle ?? 0;

        for (let i = 0; i < pellets; i++) {
          let spreadAngle = 0;
          if (pellets > 1) {
            spreadAngle =
              ((i - (pellets - 1) / 2) * spread) / (pellets - 1) +
              (Math.random() - 0.5) * 0.08;
          }
          const bullet = createBullet(
            player.x,
            player.y,
            player.angle + spreadAngle,
            weapon.type,
            -1,
          );
          state.bullets.push(bullet);
        }
      }
    } else if (weapon) {
      // Auto-reload from ammo pool
      const ammoType = WEAPONS[weapon.type].ammoType;
      const refill = Math.min(
        player.ammo[ammoType],
        WEAPONS[weapon.type].maxAmmo - weapon.ammo,
      );
      if (refill > 0) {
        weapon.ammo += refill;
        player.ammo[ammoType] -= refill;
      }
    }
  }
}

function applyDamage(
  entity: { health: number; armor: number; alive: boolean },
  damage: number,
): void {
  if (entity.armor > 0) {
    const absorbed = Math.min(entity.armor, damage * 0.6);
    entity.armor -= absorbed;
    entity.health -= damage - absorbed;
  } else {
    entity.health -= damage;
  }
  if (entity.health <= 0) {
    entity.health = 0;
    entity.alive = false;
  }
}

function applyDamageToBot(
  state: GameState,
  bot: {
    health: number;
    armor: number;
    alive: boolean;
    x: number;
    y: number;
    id: number;
  },
  damage: number,
): void {
  applyDamage(bot, damage);
  if (!bot.alive) {
    // Drop loot
    const botFull = state.bots.find((b) => b.id === (bot as { id: number }).id);
    if (botFull) {
      if (botFull.weapon) {
        state.loot.push({
          id: Date.now() + Math.random() * 1000 + botFull.id,
          x: botFull.x + (Math.random() - 0.5) * 30,
          y: botFull.y + (Math.random() - 0.5) * 30,
          type: "weapon",
          weaponType: botFull.weapon.type,
          picked: false,
        });
        // Drop some ammo
        const ammoType = WEAPONS[botFull.weapon.type].ammoType;
        const ammoAmt = botFull.ammo[ammoType];
        if (ammoAmt > 0) {
          state.loot.push({
            id: Date.now() + Math.random() * 1000 + botFull.id + 1000,
            x: botFull.x + (Math.random() - 0.5) * 30,
            y: botFull.y + (Math.random() - 0.5) * 30,
            type: "ammo",
            ammoType: ammoType as AmmoType,
            ammoAmount: Math.floor(ammoAmt / 2),
            picked: false,
          });
        }
      }
    }
  }
}

function pickupLootPlayer(state: GameState, item: LootItem): void {
  const player = state.player;
  item.picked = true;

  if (item.type === "weapon" && item.weaponType) {
    // Try to fill an empty slot first
    if (player.weapons[0] === null) {
      player.weapons[0] = {
        type: item.weaponType,
        ammo: WEAPONS[item.weaponType].maxAmmo,
        lastFireTime: 0,
      };
    } else if (player.weapons[1] === null) {
      player.weapons[1] = {
        type: item.weaponType,
        ammo: WEAPONS[item.weaponType].maxAmmo,
        lastFireTime: 0,
      };
    } else {
      // Replace active weapon
      player.weapons[player.activeWeaponIndex] = {
        type: item.weaponType,
        ammo: WEAPONS[item.weaponType].maxAmmo,
        lastFireTime: 0,
      };
    }
  } else if (item.type === "ammo" && item.ammoType && item.ammoAmount) {
    player.ammo[item.ammoType] += item.ammoAmount;
  } else if (item.type === "health" && item.healAmount) {
    player.health = Math.min(100, player.health + item.healAmount);
  } else if (item.type === "bandage" && item.healAmount) {
    player.health = Math.min(100, player.health + item.healAmount);
  } else if (item.type === "armor" && item.armorAmount) {
    player.armor = Math.min(100, player.armor + item.armorAmount);
  }
}

function updateSafeZone(state: GameState, delta: number): void {
  const zone = state.safeZone;
  if (zone.phase >= ZONE_PHASES.length) return;

  const phaseCfg = ZONE_PHASES[zone.phase];
  zone.phaseTimer -= delta * 1000;

  if (zone.phaseTimer <= 0) {
    if (zone.phaseState === "wait") {
      // Start shrinking
      zone.phaseState = "shrink";
      zone.phaseTimer = phaseCfg.shrinkMs;
    } else {
      // Shrink complete - move to next phase
      zone.centerX = zone.nextCenterX;
      zone.centerY = zone.nextCenterY;
      zone.radius = zone.nextRadius;
      zone.phase++;
      zone.phaseState = "wait";

      if (zone.phase < ZONE_PHASES.length) {
        const nextCfg = ZONE_PHASES[zone.phase];
        zone.phaseTimer = nextCfg.waitMs;
        zone.damage = nextCfg.damage;
        // Set next target
        zone.nextCenterX = zone.centerX + nextCfg.offsetX;
        zone.nextCenterY = zone.centerY + nextCfg.offsetY;
        zone.nextRadius = nextCfg.newRadius;
        // Clamp next center so circle stays within world
        const nr = nextCfg.newRadius;
        zone.nextCenterX = clamp(
          zone.nextCenterX,
          nr + 50,
          WORLD_WIDTH - nr - 50,
        );
        zone.nextCenterY = clamp(
          zone.nextCenterY,
          nr + 50,
          WORLD_HEIGHT - nr - 50,
        );
      }
    }
  } else if (zone.phaseState === "shrink") {
    // Interpolate zone
    const progress = 1 - zone.phaseTimer / phaseCfg.shrinkMs;
    const startRadius =
      zone.phase === 0
        ? 1400
        : (ZONE_PHASES[zone.phase - 1]?.newRadius ?? 1400);
    zone.radius = startRadius + (phaseCfg.newRadius - startRadius) * progress;
    // Also move center
    const prevCenterX = zone.phase === 0 ? 1500 : zone.centerX;
    const prevCenterY = zone.phase === 0 ? 1500 : zone.centerY;
    zone.centerX = prevCenterX + (zone.nextCenterX - prevCenterX) * progress;
    zone.centerY = prevCenterY + (zone.nextCenterY - prevCenterY) * progress;
  }
}
