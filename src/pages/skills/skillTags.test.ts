import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyTagFilterAction,
  buildAllTagSummaries,
  buildSkillTagSummaries,
  filterSkills,
  getGroupMetadataKey,
  getGroupTags,
  getTagFilterSelectionSummary,
  hasSelectableTagFilters,
  normalizeSkillTags,
  updateMetadataTags,
} from "./skillTags.ts";

const skills = [
  {
    id: "react-playground",
    name: "React Playground",
    description: null,
    version: "1.0.0",
    source: "local" as const,
    enabled: {},
    path: "/tmp/react-playground",
  },
  {
    id: "cli-helper",
    name: "CLI Helper",
    description: null,
    version: "1.0.0",
    source: "local" as const,
    enabled: {},
    path: "/tmp/cli-helper",
  },
  {
    id: "notes",
    name: "Daily Notes",
    description: null,
    version: "1.0.0",
    source: "local" as const,
    enabled: {},
    path: "/tmp/notes",
  },
];

const metadata = {
  "react-playground": { tags: ["react", "frontend", "agent flow"] },
  "cli-helper": { tags: ["cli", "frontend"] },
  notes: { tags: [] },
};

test("normalizeSkillTags trims blanks, lowercases values, collapses whitespace, and removes duplicates", () => {
  assert.deepEqual(
    normalizeSkillTags(["  React  ", "", "Agent   Flow", "react", " agent flow  ", "CLI"]),
    ["react", "agent flow", "cli"],
  );
});

test("buildSkillTagSummaries aggregates tags by usage count and sorts them deterministically", () => {
  assert.deepEqual(buildSkillTagSummaries(skills, metadata), [
    { tag: "frontend", count: 2 },
    { tag: "agent flow", count: 1 },
    { tag: "cli", count: 1 },
    { tag: "react", count: 1 },
  ]);
});

test("filterSkills matches search query against skill name, id, and tags", () => {
  assert.deepEqual(
    filterSkills(skills, metadata, { searchQuery: "agent", selectedTags: [], untaggedOnly: false }).map(
      (skill) => skill.id,
    ),
    ["react-playground"],
  );

  assert.deepEqual(
    filterSkills(skills, metadata, { searchQuery: "cli-helper", selectedTags: [], untaggedOnly: false }).map(
      (skill) => skill.id,
    ),
    ["cli-helper"],
  );
});

test("filterSkills applies multi-tag intersection and supports untagged-only mode", () => {
  assert.deepEqual(
    filterSkills(skills, metadata, {
      searchQuery: "",
      selectedTags: ["frontend"],
      untaggedOnly: false,
    }).map((skill) => skill.id),
    ["react-playground", "cli-helper"],
  );

  assert.deepEqual(
    filterSkills(skills, metadata, {
      searchQuery: "",
      selectedTags: ["frontend", "react"],
      untaggedOnly: false,
    }).map((skill) => skill.id),
    ["react-playground"],
  );

  assert.deepEqual(
    filterSkills(skills, metadata, {
      searchQuery: "",
      selectedTags: [],
      untaggedOnly: true,
    }).map((skill) => skill.id),
    ["notes"],
  );
});

test("hasSelectableTagFilters only returns true when at least one real tag exists", () => {
  assert.equal(hasSelectableTagFilters(buildSkillTagSummaries(skills, metadata)), true);
  assert.equal(hasSelectableTagFilters([]), false);
  assert.equal(
    hasSelectableTagFilters(buildSkillTagSummaries(skills, {
      "react-playground": { tags: [] },
      "cli-helper": { tags: [] },
      notes: { tags: [] },
    })),
    false,
  );
});

test("getTagFilterSelectionSummary describes toolbar state for all, untagged, single tag, and multi-tag", () => {
  assert.deepEqual(getTagFilterSelectionSummary([], false), { kind: "all" });
  assert.deepEqual(getTagFilterSelectionSummary([], true), { kind: "untagged" });
  assert.deepEqual(getTagFilterSelectionSummary(["react"], false), { kind: "single", tag: "react" });
  assert.deepEqual(getTagFilterSelectionSummary(["react", "cli"], false), { kind: "multiple", count: 2 });
});

test("applyTagFilterAction closes the menu after selecting a tag, toggling untagged, or resetting", () => {
  assert.deepEqual(
    applyTagFilterAction(
      { selectedTags: [], untaggedOnly: false },
      { type: "toggle-tag", tag: "react" },
    ),
    { selectedTags: ["react"], untaggedOnly: false, closeMenu: true },
  );

  assert.deepEqual(
    applyTagFilterAction(
      { selectedTags: ["react"], untaggedOnly: false },
      { type: "toggle-untagged" },
    ),
    { selectedTags: [], untaggedOnly: true, closeMenu: true },
  );

  assert.deepEqual(
    applyTagFilterAction(
      { selectedTags: ["react"], untaggedOnly: true },
      { type: "reset" },
    ),
    { selectedTags: [], untaggedOnly: false, closeMenu: true },
  );
});

test("group tag helpers normalize, persist, and read group tags by metadata key", () => {
  const groupMetadataKey = getGroupMetadataKey("pkg.team");
  const nextMetadata = updateMetadataTags(groupMetadataKey, [" Workspace ", "workspace", "Team Ops"], metadata);

  assert.deepEqual(nextMetadata[groupMetadataKey], { tags: ["workspace", "team ops"] });
  assert.deepEqual(getGroupTags("pkg.team", nextMetadata), ["workspace", "team ops"]);
});

test("group tag helpers remove the group metadata entry when tags become empty", () => {
  const groupMetadataKey = getGroupMetadataKey("pkg.team");
  const metadataWithGroup = updateMetadataTags(groupMetadataKey, ["workspace"], metadata);
  const nextMetadata = updateMetadataTags(groupMetadataKey, [], metadataWithGroup);

  assert.equal(groupMetadataKey in nextMetadata, false);
  assert.deepEqual(getGroupTags("pkg.team", nextMetadata), []);
});

test("buildAllTagSummaries includes group tags so top-level filters can see them", () => {
  assert.deepEqual(
    buildAllTagSummaries({
      ...metadata,
      "group:pkg.team": { tags: ["workspace", "frontend"] },
    }),
    [
      { tag: "frontend", count: 3 },
      { tag: "agent flow", count: 1 },
      { tag: "cli", count: 1 },
      { tag: "react", count: 1 },
      { tag: "workspace", count: 1 },
    ],
  );
});
