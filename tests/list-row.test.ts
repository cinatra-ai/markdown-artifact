// @vitest-environment node
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

// The row icon of this package's type, as specs/app-artifacts.html section II, example artifacts-row-icons
// ("Row icons, one per artifact type, light and dark palette"): the type's own icon, drawn at 17 pixels.
const OWN_TYPE = "@cinatra-ai/markdown-artifact:artifact";
const GENERIC_TYPE = "@cinatra-ai/artifact:object";
const GLYPH = "hash";
const GLYPH_PX = "17";
const STROKE_WIDTH = "2";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("the row icon display of specs/app-artifacts.html section II, example artifacts-row-icons", () => {
  it("is declared as the listRow renderer", () => {
    expect(pkg.cinatra.artifact.ui.renderers.listRow).toEqual({
      entry: "./src/renderers/list-row.tsx",
      propsApiVersion: 1,
    });
  });

  it("is reachable through the package exports", () => {
    expect(pkg.exports["./src/renderers/list-row"]).toBe("./src/renderers/list-row.tsx");
  });

  for (const objectType of [OWN_TYPE, GENERIC_TYPE]) {
    it(`draws the ${GLYPH} icon at 17 pixels for ${objectType}`, async () => {
      const { default: ListRow } = await import("../src/renderers/list-row");
      const html = renderToStaticMarkup(createElement(ListRow, { artifact: { objectType } }));
      expect(html.match(/<svg/g) ?? []).toHaveLength(1);
      expect(html).toMatch(new RegExp(`class="[^"]*\\blucide-${GLYPH}\\b`));
      expect(html).toContain(`width="${GLYPH_PX}"`);
      expect(html).toContain(`height="${GLYPH_PX}"`);
      expect(html).toContain(`stroke-width="${STROKE_WIDTH}"`);
      expect(html).toContain('aria-hidden="true"');
    });
  }
});
