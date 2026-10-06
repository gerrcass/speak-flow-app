// Pure supervision helpers for the Python sidecar (ADR-0002).
// The Electron main process spawns the sidecar on 127.0.0.1 with a per-boot
// Bearer token, then polls GET /health until it reports {"status": "ok"}.
export function sidecarHealthUrl(port: number): string {
  return `http://127.0.0.1:${port}/health`;
}

export function sidecarAuthHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export class SidecarTimeoutError extends Error {
  constructor(port: number, timeoutMs: number) {
    super(`sidecar on 127.0.0.1:${port} unhealthy after ${timeoutMs}ms`);
    this.name = "SidecarTimeoutError";
  }
}

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

export async function waitForSidecar(
  port: number,
  token: string,
  opts: WaitOptions = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const intervalMs = opts.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(sidecarHealthUrl(port), {
        headers: sidecarAuthHeaders(token),
      });
      if (response.ok) {
        const body = (await response.json()) as { status?: string };
        if (body?.status === "ok") return;
      }
    } catch {
      // Sidecar not up yet; retry until the deadline.
    }
    if (Date.now() >= deadline) throw new SidecarTimeoutError(port, timeoutMs);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
