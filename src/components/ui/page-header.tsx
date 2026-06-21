import { useRegisterPageHeader } from "@/components/PageHeaderContext";

interface PageHeaderProps {
  title: string;
  actions?: React.ReactNode;
}

/**
 * No longer renders its own bar. Instead it registers the page's title and
 * actions into the TopBar via context, so there is a single header row.
 * Returns null — pages keep using <PageHeader/> unchanged.
 */
export function PageHeader({ title, actions }: PageHeaderProps) {
  useRegisterPageHeader(title, actions);
  return null;
}
