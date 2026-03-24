import { test } from "node:test";
import assert from "node:assert/strict";

test("getSidebarChromeMetrics keeps macOS traffic-light spacing and tightens Windows header spacing", async () => {
  const mod = await import("./sidebarChrome.ts").catch(() => null);

  assert.ok(mod, "expected sidebar chrome helper module to exist");

  const macMetrics = mod.getSidebarChromeMetrics(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  );
  const windowsMetrics = mod.getSidebarChromeMetrics(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  );

  assert.equal(macMetrics.topSpacerHeight, 52);
  assert.equal(windowsMetrics.topSpacerHeight, 20);
  assert.ok(
    windowsMetrics.topSpacerHeight < macMetrics.topSpacerHeight,
    "expected Windows spacing to be tighter than macOS",
  );
  assert.equal(windowsMetrics.brandPadding, "4px 20px 10px 20px");
});
