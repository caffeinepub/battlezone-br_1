import {
  BOT_RADIUS,
  BULLET_RADIUS,
  COLORS,
  PLAYER_RADIUS,
  WEAPONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import {
  type Bot,
  type Building,
  type Bullet,
  type Camera,
  type GameState,
  type LootItem,
  type Player,
  Road,
  type SafeZone,
  type Tree,
} from "./types";

function worldToScreen(
  wx: number,
  wy: number,
  cam: Camera,
): { x: number; y: number } {
  return { x: wx - cam.x, y: wy - cam.y };
}

function isVisible(
  wx: number,
  wy: number,
  cam: Camera,
  cw: number,
  ch: number,
  margin = 100,
): boolean {
  const sx = wx - cam.x;
  const sy = wy - cam.y;
  return sx > -margin && sx < cw + margin && sy > -margin && sy < ch + margin;
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cam: Camera,
  cw: number,
  ch: number,
): void {
  ctx.clearRect(0, 0, cw, ch);

  // 1. Grass background
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, cw, ch);

  // Subtle grass texture
  ctx.fillStyle = COLORS.grassDark;
  for (let gx = Math.floor(cam.x / 60) * 60; gx < cam.x + cw + 60; gx += 60) {
    for (let gy = Math.floor(cam.y / 60) * 60; gy < cam.y + ch + 60; gy += 60) {
      const sx = gx - cam.x;
      const sy = gy - cam.y;
      ctx.fillRect(sx, sy, 2, 2);
      ctx.fillRect(sx + 30, sy + 30, 1, 1);
    }
  }

  // 2. Roads
  for (const road of state.map.roads) {
    const { x, y } = worldToScreen(road.x, road.y, cam);
    if (!isVisible(road.x + road.w / 2, road.y + road.h / 2, cam, cw, ch, 200))
      continue;
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(x, y, road.w, road.h);

    // Road center line
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    if (road.horizontal) {
      ctx.moveTo(x, y + road.h / 2);
      ctx.lineTo(x + road.w, y + road.h / 2);
    } else {
      ctx.moveTo(x + road.w / 2, y);
      ctx.lineTo(x + road.w / 2, y + road.h);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 3. Loot items
  for (const item of state.loot) {
    if (item.picked) continue;
    if (!isVisible(item.x, item.y, cam, cw, ch)) continue;
    renderLootItem(ctx, item, cam);
  }

  // 4. Trees (back layer)
  for (const tree of state.map.trees) {
    if (!isVisible(tree.x, tree.y, cam, cw, ch, tree.radius + 50)) continue;
    renderTree(ctx, tree, cam);
  }

  // 5. Buildings
  for (const building of state.map.buildings) {
    if (
      !isVisible(
        building.x + building.w / 2,
        building.y + building.h / 2,
        cam,
        cw,
        ch,
        200,
      )
    )
      continue;
    renderBuilding(ctx, building, cam);
  }

  // 6. Safe zone overlay (blue outside zone)
  renderSafeZone(ctx, state.safeZone, cam, cw, ch);

  // 7. Bullets
  for (const bullet of state.bullets) {
    if (!isVisible(bullet.x, bullet.y, cam, cw, ch)) continue;
    renderBullet(ctx, bullet, cam);
  }

  // 8. Dead bots (drawn below alive ones)
  for (const bot of state.bots) {
    if (bot.alive) continue;
    const { x, y } = worldToScreen(bot.x, bot.y, cam);
    if (!isVisible(bot.x, bot.y, cam, cw, ch)) continue;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = COLORS.botDead;
    ctx.beginPath();
    ctx.arc(x, y, BOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 9. Bots (alive)
  for (const bot of state.bots) {
    if (!bot.alive) continue;
    if (!isVisible(bot.x, bot.y, cam, cw, ch)) continue;
    renderBot(ctx, bot, cam);
  }

  // 10. Player
  if (state.player.alive) {
    renderPlayer(ctx, state.player, cam);
  }

  // 11. Zone boundary circles
  renderZoneBoundary(ctx, state.safeZone, cam);
}

function renderTree(
  ctx: CanvasRenderingContext2D,
  tree: Tree,
  cam: Camera,
): void {
  const { x, y } = worldToScreen(tree.x, tree.y, cam);

  // Shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  // Trunk
  ctx.fillStyle = COLORS.treeTrunk;
  ctx.beginPath();
  ctx.arc(x, y, tree.radius * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Canopy dark
  ctx.fillStyle = COLORS.treeDark;
  ctx.beginPath();
  ctx.arc(x - 3, y - 3, tree.radius, 0, Math.PI * 2);
  ctx.fill();

  // Canopy main
  ctx.fillStyle = COLORS.tree;
  ctx.beginPath();
  ctx.arc(x, y, tree.radius * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = "rgba(100, 180, 60, 0.2)";
  ctx.beginPath();
  ctx.arc(
    x - tree.radius * 0.3,
    y - tree.radius * 0.3,
    tree.radius * 0.4,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.restore();
}

function renderBuilding(
  ctx: CanvasRenderingContext2D,
  b: Building,
  cam: Camera,
): void {
  const { x, y } = worldToScreen(b.x, b.y, cam);

  ctx.save();

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;

  // Walls
  ctx.fillStyle = COLORS.building;
  ctx.fillRect(x, y, b.w, b.h);

  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Roof
  ctx.fillStyle = COLORS.buildingRoof;
  ctx.fillRect(x + 4, y + 4, b.w - 8, b.h - 8);

  // Door indicator on bottom wall
  const doorW = Math.min(20, b.w * 0.3);
  const doorX = x + b.w / 2 - doorW / 2;
  ctx.fillStyle = COLORS.buildingDoor;
  ctx.fillRect(doorX, y + b.h - 10, doorW, 10);

  // Wall outline
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, b.w, b.h);

  ctx.restore();
}

function renderLootItem(
  ctx: CanvasRenderingContext2D,
  item: LootItem,
  cam: Camera,
): void {
  const { x, y } = worldToScreen(item.x, item.y, cam);

  ctx.save();

  let color = COLORS.lootWeapon;
  let symbol = "W";
  let size = 7;

  if (item.type === "health") {
    color = COLORS.lootHealth;
    symbol = "+";
    size = 7;
  } else if (item.type === "bandage") {
    color = "#80c880";
    symbol = "+";
    size = 5;
  } else if (item.type === "armor") {
    color = COLORS.lootArmor;
    symbol = "A";
    size = 7;
  } else if (item.type === "ammo") {
    color = COLORS.lootAmmo;
    symbol = "•";
    size = 5;
  } else if (item.type === "weapon") {
    // Different shades per weapon
    const wColors: Record<string, string> = {
      pistol: "#d4b060",
      shotgun: "#c89060",
      ar: "#80b860",
      sniper: "#60a0c0",
    };
    color = item.weaponType
      ? (wColors[item.weaponType] ?? COLORS.lootWeapon)
      : COLORS.lootWeapon;
  }

  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  // Background circle
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.arc(x, y, size + 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();

  // Small icon
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.font = `bold ${size * 1.2}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbol, x, y);

  ctx.restore();
}

function renderBot(ctx: CanvasRenderingContext2D, bot: Bot, cam: Camera): void {
  const { x, y } = worldToScreen(bot.x, bot.y, cam);

  ctx.save();

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 6;

  // Body outline
  ctx.strokeStyle = COLORS.botOutline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, BOT_RADIUS + 1, 0, Math.PI * 2);
  ctx.stroke();

  // Body fill
  ctx.fillStyle = COLORS.bot;
  ctx.beginPath();
  ctx.arc(x, y, BOT_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Direction indicator
  ctx.strokeStyle = COLORS.botOutline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x + Math.cos(bot.angle) * (BOT_RADIUS + 8),
    y + Math.sin(bot.angle) * (BOT_RADIUS + 8),
  );
  ctx.stroke();

  // Health bar
  const barW = BOT_RADIUS * 2 + 4;
  const barH = 4;
  const barX = x - barW / 2;
  const barY = y - BOT_RADIUS - 10;

  ctx.fillStyle = COLORS.healthBarBg;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle =
    bot.health > 50
      ? "#50c030"
      : bot.health > 25
        ? "#e0b020"
        : COLORS.healthBar;
  ctx.fillRect(barX, barY, barW * (bot.health / 100), barH);

  if (bot.armor > 0) {
    ctx.fillStyle = COLORS.armorBarBg;
    ctx.fillRect(barX, barY - 5, barW, 3);
    ctx.fillStyle = COLORS.armorBar;
    ctx.fillRect(barX, barY - 5, barW * (bot.armor / 100), 3);
  }

  ctx.restore();
}

function renderPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  cam: Camera,
): void {
  const { x, y } = worldToScreen(player.x, player.y, cam);

  ctx.save();

  // Glow effect
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 15;

  // Body outline
  ctx.strokeStyle = COLORS.playerOutline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS + 2, 0, Math.PI * 2);
  ctx.stroke();

  // Body fill
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Direction indicator (weapon barrel)
  ctx.strokeStyle = COLORS.playerOutline;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(player.angle) * 5, y + Math.sin(player.angle) * 5);
  ctx.lineTo(
    x + Math.cos(player.angle) * (PLAYER_RADIUS + 12),
    y + Math.sin(player.angle) * (PLAYER_RADIUS + 12),
  );
  ctx.stroke();

  ctx.restore();
}

function renderBullet(
  ctx: CanvasRenderingContext2D,
  bullet: Bullet,
  cam: Camera,
): void {
  const { x, y } = worldToScreen(bullet.x, bullet.y, cam);

  ctx.save();
  ctx.shadowColor = COLORS.bullet;
  ctx.shadowBlur = 8;

  // Trail
  const trailLen = 12;
  const speed = Math.hypot(bullet.vx, bullet.vy);
  const ndx = bullet.vx / speed;
  const ndy = bullet.vy / speed;
  const grad = ctx.createLinearGradient(
    x - ndx * trailLen,
    y - ndy * trailLen,
    x,
    y,
  );
  grad.addColorStop(0, "transparent");
  grad.addColorStop(1, COLORS.bulletTrail);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - ndx * trailLen, y - ndy * trailLen);
  ctx.lineTo(x, y);
  ctx.stroke();

  // Bullet dot
  ctx.fillStyle = COLORS.bullet;
  ctx.beginPath();
  ctx.arc(x, y, BULLET_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function renderSafeZone(
  ctx: CanvasRenderingContext2D,
  zone: SafeZone,
  cam: Camera,
  cw: number,
  ch: number,
): void {
  const { x: zx, y: zy } = worldToScreen(zone.centerX, zone.centerY, cam);

  ctx.save();

  // Fill outside the safe zone with blue tint
  // Use clip path - fill whole screen, cut out safe circle
  ctx.fillStyle = COLORS.zoneBlue;
  ctx.beginPath();
  ctx.rect(-10, -10, cw + 20, ch + 20);
  ctx.arc(zx, zy, zone.radius, 0, Math.PI * 2, true); // counterclockwise = hole
  ctx.fill("evenodd");

  ctx.restore();
}

function renderZoneBoundary(
  ctx: CanvasRenderingContext2D,
  zone: SafeZone,
  cam: Camera,
): void {
  const { x: zx, y: zy } = worldToScreen(zone.centerX, zone.centerY, cam);

  ctx.save();

  // Current safe zone white circle
  ctx.strokeStyle = COLORS.safeZoneBorder;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(zx, zy, zone.radius, 0, Math.PI * 2);
  ctx.stroke();

  // Next zone (dashed)
  if (zone.phaseState === "wait" && zone.phase < 5) {
    const { x: nzx, y: nzy } = worldToScreen(
      zone.nextCenterX,
      zone.nextCenterY,
      cam,
    );
    ctx.strokeStyle = COLORS.safeZoneNext;
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(nzx, nzy, zone.nextRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// Mini-map rendering on a separate canvas
export function renderMiniMap(
  miniCtx: CanvasRenderingContext2D,
  state: GameState,
  mapW: number,
  mapH: number,
  worldW: number,
  worldH: number,
): void {
  miniCtx.clearRect(0, 0, mapW, mapH);

  const scaleX = mapW / worldW;
  const scaleY = mapH / worldH;

  // Background
  miniCtx.fillStyle = COLORS.miniMapBg;
  miniCtx.fillRect(0, 0, mapW, mapH);

  // Safe zone circle
  const zone = state.safeZone;
  const zx = zone.centerX * scaleX;
  const zy = zone.centerY * scaleY;
  const zr = zone.radius * Math.min(scaleX, scaleY);

  miniCtx.strokeStyle = "rgba(255,255,255,0.5)";
  miniCtx.lineWidth = 1.5;
  miniCtx.beginPath();
  miniCtx.arc(zx, zy, zr, 0, Math.PI * 2);
  miniCtx.stroke();

  // Buildings (tiny rects)
  miniCtx.fillStyle = "rgba(120, 100, 70, 0.6)";
  for (const b of state.map.buildings) {
    miniCtx.fillRect(b.x * scaleX, b.y * scaleY, b.w * scaleX, b.h * scaleY);
  }

  // Loot (yellow dots)
  miniCtx.fillStyle = "rgba(220, 200, 80, 0.7)";
  for (const item of state.loot) {
    if (item.picked) continue;
    const lx = item.x * scaleX;
    const ly = item.y * scaleY;
    miniCtx.beginPath();
    miniCtx.arc(lx, ly, 1.5, 0, Math.PI * 2);
    miniCtx.fill();
  }

  // Alive bots (red dots)
  miniCtx.fillStyle = "#e06040";
  for (const bot of state.bots) {
    if (!bot.alive) continue;
    const bx = bot.x * scaleX;
    const by = bot.y * scaleY;
    miniCtx.beginPath();
    miniCtx.arc(bx, by, 2, 0, Math.PI * 2);
    miniCtx.fill();
  }

  // Player (bright green dot)
  if (state.player.alive) {
    const px = state.player.x * scaleX;
    const py = state.player.y * scaleY;
    miniCtx.fillStyle = "#80f060";
    miniCtx.beginPath();
    miniCtx.arc(px, py, 3, 0, Math.PI * 2);
    miniCtx.fill();

    // Player direction
    miniCtx.strokeStyle = "#80f060";
    miniCtx.lineWidth = 1;
    miniCtx.beginPath();
    miniCtx.moveTo(px, py);
    miniCtx.lineTo(
      px + Math.cos(state.player.angle) * 5,
      py + Math.sin(state.player.angle) * 5,
    );
    miniCtx.stroke();
  }

  // Border
  miniCtx.strokeStyle = COLORS.miniMapBorder;
  miniCtx.lineWidth = 2;
  miniCtx.strokeRect(0, 0, mapW, mapH);
}
