import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const savedTheme = window.localStorage.getItem("examforge_theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
