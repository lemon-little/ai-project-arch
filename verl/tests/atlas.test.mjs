import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_DIAGRAM_ID,
  buildDiagramUrl,
  diagrams,
  findDiagram,
  filterDiagrams,
} from "../catalog.mjs";

const atlasRoot = new URL("../", import.meta.url);

test("catalog exposes the complete eight-view VERL atlas", () => {
  assert.equal(diagrams.length, 8);
  assert.equal(DEFAULT_DIAGRAM_ID, "overview");
  assert.deepEqual(
    diagrams.map(({ id }) => id),
    [
      "overview",
      "startup",
      "training-iteration",
      "training-dataflow",
      "worker-backends",
      "training-lifecycle",
      "trainer-modes",
      "other-entrypoints",
    ],
  );
  assert.ok(diagrams.every(({ status }) => status === "ready"));
});

test("search matches Chinese titles, English keywords, and summaries", () => {
  assert.deepEqual(filterDiagrams("资源").map(({ id }) => id), ["startup"]);
  assert.deepEqual(filterDiagrams("rollout").map(({ id }) => id), ["training-dataflow", "worker-backends"]);
  assert.deepEqual(filterDiagrams("SFT").map(({ id }) => id), ["other-entrypoints"]);
  assert.equal(filterDiagrams("not-a-verl-view").length, 0);
});

test("diagram lookup falls back to the overview", () => {
  assert.equal(findDiagram("training-lifecycle").id, "training-lifecycle");
  assert.equal(findDiagram("missing").id, DEFAULT_DIAGRAM_ID);
});

test("diagram URL carries the selected theme without losing the artifact path", () => {
  assert.equal(
    buildDiagramUrl(findDiagram("startup"), "dark"),
    "diagrams/02-startup-orchestration.html?theme=dark",
  );
  assert.equal(
    buildDiagramUrl(findDiagram("overview"), "light"),
    "diagrams/01-overview.html?theme=light",
  );
});

test("diagram URL supports the inspectable Archify embed mode used by the atlas workspace", () => {
  assert.equal(
    buildDiagramUrl(findDiagram("startup"), "dark", { embed: true, inspect: true }),
    "diagrams/02-startup-orchestration.html?theme=dark&embed=1&inspect=1",
  );
});

test("atlas shell has one workspace, compact controls, and accessible navigation", async () => {
  const html = await readFile(new URL("index.html", atlasRoot), "utf8");
  assert.match(html, /<main[^>]+class="[^"]*atlas-main/);
  assert.match(html, /data-testid="diagram-search"/);
  assert.match(html, /data-testid="diagram-list"/);
  assert.match(html, /data-testid="diagram-frame"/);
  assert.match(html, /data-workspace-title/);
  assert.match(html, /data-workspace-summary/);
  assert.match(html, /aria-label="切换主题"/);
  assert.match(html, /aria-label="分享当前视图"/);
  assert.match(html, /aria-label="导出当前图"/);
  assert.doesNotMatch(html, /VERL 架构工作台/);
  assert.doesNotMatch(html, /从仓库入口到运行时闭环/);
});

test("atlas CSS uses restrained radii and reserves scrolling for the navigation list", async () => {
  const css = await readFile(new URL("atlas.css", atlasRoot), "utf8");
  assert.match(css, /--radius-card:\s*8px/);
  assert.match(css, /\.diagram-list\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.workspace\s*\{[^}]*min-width:\s*0/s);
  assert.doesNotMatch(css, /border-radius:\s*(?:1[2-9]|[2-9]\d)px/);
});

test("every ready catalog entry resolves to a delivered Archify artifact", async () => {
  for (const diagram of diagrams) {
    const html = await readFile(new URL(diagram.href, atlasRoot), "utf8");
    assert.ok(html.length > 50_000, `${diagram.id} artifact is unexpectedly small`);
    assert.match(html, /<svg\b/, `${diagram.id} artifact has no SVG`);
    assert.match(html, /data-embed-inspect/, `${diagram.id} has no inspectable embed support`);
  }
});

test("every diagram node has a verified source-code target", async () => {
  for (const diagram of diagrams) {
    const html = await readFile(new URL(diagram.href, atlasRoot), "utf8");
    const evidenceMatch = html.match(
      /<script id="archify-source-evidence-data" type="application\/json">([^<]+)<\/script>/,
    );
    assert.ok(evidenceMatch, `${diagram.id} has no source evidence payload`);
    const evidence = JSON.parse(evidenceMatch[1]);
    const nodeIds = [...html.matchAll(/<g id="node-[^"]+" data-node-id="([^"]+)"/g)].map(
      ([, id]) => id,
    );
    assert.ok(nodeIds.length > 0, `${diagram.id} has no interactive nodes`);
    for (const nodeId of nodeIds) {
      assert.ok(evidence.nodes[nodeId]?.length, `${diagram.id}:${nodeId} has no source link`);
      assert.ok(
        evidence.nodes[nodeId].every(({ href }) => href.startsWith("https://github.com/verl-project/verl/")),
        `${diagram.id}:${nodeId} has an unexpected source target`,
      );
    }
  }
});
