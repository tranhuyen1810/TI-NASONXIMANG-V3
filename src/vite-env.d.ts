/// <reference types="vite/client" />

interface DesktopAPI {
  getApiBaseUrl: () => Promise<string>;
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}
