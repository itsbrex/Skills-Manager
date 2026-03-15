export function computeMissingSkills<T extends { id: string }>(
  remote: T[],
  local: { id: string }[],
): T[] {
  const localIds = new Set(local.map((skill) => skill.id));
  return remote.filter((skill) => !localIds.has(skill.id));
}
