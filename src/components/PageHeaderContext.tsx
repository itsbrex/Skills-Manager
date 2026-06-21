import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface PageHeaderContextValue {
  title: string;
  setHeader: (title: string) => void;
  /** Register a portal target node for page actions. Called by the TopBar. */
  registerActionsTarget: (node: HTMLElement | null) => void;
  /** Subscribe to the current actions target node. Returns an unsubscribe fn. */
  subscribeActionsTarget: (cb: (node: HTMLElement | null) => void) => () => void;
  /** Shared page-level search query (driven by the TopBar scope field). */
  pageSearchQuery: string;
  setPageSearchQuery: (q: string) => void;
  /** Placeholder the active page advertises to the scope search field. */
  pageSearchPlaceholder: string;
  setPageSearchPlaceholder: (p: string) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [pageSearchPlaceholder, setPageSearchPlaceholder] = useState("");

  // The actions target is a DOM node owned by the TopBar. Pages render their
  // actions into it via a React portal. Keeping it as an external subscription
  // (not React state) means action updates never re-render the provider or the
  // subscribed pages — eliminating the render loop entirely.
  let actionsTarget: HTMLElement | null = null;
  const actionsListeners = new Set<(node: HTMLElement | null) => void>();

  const setHeader = useCallback((nextTitle: string) => {
    setTitle((prev) => (prev === nextTitle ? prev : nextTitle));
  }, []);

  const registerActionsTarget = useCallback((node: HTMLElement | null) => {
    actionsTarget = node;
    actionsListeners.forEach((cb) => cb(node));
  }, []);

  const subscribeActionsTarget = useCallback((cb: (node: HTMLElement | null) => void) => {
    actionsListeners.add(cb);
    cb(actionsTarget);
    return () => {
      actionsListeners.delete(cb);
    };
  }, []);

  return (
    <PageHeaderContext.Provider
      value={{
        title,
        setHeader,
        registerActionsTarget,
        subscribeActionsTarget,
        pageSearchQuery,
        setPageSearchQuery,
        pageSearchPlaceholder,
        setPageSearchPlaceholder,
      }}
    >
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeaderState() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error("usePageHeaderState must be used within a PageHeaderProvider");
  return ctx;
}

// TopBar uses this to register the DOM node that receives portalled actions.
export function useActionsTarget() {
  const ctx = useContext(PageHeaderContext);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribeActionsTarget(setTarget);
  }, [ctx]);
  return { target, registerActionsTarget: ctx?.registerActionsTarget };
}

// Pages call this to push their title (string) into context and receive the
// portal target so they can render actions into it. Title goes through context
// (loop-safe). Actions are rendered into the TopBar's portal target, so they
// update naturally on every render without any loop.
export function useRegisterPageHeader(title: string) {
  const ctx = useContext(PageHeaderContext);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!ctx) return;
    ctx.setHeader(title);
    return ctx.subscribeActionsTarget(setTarget);
  }, [ctx, title]);

  return target;
}

// Pages call this to advertise a search placeholder and read the shared query
// that the TopBar scope field writes back. The placeholder is cleared on unmount
// so a page without an in-page search falls back to the default scope hint.
export function usePageSearch(placeholder: string) {
  const ctx = useContext(PageHeaderContext);
  useEffect(() => {
    ctx?.setPageSearchPlaceholder(placeholder);
    return () => ctx?.setPageSearchPlaceholder("");
  }, [ctx, placeholder]);
  return {
    query: ctx?.pageSearchQuery ?? "",
    setQuery: ctx?.setPageSearchQuery ?? (() => {}),
  };
}
