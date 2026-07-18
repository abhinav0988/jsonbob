import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallbackTitle?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[jsonbob] ErrorBoundary", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold text-[var(--jb-text)]">
          {this.props.fallbackTitle ?? "Something went wrong"}
        </h1>
        <p className="max-w-md text-sm text-[var(--jb-muted)]">
          {this.state.error.message || "An unexpected error occurred in this view."}
        </p>
        <button
          type="button"
          className="jb-action jb-action-primary"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
