import { useEffect, useRef } from "react";
import type { InputState } from "./types";

export function useInput(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
): React.RefObject<InputState> {
  const inputRef = useRef<InputState>({
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onKeyDown = (e: KeyboardEvent) => {
      inputRef.current.keys.add(e.key.toLowerCase());
      // Prevent arrow key scrolling, space scrolling
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
      ) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      inputRef.current.keys.delete(e.key.toLowerCase());
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      inputRef.current.mouseX = e.clientX - rect.left;
      inputRef.current.mouseY = e.clientY - rect.top;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.mouseDown = true;
        inputRef.current.mouseClicked = true;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.mouseDown = false;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [canvasRef]);

  return inputRef;
}
