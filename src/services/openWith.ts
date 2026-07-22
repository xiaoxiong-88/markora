import { listen } from "@tauri-apps/api/event";
import { backend, isTauri } from "./backend";
import { openFilePath } from "./actions";

/**
 * Handles files handed to the app by the OS "Open With" mechanism (macOS
 * `RunEvent::Opened`, also fired for files dropped on the dock icon).
 * Two delivery paths: a live event while the app is running, and a pending
 * queue drained here for cold launches, where the OS event can arrive before
 * the frontend has attached its listener.
 */
export async function consumeOpenWithFiles(): Promise<void> {
  if (!isTauri()) return;
  await listen<string[]>("markora://open-files", (event) => {
    void openPaths(event.payload);
  });
  const pending = await backend.takePendingOpens().catch(() => [] as string[]);
  await openPaths(pending);
}

async function openPaths(paths: string[]): Promise<void> {
  for (const path of paths) {
    await openFilePath(path);
  }
}
