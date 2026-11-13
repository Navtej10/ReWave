import { createRoot } from "react-dom/client";
import { App } from "./App";
import { RoughFilter } from "./components/ui/index"; // explicit: components/ui.ts exists beside the ui/ folder
import "./styles.css";
import "./styles";

createRoot(document.getElementById("root")!).render(
  <>
    <RoughFilter />
    <App />
  </>,
);
