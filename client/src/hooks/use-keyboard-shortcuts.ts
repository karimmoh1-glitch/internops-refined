import { useEffect, useCallback } from "react";

interface ShortcutHandler {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  handler: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : true;
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && metaMatch && ctrlMatch && shiftMatch) {
          // Allow meta/ctrl shortcuts even in inputs
          if (isInput && !shortcut.meta && !shortcut.ctrl) continue;

          e.preventDefault();
          e.stopPropagation();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export function getShortcutLabel(meta?: boolean, shift?: boolean, key?: string): string {
  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const parts: string[] = [];
  if (meta) parts.push(isMac ? "\u2318" : "Ctrl");
  if (shift) parts.push(isMac ? "\u21E7" : "Shift");
  if (key) parts.push(key.toUpperCase());
  return parts.join(isMac ? "" : "+");
}
