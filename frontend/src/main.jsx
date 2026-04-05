/**
 * main.jsx — React 앱 진입점
 *
 * React 18의 createRoot API를 사용한다.
 * StrictMode는 개발 환경에서 잠재적인 문제를 감지하는 래퍼다.
 * (production 빌드에서는 자동으로 비활성화된다)
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
