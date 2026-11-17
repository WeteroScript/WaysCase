import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready(): void;
        expand(): void;
        setHeaderColor?(color: string): void;
        setBackgroundColor?(color: string): void;
        initDataUnsafe?: { user?: { id?: number; first_name?: string; username?: string } };
      };
    };
  }
}

const webApp = window.Telegram?.WebApp;
webApp?.ready();
webApp?.expand();
webApp?.setHeaderColor?.("#090a12");
webApp?.setBackgroundColor?.("#090a12");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
