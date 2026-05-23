import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Facilitator = { id: string; facilitator_id: string; name: string };

type Ctx = {
  facilitator: Facilitator | null;
  setFacilitator: (f: Facilitator | null) => void;
  hydrated: boolean;
};

const FacilitatorCtx = createContext<Ctx>({ facilitator: null, setFacilitator: () => {}, hydrated: false });
const KEY = "braingym.activeFacilitator";

export function FacilitatorProvider({ children }: { children: ReactNode }) {
  const [facilitator, setFacilitatorState] = useState<Facilitator | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setFacilitatorState(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  const setFacilitator = (f: Facilitator | null) => {
    setFacilitatorState(f);
    if (typeof window !== "undefined") {
      if (f) localStorage.setItem(KEY, JSON.stringify(f));
      else localStorage.removeItem(KEY);
    }
  };

  return (
    <FacilitatorCtx.Provider value={{ facilitator, setFacilitator, hydrated }}>
      {children}
    </FacilitatorCtx.Provider>
  );
}

export const useFacilitator = () => useContext(FacilitatorCtx);