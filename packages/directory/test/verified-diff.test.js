import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import { diffSpecs } from "../scripts/diff.mjs";

const before = JSON.parse(await fs.readFile(new URL("./fixtures/spec-before.json", import.meta.url), "utf8"));
const after = JSON.parse(await fs.readFile(new URL("./fixtures/spec-after.json", import.meta.url), "utf8"));

describe("Apipuccino Verified — semantic spec diff (real OpenAPI docs)", () => {
  const changes = diffSpecs(before, after).map((c) => `${c.severity}:${c.change}`);
  it("flags removed operation as breaking", () => {
    expect(changes).toContain("breaking:removed_operation");
  });
  it("flags added operation as additive", () => {
    expect(changes).toContain("additive:added_operation");
  });
  it("flags added object property as additive (not silent — closes the field-level gap)", () => {
    expect(changes).toContain("additive:property_added");
  });
  it("does NOT emit a false breaking change for an additive property", () => {
    expect(changes).not.toContain("breaking:type_changed");
  });
});

describe("Apipuccino Verified — breaking type change", () => {
  const b = {
    openapi: "3.0.0", info: { title: "x", version: "1" },
    paths: { "/x": { get: { responses: { "200": { content: { "application/json": { schema: { type: "string" } } } } } } } },
  };
  const a = {
    openapi: "3.0.0", info: { title: "x", version: "1" },
    paths: { "/x": { get: { responses: { "200": { content: { "application/json": { schema: { type: "object" } } } } } } } },
  };
  const changes = diffSpecs(b, a).map((c) => `${c.severity}:${c.change}`);
  it("flags a response type change as breaking", () => {
    expect(changes).toContain("breaking:type_changed");
  });
});
