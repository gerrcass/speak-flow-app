// Seam (c): history-list text shaping — pure, tested with literals.
// Glossary: Transcript (what STT heard).
// RED: fails until apps/desktop/src/freetalk/history.ts exists.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { snippet } from "../src/freetalk/history.ts";

test("short Transcript renders whole", () => {
  assert.equal(snippet("My family is big."), "My family is big.");
});

test("long Transcript truncates to 80 chars with an ellipsis", () => {
  const long = `word ${"very ".repeat(30)}long talk`;
  const cut = snippet(long);
  assert.equal(cut.length, 80);
  assert.ok(cut.endsWith("…"));
  assert.ok(long.startsWith(cut.slice(0, 79)));
});

test("newlines collapse to spaces", () => {
  assert.equal(snippet("hello\n  world"), "hello world");
});
