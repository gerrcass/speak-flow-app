// Preload bridge: renderer asks the sidecar /health through here.
// Reads SIDECAR_PORT/SIDECAR_TOKEN from the main-process environment.
import { contextBridge } from "electron";

async function sidecarHealth(): Promise<string> {
  const port = process.env.SIDECAR_PORT ?? "4317";
  const token = process.env.SIDECAR_TOKEN ?? "";
  const response = await fetch(`http://127.0.0.1:${port}/health`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`sidecar unhealthy: ${response.status}`);
  const body = (await response.json()) as { status?: string };
  return body.status ?? "unknown";
}

contextBridge.exposeInMainWorld("api", { sidecarHealth });
