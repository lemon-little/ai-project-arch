# VERL Architecture Atlas - TDD Evidence

## Scope

The atlas turns one VERL repository analysis into eight independently delivered Archify diagrams and one searchable navigation shell.

## User Journeys

- As a VERL reader, I can open one URL and navigate every major architecture view.
- As a reader, I can search diagrams with Chinese or English terms and share a stable selected-view URL.
- As a desktop or mobile reader, I can use the atlas without outer-page overflow or overlapping controls.
- As a reviewer, I can trace architecture nodes back to verified repository sources.

## RED Evidence

1. `node --test docs/archify/tests/atlas.test.mjs` failed with `ERR_MODULE_NOT_FOUND` before `catalog.mjs` existed.
2. After the catalog shell was implemented, the same target failed because ready entries had no delivered HTML: `ENOENT ... diagrams/01-overview.html`.
3. Initial Archify visual checks exposed vertical overflow in seven standalone topic diagrams; those diagrams were widened and redelivered until every receipt passed.
4. The atlas embed contract initially failed because diagram URLs omitted `embed=1` and the workspace had no selected-view context bar; both failures were fixed before browser verification.

## GREEN Evidence

| Guarantee | Validation | Result |
|---|---|---|
| Catalog contains exactly eight ordered, ready views | `node --test docs/archify/tests/atlas.test.mjs` | PASS |
| Chinese and English search terms select the intended views | same test target | PASS |
| Theme-aware URLs and missing-view fallback are deterministic | same test target | PASS |
| Atlas frames use Archify embed mode while independent opens retain the full page | same test target + Chromium inspection | PASS |
| Every ready item resolves to a standalone Archify HTML with SVG | same test target | PASS |
| Every diagram passes showcase composition checks | `archify validate` / `archify deliver` | 8/8 diagrams, 9/9 checks, 0 errors, 0 warnings |
| Every standalone diagram fits four desktop sizes in light and dark themes | `archify visual-check` | 8/8 receipts PASS |
| All navigation items load the expected title and rendered SVG | `agent-browser` full catalog traversal | 8/8 PASS |
| Desktop and 390x844 mobile shells have no outer overflow | `agent-browser` viewport checks | PASS |

## Browser Evidence

- `visual-evidence/atlas-desktop-light.png`
- `visual-evidence/atlas-desktop-dark-modes.png`
- `visual-evidence/atlas-mobile-closed.png`
- `visual-evidence/atlas-mobile-drawer.png`
- Per-diagram light/dark screenshots and receipts are stored beside each HTML in `diagrams/`.

## Known Gaps

- No package-level coverage script exists for this static documentation surface. Pure catalog behavior is covered by Node tests; DOM behavior is covered through Chromium E2E checks.
- No Git checkpoint commits were created because this delivery did not include authorization to modify repository history.
