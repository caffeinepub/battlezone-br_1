import { useCallback, useEffect, useRef } from "react";

type LoopCallback = (delta: number, timestamp: number) => void;

export function useGameLoop(callback: LoopCallback, running: boolean): void {
  const callbackRef = useRef<LoopCallback>(callback);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const runningRef = useRef<boolean>(running);

  // Keep callback ref fresh
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  const loop = useCallback((timestamp: number) => {
    if (!runningRef.current) return;

    const delta =
      lastTimeRef.current === 0
        ? 0.016
        : Math.min((timestamp - lastTimeRef.current) / 1000, 0.05); // cap at 50ms

    lastTimeRef.current = timestamp;
    callbackRef.current(delta, timestamp);

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (running) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(loop);
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      lastTimeRef.current = 0;
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [running, loop]);
}
