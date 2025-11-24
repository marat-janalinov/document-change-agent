import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log('[main.tsx] Инициализация React приложения');
const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error('[main.tsx] ОШИБКА: элемент #root не найден в DOM!');
  document.body.innerHTML = '<div style="padding: 20px; color: red; font-size: 18px;">ОШИБКА: элемент #root не найден в DOM!</div>';
} else {
  console.log('[main.tsx] Элемент #root найден, монтируем React приложение');
  try {
    const root = createRoot(rootElement);
    root.render(<App />);
    console.log('[main.tsx] React приложение успешно смонтировано');
  } catch (error) {
    console.error('[main.tsx] ОШИБКА при монтировании React:', error);
    rootElement.innerHTML = `<div style="padding: 20px; color: red; font-size: 18px;">ОШИБКА при монтировании React: ${error}</div>`;
  }
}
