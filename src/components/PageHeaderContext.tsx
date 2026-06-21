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
  const setHeader = useCallback((next: PageHeaderState) => setState(next), []);
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
export function useRegisterPageHeader(title: string, actions?: ReactNode) {
  const ctx = useContext(PageHeaderContext);
  useEffect(() => {
    ctx?.setHeader({ title, actions });
  }, [ctx, title, actions]);
}
