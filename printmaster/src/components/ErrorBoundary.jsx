import { Component } from "react";

/**
 * Task 5.4 – React Error Boundary
 * Wraps major page components so an unhandled JS error in one page
 * doesn't crash the entire application shell.
 *
 * Usage:
 *   <ErrorBoundary name="Billing">
 *     <SimpleBillingPage ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary:${this.props.name || "unknown"}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const name = this.props.name || "This page";
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 16,
        fontFamily: "Inter, system-ui, sans-serif",
        textAlign: "center",
        padding: "40px 24px",
      }}>
        <div style={{ fontSize: 48, lineHeight: 1 }}>⚠️</div>
        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>
          {name} ran into a problem
        </div>
        <div style={{ fontSize: "0.875rem", color: "#6b7280", maxWidth: 420, lineHeight: 1.6 }}>
          An unexpected error occurred. Your data is safe — this only affects the current view.
          {this.state.error?.message && (
            <><br /><code style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 8, display: "block" }}>
              {this.state.error.message}
            </code></>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "1px solid #d1d5db",
              background: "white", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem", color: "#374151",
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: "#4f46e5", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem", color: "white",
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
