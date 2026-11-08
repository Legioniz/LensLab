import { Component, type ErrorInfo, type ReactNode } from "react";
import { logError } from "../utils/logger";

interface Props { children: ReactNode }
interface State { failed: boolean; message: string }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { failed: true, message: error.message || "An unexpected application error occurred." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError("react-boundary", error.message, { stack: error.stack, componentStack: info.componentStack });
  }

  render() {
    if (this.state.failed) {
      return <main className="fatal-error-screen"><div className="fatal-error-card"><div className="fatal-error-mark">L</div><h1>LENS LAB needs to recover.</h1><p>{this.state.message}</p><p>The error was recorded in local diagnostics when storage is available. Reload the app after checking the log.</p><button onClick={() => window.location.reload()}>RELOAD APPLICATION</button></div></main>;
    }
    return this.props.children;
  }
}
