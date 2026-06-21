import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface PageHeaderState {
  title: string;
  actions?: ReactNode;
}

interface PageHeaderContextValue extends PageHeaderState {
  setHeader: (state: PageHeaderState) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PageHeaderState>({ title: "" });

  // setHeader only updates when the title changes. The actions are fresh JSX
  // on every page render (new element reference), so including them in an
  // equality check would re-trigger setState forever. We intentionally key
  // the update on title only — actions are carried along when the title
  // changes, and a page's actions are otherwise stable across its lifetime.
  const setHeader = useCallback((next: PageHeaderState) => {
    setState((prev) => (prev.title === next.title ? prev : next));
  }, []);

  return (
    <PageHeaderContext.Provider value={{ ...state, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeaderState() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error("usePageHeaderState must be used within a PageHeaderProvider");
  return ctx;
}

// Pages call this hook to push their title + actions into the TopBar.
// The effect depends on [title] only — a stable string — so it runs on
// mount and on title change, NOT on every render. This breaks the loop
// that fresh-JSX actions would otherwise cause.
export function useRegisterPageHeader(title: string, actions?: ReactNode) {
  const ctx = useContext(PageHeaderContext);
  useEffect(() => {
    ctx?.setHeader({ title, actions });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, title]);
}
