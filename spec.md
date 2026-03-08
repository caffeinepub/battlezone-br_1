# BattleZone BR (PUBG-inspired Battle Royale)

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- Top-down 2D battle royale game inspired by PUBG, playable in the browser
- Canvas-based game rendered at ~60fps using requestAnimationFrame
- Player character controlled with WASD (movement) and mouse (aim/shoot)
- Shrinking safe zone (white circle) with a blue zone that deals damage outside it
- AI bots (up to 20) with basic pathfinding, shooting, and looting behavior
- Loot system: weapons (pistol, shotgun, assault rifle, sniper), ammo, health packs, armor scattered across the map
- Inventory system: player can pick up and switch weapons, view current ammo count
- Health and armor bars displayed in HUD
- Mini-map in corner showing safe zone, player position, bots, and loot
- Kill counter, player count remaining, and match timer in HUD
- Game phases: lobby/start screen, in-game, end screen (win/lose)
- Top-down tiled map with terrain: grass, roads, buildings (obstacles), trees
- Death mechanic: player eliminated when health reaches 0; bots eliminated similarly
- Win condition: last player/bot standing
- Sound-free (Canvas only, no audio API)
- Leaderboard stored in backend: top scores (kills, placement, survival time)
- Backend stores match results per user session

### Modify
- Nothing (new project)

### Remove
- Nothing (new project)

## Implementation Plan

### Backend (Motoko)
- Store match results: kills, placement (1st, 2nd...), survival time, timestamp
- Query top leaderboard entries (top 10 by kills or placement)
- Anonymous session-based submission (no auth required)

### Frontend (React + Canvas)
- `GameCanvas.tsx` — main Canvas component, houses entire game loop
- `useGameLoop.ts` — custom hook managing requestAnimationFrame, game state refs
- `useInput.ts` — keyboard/mouse input handler
- Game entities: Player, Bot, Bullet, LootItem, Building
- Map generation: procedural placement of buildings, trees, loot
- Safe zone logic: timer-driven shrink phases (5 phases)
- Bot AI: wander → seek loot → chase/attack nearest player/bot
- HUD overlay (React): health bar, armor, ammo, kills, zone timer, player count
- Mini-map (Canvas overlay): 150x150px corner map
- Start screen: "Play" button, game title, instructions
- End screen: result (Winner/Eliminated), kills, survival time, submit to leaderboard button
- Leaderboard view: top 10 table
