import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./styles.css";
import "./workspace.css";
import "./frontend.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("LENS LAB could not find its application root element.");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
