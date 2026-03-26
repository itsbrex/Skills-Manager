import type { Skill, SkillMetadataMap } from "@/types";

export interface SkillTagSummary {
  tag: string;
  count: number;
}

export type TagFilterSelectionSummary =
  | { kind: "all" }
  | { kind: "untagged" }
  | { kind: "single"; tag: string }
  | { kind: "multiple"; count: number };

export interface TagFilterState {
  selectedTags: string[];
  untaggedOnly: boolean;
}

export type TagFilterAction =
  | { type: "toggle-tag"; tag: string }
  | { type: "toggle-untagged" }
  | { type: "reset" };

export interface SkillTagFilters {
  searchQuery: string;
  selectedTags: string[];
  untaggedOnly: boolean;
}

function normalizeSkillTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeSkillTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const value = normalizeSkillTag(tag);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function getSkillTags(skillId: string, skillMetadata?: SkillMetadataMap): string[] {
  return normalizeSkillTags(skillMetadata?.[skillId]?.tags ?? []);
}

export function buildSkillTagSummaries(
  skills: Skill[],
  skillMetadata?: SkillMetadataMap,
): SkillTagSummary[] {
  const counts = new Map<string, number>();

  for (const skill of skills) {
    for (const tag of getSkillTags(skill.id, skillMetadata)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

export function hasSelectableTagFilters(tagSummaries: SkillTagSummary[]): boolean {
  return tagSummaries.length > 0;
}

export function getTagFilterSelectionSummary(
  selectedTags: string[],
  untaggedOnly: boolean,
): TagFilterSelectionSummary {
  const normalizedTags = normalizeSkillTags(selectedTags);

  if (untaggedOnly) {
    return { kind: "untagged" };
  }

  if (normalizedTags.length === 0) {
    return { kind: "all" };
  }

  if (normalizedTags.length === 1) {
    return { kind: "single", tag: normalizedTags[0] };
  }

  return { kind: "multiple", count: normalizedTags.length };
}

export function applyTagFilterAction(
  state: TagFilterState,
  action: TagFilterAction,
): TagFilterState & { closeMenu: true } {
  switch (action.type) {
    case "toggle-tag": {
      const normalizedTag = normalizeSkillTags([action.tag])[0];
      const selectedTags = normalizedTag
        ? state.selectedTags.includes(normalizedTag)
          ? state.selectedTags.filter((tag) => tag !== normalizedTag)
          : [...normalizeSkillTags(state.selectedTags), normalizedTag]
        : normalizeSkillTags(state.selectedTags);

      return {
        selectedTags,
        untaggedOnly: false,
        closeMenu: true,
      };
    }
    case "toggle-untagged":
      return {
        selectedTags: [],
        untaggedOnly: !state.untaggedOnly,
        closeMenu: true,
      };
    case "reset":
      return {
        selectedTags: [],
        untaggedOnly: false,
        closeMenu: true,
      };
  }
}

function matchesSearch(skill: Skill, tags: string[], searchQuery: string): boolean {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return (
    skill.name.toLowerCase().includes(query) ||
    skill.id.toLowerCase().includes(query) ||
    (skill.description?.toLowerCase().includes(query) ?? false) ||
    tags.some((tag) => tag.includes(query))
  );
}

export function filterSkills(
  skills: Skill[],
  skillMetadata: SkillMetadataMap | undefined,
  filters: SkillTagFilters,
): Skill[] {
  const selectedTags = normalizeSkillTags(filters.selectedTags);

  return skills.filter((skill) => {
    const tags = getSkillTags(skill.id, skillMetadata);

    if (!matchesSearch(skill, tags, filters.searchQuery)) {
      return false;
    }

    if (filters.untaggedOnly) {
      return tags.length === 0;
    }

    if (selectedTags.length === 0) {
      return true;
    }

    return selectedTags.every((tag) => tags.includes(tag));
  });
}
