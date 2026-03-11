import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMarketplaceMetaItems } from "./buildMarketplaceMetaItems.ts";

test("buildMarketplaceMetaItems puts install count to the right of author when author exists", () => {
  const items = buildMarketplaceMetaItems("来源: skills.sh", "作者: composiohq", "2");

  assert.deepEqual(
    items.map((item) => item.kind),
    ["source", "author", "install_count"],
  );
});

test("buildMarketplaceMetaItems keeps install count when author is missing", () => {
  const items = buildMarketplaceMetaItems("来源: skills.sh", null, "2");

  assert.deepEqual(
    items.map((item) => item.kind),
    ["source", "install_count"],
  );
});
