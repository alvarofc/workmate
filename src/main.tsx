import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { OpenCodeProvider } from "@/contexts/OpenCodeContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <OpenCodeProvider>
      <App />
    </OpenCodeProvider>
  </React.StrictMode>,
);
