import { Tool } from "@/types";

type ToolLike = Pick<Tool, "id" | "config">;

export function getEnabledToolIds(tools: ToolLike[]): string[] {
  return tools
    .filter((tool) => tool.config.enabled)
    .map((tool) => tool.id)
    .sort();
}
