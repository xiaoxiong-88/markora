import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "@/i18n";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** React error boundary: a crash in any subtree shows a recoverable screen
 *  instead of a white page (SPEC: React Error Boundary). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced only in dev; never shows raw stacks to users in release.
    if (import.meta.env.DEV) {
      console.error("[Markora] render error:", error, info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const strings = t().error;
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-3 p-8"
        role="alert"
      >
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-lg font-semibold text-[var(--fg-primary)]">{strings.title}</h1>
          <p className="mb-1 text-sm text-[var(--fg-secondary)]">{strings.generic}</p>
          <details className="mx-auto mt-3 max-w-sm text-left">
            <summary className="cursor-pointer text-xs text-[var(--fg-muted)]">
              {strings.details}
            </summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-[var(--bg-secondary)] p-3 font-mono text-[11px] text-[var(--fg-secondary)]">
              {error.message}
            </pre>
          </details>
        </div>
        <button type="button" className="rounded-md bg-[var(--bg-tertiary)] px-4 py-1.5 text-sm" onClick={this.reset}>
          {strings.dismiss}
        </button>
      </div>
    );
  }
}
