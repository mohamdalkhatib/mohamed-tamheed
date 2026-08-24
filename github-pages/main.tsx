import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DailyTasksDashboard } from "../app/DailyTasksDashboard";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DailyTasksDashboard />
  </StrictMode>,
);
