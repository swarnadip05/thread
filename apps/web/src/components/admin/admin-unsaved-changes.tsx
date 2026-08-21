"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface UnsavedChangesContextValue {
  readonly dirty: boolean;
  confirmNavigation(): boolean;
  setDirty(dirty: boolean): void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function AdminUnsavedChangesProvider({ children }: { readonly children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  const value = useMemo<UnsavedChangesContextValue>(
    () => ({
      dirty,
      setDirty,
      confirmNavigation: () => {
        if (!dirty) return true;
        const confirmed = window.confirm("Discard unsaved changes and leave this section?");
        if (confirmed) setDirty(false);
        return confirmed;
      },
    }),
    [dirty],
  );
  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

export function useAdminUnsavedChanges(): UnsavedChangesContextValue {
  const context = useContext(UnsavedChangesContext);
  if (!context) throw new Error("useAdminUnsavedChanges must be used inside the admin shell.");
  return context;
}
