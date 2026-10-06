export interface SttConfig {
  port: number;
  token: string;
}

export type BundledPackName = "phrases_100.json" | "prompts_30.json" | "minimal_pairs.json";

export type GenerateProvider = "local" | "byok";

export interface GenerateContentRequest {
  provider: GenerateProvider;
  level: string;
  focus: string;
  count: number;
  key?: string;
}

export interface GeneratedContentItem {
  text: string;
  level: string;
  tags: string[];
}

export interface GeneratedContent {
  provider: GenerateProvider;
  level: string;
  focus: string;
  items: GeneratedContentItem[];
  offline: boolean;
}

export interface TtsExample {
  audio: string;
  engine: "piper" | "stub";
}

import type { AttemptRow } from "../freetalk/store.ts";
export type { AttemptRow };

export interface SrsCardForView {
  phraseId: string;
  nextDue: string;
  ease: number;
}

export interface ModelStatus {
  model: string;
  downloaded: boolean;
  path: string;
}

export interface DesktopApi {
  sidecarHealth: () => Promise<string>;
  sttConfig: () => Promise<SttConfig>;
  readContentPack: (name: BundledPackName) => Promise<string>;
  generateContent: (request: GenerateContentRequest) => Promise<GeneratedContent>;
  ttsExample: (text: string) => Promise<TtsExample>;
  saveAttempt: (row: AttemptRow) => Promise<boolean>;
  listAttempts: () => Promise<AttemptRow[]>;
  listDueCards: (now: string) => Promise<SrsCardForView[]>;
  modelStatus: () => Promise<ModelStatus>;
}

declare global {
  interface Window {
    api: DesktopApi;
  }
}
