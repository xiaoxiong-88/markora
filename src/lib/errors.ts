import type { AppErrorPayload } from "@/types/ipc";

/** Extract a structured AppErrorPayload from whatever `invoke` threw. */
export function parseInvokeError(err: unknown): AppErrorPayload {
  if (err && typeof err === "object" && "kind" in err) {
    const e = err as { kind: unknown; detail?: unknown };
    if (typeof e.kind === "string") {
      return { kind: e.kind, detail: e.detail };
    }
  }
  if (typeof err === "string") {
    return { kind: "io", detail: err };
  }
  if (err instanceof Error) {
    return { kind: "io", detail: err.message };
  }
  return { kind: "io", detail: String(err) };
}

/** Short technical detail string for expandable error UI. */
export function errorDetail(payload: AppErrorPayload): string {
  if (payload.detail == null) return "";
  if (typeof payload.detail === "string") return payload.detail;
  try {
    return JSON.stringify(payload.detail);
  } catch {
    return String(payload.detail);
  }
}
