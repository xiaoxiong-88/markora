import { useEffect } from "react";
import { bindingMatches, eventToBinding, type Command } from "@/features/command-palette/commands";

/**
 * Global keyboard shortcut handler. Reads the single command registry and runs
 * the matching command. Keys that the editor owns (when an editor is focused)
 * are skipped so CodeMirror/Milkdown keep their native behavior.
 */
export function useGlobalShortcuts(commands: Command[]) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const binding = eventToBinding(e);
      if (!binding) return;

      // Let the editors handle their own keys (typing, native shortcuts).
      const target = e.target as HTMLElement | null;
      if (target?.closest(".cm-editor, .milkdown, [contenteditable='true'], textarea, input")) return;

      const match = commands.find((c) => c.shortcut && bindingMatches(binding, c.shortcut));
      if (match) {
        e.preventDefault();
        void match.run();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commands]);
}
