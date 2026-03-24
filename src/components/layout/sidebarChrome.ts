export interface SidebarChromeMetrics {
  topSpacerHeight: number;
  brandPadding: string;
  navPadding: string;
}

const MAC_SIDEBAR_CHROME: SidebarChromeMetrics = {
  topSpacerHeight: 52,
  brandPadding: "0 20px 12px 20px",
  navPadding: "8px",
};

const DEFAULT_SIDEBAR_CHROME: SidebarChromeMetrics = {
  topSpacerHeight: 20,
  brandPadding: "4px 20px 10px 20px",
  navPadding: "6px 8px 8px",
};

export function getSidebarChromeMetrics(userAgent: string): SidebarChromeMetrics {
  const normalized = userAgent.toLowerCase();
  const isMacLike = normalized.includes("macintosh") || normalized.includes("mac os");

  return isMacLike ? MAC_SIDEBAR_CHROME : DEFAULT_SIDEBAR_CHROME;
}
