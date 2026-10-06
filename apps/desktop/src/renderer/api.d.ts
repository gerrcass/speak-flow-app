export interface DesktopApi {
  sidecarHealth: () => Promise<string>;
}

declare global {
  interface Window {
    api: DesktopApi;
  }
}
