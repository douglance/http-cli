import { useStdin } from "ink";
import { useEffect, useRef } from "react";

export interface MouseEvent {
  x: number;
  y: number;
  button: "left" | "right" | "middle" | "none";
  leftClick: boolean;
  rightClick: boolean;
  scrollUp: boolean;
  scrollDown: boolean;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

type MouseHandler = (event: MouseEvent) => void;

// Global flag to disable mouse handling (e.g., for text selection mode)
let mouseDisabled = false;

export function setMouseDisabled(disabled: boolean): void {
  mouseDisabled = disabled;

  // Actually disable/enable mouse tracking at the terminal level
  if (disabled) {
    // Disable mouse tracking
    process.stdout.write("\x1b[?1000l");
    process.stdout.write("\x1b[?1006l");
  } else {
    // Re-enable mouse tracking
    process.stdout.write("\x1b[?1000h");
    process.stdout.write("\x1b[?1006h");
  }
}

/**
 * Custom hook for mouse event handling in Ink applications
 * Enables mouse tracking via ANSI escape sequences
 * Note: Coordinates are absolute (relative to terminal window)
 */
export function useMouse(handler: MouseHandler): void {
  const { stdin, setRawMode, isRawModeSupported } = useStdin();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!isRawModeSupported) {
      return;
    }

    const handleData = (data: Buffer) => {
      // Skip mouse handling if globally disabled
      if (mouseDisabled) {
        return;
      }

      const str = data.toString();

      // Parse SGR mouse events (CSI < Cb ; Cx ; Cy M/m)
      // Format: \x1b[<button;x;y;M (press) or m (release)
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence required
      const sgrMatch = str.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);

      if (sgrMatch) {
        const [, buttonCode, xStr, yStr, action] = sgrMatch;
        if (!buttonCode || !xStr || !yStr || !action) {
          return;
        }

        const button = parseInt(buttonCode, 10);
        const x = parseInt(xStr, 10) - 1; // Convert to 0-indexed
        const y = parseInt(yStr, 10) - 1; // Convert to 0-indexed
        const isPress = action === "M";

        // Parse button and modifiers
        const btn = button & 3;
        // Modifiers in SGR: 4 = Shift, 8 = Meta, 16 = Ctrl
        const ctrl = !!(button & 16);
        const shift = !!(button & 4);
        const meta = !!(button & 8);

        // Normalize wheel codes to be robust to modifier bits:
        // Base codes: 64 = wheel up, 65 = wheel down
        const baseButton = button & ~(4 | 8 | 16); // mask out Shift/Meta/Ctrl bits
        const scrollUp = baseButton === 64;
        const scrollDown = baseButton === 65;
        const isScroll = scrollUp || scrollDown;

        let buttonName: "left" | "right" | "middle" | "none" = "none";
        if (btn === 0 && !isScroll) {
          buttonName = "left";
        } else if (btn === 1 && !isScroll) {
          buttonName = "middle";
        } else if (btn === 2) {
          buttonName = "right";
        }

        const mouseEvent: MouseEvent = {
          x,
          y,
          button: buttonName,
          leftClick: isPress && btn === 0 && !isScroll,
          rightClick: isPress && btn === 2,
          scrollUp,
          scrollDown,
          ctrl,
          shift,
          meta,
        };

        handlerRef.current(mouseEvent);
      }
    };

    // Enable mouse tracking
    // CSI ? 1000 h = Enable mouse click tracking
    // CSI ? 1002 h = Enable mouse drag tracking (DISABLED - interferes with text selection)
    // CSI ? 1003 h = Enable all mouse motion tracking
    // CSI ? 1006 h = Enable SGR extended mouse mode
    process.stdout.write("\x1b[?1000h"); // Click tracking
    // process.stdout.write("\x1b[?1002h"); // Drag tracking - DISABLED for text selection
    process.stdout.write("\x1b[?1006h"); // SGR mode

    setRawMode(true);
    stdin.on("data", handleData);

    return () => {
      stdin.off("data", handleData);

      // Disable mouse tracking
      process.stdout.write("\x1b[?1000l");
      // process.stdout.write("\x1b[?1002l"); // Drag tracking - DISABLED for text selection
      process.stdout.write("\x1b[?1006l");
    };
  }, [stdin, setRawMode, isRawModeSupported]);
}
