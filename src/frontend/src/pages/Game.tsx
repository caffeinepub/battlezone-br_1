import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronRight,
  Clock,
  Loader2,
  Skull,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Entry } from "../backend.d.ts";
import { GameCanvas } from "../game/GameCanvas";
import type { HUDState } from "../game/types";
import {
  useSubmitMatch,
  useTopKills,
  useTopPlacements,
} from "../hooks/useQueries";

type GamePhase = "start" | "playing" | "ended" | "leaderboard";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

// ============ HUD COMPONENT ============
function GameHUD({ hud }: { hud: HUDState }) {
  const healthPct = Math.max(0, Math.min(100, hud.health));
  const armorPct = Math.max(0, Math.min(100, hud.armor));
  const ammoPct = hud.maxAmmo > 0 ? (hud.ammo / hud.maxAmmo) * 100 : 0;
  const isLowHealth = healthPct < 30;

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* Zone outside warning flash */}
      {hud.zoneWarning && (
        <div className="absolute inset-0 zone-damage pointer-events-none" />
      )}

      {/* Zone timer - top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <div
          className={`hud-panel px-4 py-1.5 rounded flex items-center gap-2 ${hud.zoneWarning ? "border-blue-500/60" : ""}`}
        >
          <div
            className={`w-2 h-2 rounded-full ${hud.zoneWarning ? "bg-blue-400 animate-pulse" : "bg-primary"}`}
          />
          <span
            className={`font-heading text-sm font-semibold tracking-wider ${hud.zoneWarning ? "text-blue-400" : "text-foreground"}`}
          >
            {hud.zoneText}
          </span>
        </div>
      </div>

      {/* Top right - stats */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
        <div
          className="hud-panel px-3 py-2 rounded flex items-center gap-2"
          data-ocid="game.hud_alive"
        >
          <Users size={14} className="text-primary" />
          <span className="font-heading text-sm font-bold text-foreground">
            {hud.aliveCount}{" "}
            <span className="text-muted-foreground font-normal text-xs">
              alive
            </span>
          </span>
        </div>
        <div
          className="hud-panel px-3 py-2 rounded flex items-center gap-2"
          data-ocid="game.hud_kills"
        >
          <Skull size={14} className="text-destructive" />
          <span className="font-heading text-sm font-bold text-foreground">
            {hud.kills}{" "}
            <span className="text-muted-foreground font-normal text-xs">
              kills
            </span>
          </span>
        </div>
      </div>

      {/* Kill notifications */}
      <div className="absolute top-4 left-4 flex flex-col gap-1.5">
        <AnimatePresence>
          {hud.killNotifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ x: -80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -80, opacity: 0 }}
              className="hud-panel px-3 py-1.5 rounded flex items-center gap-2"
            >
              <Skull size={12} className="text-destructive" />
              <span className="font-heading text-xs text-foreground">
                {notif.text}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom HUD */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-between items-end px-4">
        {/* Bottom left - health & armor */}
        <div className="hud-panel p-3 rounded-lg w-56 flex flex-col gap-2">
          {/* Health */}
          <div data-ocid="game.hud_health">
            <div className="flex justify-between items-center mb-1">
              <span className="font-heading text-xs text-muted-foreground uppercase tracking-widest">
                HP
              </span>
              <span
                className={`font-heading text-sm font-bold ${isLowHealth ? "text-destructive" : "text-foreground"}`}
              >
                {Math.ceil(healthPct)}
              </span>
            </div>
            <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <motion.div
                className={`h-full rounded-full ${isLowHealth ? "pulse-danger" : ""}`}
                style={{
                  width: `${healthPct}%`,
                  background: isLowHealth
                    ? "oklch(0.60 0.22 25)"
                    : "linear-gradient(90deg, oklch(0.60 0.22 25), oklch(0.65 0.20 35))",
                }}
                animate={{ width: `${healthPct}%` }}
                transition={{ duration: 0.15 }}
              />
            </div>
          </div>

          {/* Armor */}
          <div data-ocid="game.hud_armor">
            <div className="flex justify-between items-center mb-1">
              <span className="font-heading text-xs text-muted-foreground uppercase tracking-widest">
                ARMOR
              </span>
              <span className="font-heading text-sm font-bold text-foreground">
                {Math.ceil(armorPct)}
              </span>
            </div>
            <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${armorPct}%`,
                  background:
                    "linear-gradient(90deg, oklch(0.45 0.14 250), oklch(0.55 0.16 240))",
                }}
                animate={{ width: `${armorPct}%` }}
                transition={{ duration: 0.15 }}
              />
            </div>
          </div>
        </div>

        {/* Bottom right - weapon */}
        <div
          className="hud-panel p-3 rounded-lg flex flex-col items-end gap-2"
          data-ocid="game.hud_ammo"
        >
          {/* Secondary weapon */}
          {hud.secondaryWeapon && (
            <div className="text-right opacity-60">
              <span className="font-heading text-xs text-muted-foreground">
                [Q] {hud.secondaryWeapon}
              </span>
            </div>
          )}
          {/* Primary weapon */}
          <div className="text-right">
            <div className="font-heading text-base font-bold text-primary">
              {hud.weaponName}
            </div>
            <div className="font-heading text-lg font-black text-foreground">
              {hud.ammo}
              <span className="text-muted-foreground font-normal text-sm">
                /{hud.maxAmmo}
              </span>
            </div>
          </div>
          {/* Ammo bar */}
          <div className="w-32 h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${ammoPct}%`,
                background:
                  ammoPct > 30 ? "oklch(0.68 0.14 100)" : "oklch(0.60 0.22 25)",
              }}
              animate={{ width: `${ammoPct}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>
      </div>

      {/* Crosshair (static center) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-6 h-6">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/70" />
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-white/70" />
          <div className="absolute inset-1 border border-white/20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ============ START SCREEN ============
function StartScreen({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState("");

  const handleStart = () => {
    if (name.trim()) onStart(name.trim());
  };

  return (
    <motion.div
      data-ocid="game.start_panel"
      className="absolute inset-0 tactical-bg flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      {/* Decorative corner marks */}
      <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-primary/40" />
      <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-primary/40" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-primary/40" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-primary/40" />

      <div className="flex flex-col items-center gap-8 max-w-md w-full px-6">
        {/* Title */}
        <motion.div
          className="text-center"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="font-heading text-xs tracking-[0.4em] text-primary/70 uppercase mb-3">
            BATTLE ROYALE
          </div>
          <h1 className="font-heading text-6xl font-black text-foreground leading-none tracking-tight">
            BATTLE<span className="text-primary">ZONE</span>
          </h1>
          <div className="font-heading text-2xl font-bold text-muted-foreground tracking-widest mt-1">
            BR
          </div>
        </motion.div>

        {/* Name input */}
        <motion.div
          className="w-full flex flex-col gap-3"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Input
            data-ocid="game.name_input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
            placeholder="Enter callsign..."
            className="text-center font-heading text-lg bg-card/50 border-primary/30 focus:border-primary/70 h-12 tracking-widest placeholder:text-muted-foreground/50"
            maxLength={20}
          />
          <Button
            data-ocid="game.primary_button"
            onClick={handleStart}
            disabled={!name.trim()}
            className="h-12 font-heading text-sm font-bold tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 uppercase"
          >
            DROP IN <ChevronRight size={16} className="ml-1" />
          </Button>
        </motion.div>

        {/* Controls cheat sheet */}
        <motion.div
          className="w-full hud-panel rounded-lg p-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="font-heading text-xs text-primary/70 uppercase tracking-widest mb-3">
            Controls
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            {[
              ["WASD", "Move"],
              ["Shift", "Sprint"],
              ["Mouse", "Aim"],
              ["LMB", "Shoot"],
              ["E", "Auto-pickup"],
              ["Q", "Swap weapon"],
            ].map(([key, action]) => (
              <div key={key} className="flex gap-2 items-center">
                <span className="font-heading font-bold text-primary/90 bg-card/60 px-1.5 py-0.5 rounded text-[10px] min-w-[32px] text-center">
                  {key}
                </span>
                <span className="text-muted-foreground">{action}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Leaderboard button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            data-ocid="game.secondary_button"
            variant="outline"
            className="font-heading text-xs tracking-widest uppercase border-primary/30 text-muted-foreground hover:text-foreground hover:border-primary/60"
            onClick={() => {
              // Handled by parent
              document.dispatchEvent(new CustomEvent("show-leaderboard"));
            }}
          >
            <Trophy size={14} className="mr-2" /> Leaderboard
          </Button>
        </motion.div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground/40">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-muted-foreground/70 pointer-events-auto"
          >
            caffeine.ai
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// ============ END SCREEN ============
function EndScreen({
  hud,
  playerName,
  onRestart,
}: {
  hud: HUDState;
  playerName: string;
  onRestart: () => void;
}) {
  const submitMatch = useSubmitMatch();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    await submitMatch.mutateAsync({
      playerName,
      kills: hud.kills,
      placement: hud.placement,
      survivalTime: hud.survivalTime,
    });
    setSubmitted(true);
  };

  return (
    <motion.div
      data-ocid="game.end_panel"
      className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="flex flex-col items-center gap-6 max-w-sm w-full px-6"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Result banner */}
        <div className="text-center">
          {hud.won ? (
            <>
              <div className="font-heading text-xs tracking-[0.4em] text-primary/70 uppercase mb-2">
                Victory Royale
              </div>
              <h2 className="font-heading text-5xl font-black text-primary leading-none">
                WINNER!
              </h2>
              <div className="font-heading text-lg text-primary/70 mt-1">
                CHICKEN DINNER
              </div>
            </>
          ) : (
            <>
              <div className="font-heading text-xs tracking-[0.4em] text-destructive/70 uppercase mb-2">
                Match Over
              </div>
              <h2 className="font-heading text-5xl font-black text-destructive leading-none">
                ELIMINATED
              </h2>
              <div className="font-heading text-lg text-muted-foreground mt-1">
                {ordinal(hud.placement)} place
              </div>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="w-full hud-panel rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <Skull size={16} className="text-destructive mx-auto mb-1" />
            <div className="font-heading text-2xl font-black text-foreground">
              {hud.kills}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Kills
            </div>
          </div>
          <div>
            <Target size={16} className="text-primary mx-auto mb-1" />
            <div className="font-heading text-2xl font-black text-foreground">
              #{hud.placement}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Place
            </div>
          </div>
          <div>
            <Clock size={16} className="text-foreground/60 mx-auto mb-1" />
            <div className="font-heading text-2xl font-black text-foreground">
              {formatTime(hud.survivalTime)}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Time
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-2">
          {!submitted ? (
            <Button
              data-ocid="game.submit_button"
              onClick={handleSubmit}
              disabled={submitMatch.isPending}
              className="w-full h-11 font-heading text-sm font-bold tracking-widest bg-primary text-primary-foreground uppercase"
            >
              {submitMatch.isPending ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  <span data-ocid="game.submit_button.loading_state">
                    Submitting...
                  </span>
                </>
              ) : (
                "Submit Score"
              )}
            </Button>
          ) : (
            <div
              data-ocid="game.submit_button.success_state"
              className="w-full h-11 flex items-center justify-center gap-2 font-heading text-sm font-bold tracking-widest text-primary border border-primary/40 rounded-md"
            >
              <Trophy size={14} /> Score Submitted!
            </div>
          )}
          <Button
            data-ocid="game.primary_button"
            variant="outline"
            onClick={onRestart}
            className="w-full h-11 font-heading text-sm font-bold tracking-widest uppercase border-primary/30 hover:border-primary/60"
          >
            Play Again
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============ LEADERBOARD ============
function LeaderboardScreen({ onBack }: { onBack: () => void }) {
  const { data: topKills, isLoading: killsLoading } = useTopKills();
  const { data: topPlacements, isLoading: placementsLoading } =
    useTopPlacements();

  return (
    <motion.div
      data-ocid="game.leaderboard_panel"
      className="absolute inset-0 tactical-bg flex items-center justify-center"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
    >
      <div className="flex flex-col items-center gap-6 max-w-lg w-full px-6 py-8">
        <div className="flex items-center gap-3">
          <Trophy size={20} className="text-primary" />
          <h2 className="font-heading text-3xl font-black text-foreground tracking-tight">
            Leaderboard
          </h2>
        </div>

        <Tabs defaultValue="kills" className="w-full">
          <TabsList className="w-full bg-card/50 border border-border mb-4">
            <TabsTrigger
              data-ocid="game.leaderboard_kills_tab"
              value="kills"
              className="flex-1 font-heading text-xs tracking-widest uppercase"
            >
              Top Kills
            </TabsTrigger>
            <TabsTrigger
              data-ocid="game.leaderboard_placements_tab"
              value="placements"
              className="flex-1 font-heading text-xs tracking-widest uppercase"
            >
              Top Placements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kills">
            <LeaderboardTable
              entries={topKills ?? []}
              loading={killsLoading}
              sortKey="kills"
            />
          </TabsContent>
          <TabsContent value="placements">
            <LeaderboardTable
              entries={topPlacements ?? []}
              loading={placementsLoading}
              sortKey="placement"
            />
          </TabsContent>
        </Tabs>

        <Button
          data-ocid="game.secondary_button"
          variant="outline"
          onClick={onBack}
          className="font-heading text-xs tracking-widest uppercase border-primary/30 hover:border-primary/60"
        >
          Back to Menu
        </Button>
      </div>
    </motion.div>
  );
}

function LeaderboardTable({
  entries,
  loading,
}: {
  entries: Entry[];
  loading: boolean;
  sortKey: "kills" | "placement";
}) {
  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        data-ocid="game.leaderboard_panel.loading_state"
      >
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  const sorted = [...entries].slice(0, 10);

  return (
    <div className="w-full hud-panel rounded-lg overflow-hidden">
      <div className="grid grid-cols-[40px_1fr_60px_60px_70px] gap-0 text-xs font-heading uppercase tracking-widest text-muted-foreground border-b border-border">
        <div className="px-3 py-2">#</div>
        <div className="px-2 py-2">Callsign</div>
        <div className="px-2 py-2 text-right">Kills</div>
        <div className="px-2 py-2 text-right">Place</div>
        <div className="px-2 py-2 text-right">Time</div>
      </div>
      {sorted.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No entries yet
        </div>
      )}
      {sorted.map((entry, idx) => {
        const ocid =
          `game.leaderboard_row.${idx + 1}` as `game.leaderboard_row.${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`;
        return (
          <div
            key={entry.id.toString()}
            data-ocid={ocid}
            className={`grid grid-cols-[40px_1fr_60px_60px_70px] gap-0 text-sm border-b border-border/50 last:border-0 ${
              idx === 0 ? "bg-primary/5" : idx < 3 ? "bg-card/30" : ""
            }`}
          >
            <div className="px-3 py-2.5 font-heading font-bold text-muted-foreground/60">
              {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
            </div>
            <div className="px-2 py-2.5 font-heading font-semibold text-foreground truncate">
              {entry.playerName}
            </div>
            <div className="px-2 py-2.5 text-right font-heading font-bold text-destructive">
              {entry.kills.toString()}
            </div>
            <div className="px-2 py-2.5 text-right font-heading text-foreground">
              {ordinal(Number(entry.placement))}
            </div>
            <div className="px-2 py-2.5 text-right font-heading text-muted-foreground text-xs">
              {formatTime(Number(entry.survivalTime))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ MAIN GAME PAGE ============
export default function Game() {
  const [phase, setPhase] = useState<GamePhase>("start");
  const [playerName, setPlayerName] = useState("Ghost");
  const [hud, setHud] = useState<HUDState>({
    health: 100,
    armor: 0,
    ammo: 12,
    maxAmmo: 12,
    weaponName: "Pistol",
    secondaryWeapon: null,
    kills: 0,
    aliveCount: 21,
    zoneText: "Zone closes in 60s",
    zoneWarning: false,
    gameOver: false,
    won: false,
    survivalTime: 0,
    placement: 21,
    killNotifications: [],
  });
  const prevGameOver = useRef(false);

  // Listen for leaderboard event from start screen
  useEffect(() => {
    const handler = () => setPhase("leaderboard");
    document.addEventListener("show-leaderboard", handler);
    return () => document.removeEventListener("show-leaderboard", handler);
  }, []);

  const handleHUDUpdate = useCallback((newHud: HUDState) => {
    setHud(newHud);
    if (newHud.gameOver && !prevGameOver.current) {
      prevGameOver.current = true;
      setTimeout(() => setPhase("ended"), 800);
    }
  }, []);

  const handleStart = (name: string) => {
    setPlayerName(name);
    prevGameOver.current = false;
    setPhase("playing");
  };

  const handleRestart = () => {
    prevGameOver.current = false;
    setPhase("start");
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Game canvas - always rendered when playing */}
      {phase === "playing" && (
        <GameCanvas onHUDUpdate={handleHUDUpdate} running={true} />
      )}

      {/* HUD overlay - only shown while playing */}
      {phase === "playing" && <GameHUD hud={hud} />}

      {/* Screen overlays */}
      <AnimatePresence mode="wait">
        {phase === "start" && <StartScreen key="start" onStart={handleStart} />}
        {phase === "ended" && (
          <EndScreen
            key="end"
            hud={hud}
            playerName={playerName}
            onRestart={handleRestart}
          />
        )}
        {phase === "leaderboard" && (
          <LeaderboardScreen
            key="leaderboard"
            onBack={() => setPhase("start")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
