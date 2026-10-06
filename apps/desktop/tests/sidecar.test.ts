// Seam (b): Electron main supervises the sidecar /health on 127.0.0.1 with a token.
// RED test: fails until apps/desktop/src/sidecar.ts exists.
import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { test } from "node:test";
import {
  SidecarTimeoutError,
  sidecarAuthHeaders,
  sidecarHealthUrl,
  waitForSidecar,
} from "../src/sidecar.ts";

test("health URL stays on loopback", () => {
  assert.equal(sidecarHealthUrl(4317), "http://127.0.0.1:4317/health");
});

test("auth headers carry the Bearer token", () => {
  assert.deepEqual(sidecarAuthHeaders("abc"), { Authorization: "Bearer abc" });
});

test("waitForSidecar resolves once the sidecar reports ok", async () => {
  let hits = 0;
  const server = createServer((req, res) => {
    hits += 1;
    if (hits < 3 || req.headers.authorization !== "Bearer secret") {
      res.writeHead(401).end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end('{"status":"ok"}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  try {
    await waitForSidecar(port, "secret", { timeoutMs: 5000, intervalMs: 50 });
    assert.ok(hits >= 3);
  } finally {
    server.close();
  }
});

test("waitForSidecar rejects after the timeout", async () => {
  await assert.rejects(
    waitForSidecar(43199, "secret", { timeoutMs: 300, intervalMs: 50 }),
    SidecarTimeoutError,
  );
});
