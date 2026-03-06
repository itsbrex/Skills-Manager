export interface MarketplaceMetaItem {
  key: string;
  kind: "source" | "author" | "install_count";
  label: string;
}

export function buildMarketplaceMetaItems(
  sourceLabel: string,
  authorLabel?: string | null,
  installCountLabel?: string | null,
): MarketplaceMetaItem[] {
  const items: MarketplaceMetaItem[] = [
    { key: "source", kind: "source", label: sourceLabel },
  ];

  if (authorLabel) {
    items.push({ key: "author", kind: "author", label: authorLabel });
  }

  if (installCountLabel) {
    items.push({
      key: "install_count",
      kind: "install_count",
      label: installCountLabel,
    });
  }

  return items;
}
