import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LoadingProvider } from './components/LoadingOverlay.tsx';
import './index.css';

// Global safety wrapper for Response.prototype.json to completely prevent "Unexpected token '<'" crashes
// when the server or reverse proxy returns HTML error pages under high load or container scaling
const originalJson = Response.prototype.json;
Response.prototype.json = async function () {
  const contentType = this.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await originalJson.call(this);
    } catch (e) {
      // Fall through to text parsing if original JSON parser fails
    }
  }

  try {
    const text = await this.text();
    const trimmed = text.trim();
    if (trimmed.toLowerCase().startsWith("<!doctype") || trimmed.toLowerCase().startsWith("<html") || trimmed.toLowerCase().startsWith("<div")) {
      return { error: "เซิร์ฟเวอร์ขัดข้องชั่วคราว (ได้รับหน้าเว็บ HTML แทนข้อมูล JSON) - กรุณาลองใหม่อีกครั้งค่ะ" };
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      return { error: text || `Error ${this.status}: ${this.statusText}` };
    }
  } catch (e) {
    return { error: `Error ${this.status}: ${this.statusText}` };
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LoadingProvider>
        <App />
      </LoadingProvider>
    </ErrorBoundary>
  </StrictMode>,
);
