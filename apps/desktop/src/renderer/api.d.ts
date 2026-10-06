export interface SttConfig {
  port: number;
  token: string;
}

export interface DesktopApi {
  sidecarHealth: () => Promise<string>;
  sttConfig: () => Promise<SttConfig>;
}

declare global {
  interface Window {
    api: DesktopApi;
  }
}
