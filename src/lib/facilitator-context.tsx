import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Facilitator = { id: string; facilitator_id: string; name: string };

type Ctx = {
  facilitator: Facilitator | null;
  setFacilitator: (f: Facilitator | null) => void;
};

const FacilitatorCtx = createContext<Ctx>({ facilitator: null, setFacilitator: () => {} });
const KEY = "braingym.activeFacilitator";

export function FacilitatorProvider({ children }: { children: ReactNode }) {
  const [facilitator, setFacilitatorState] = useState<Facilitator | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setFacilitatorState(JSON.parse(raw));
    } catch {}
  }, []);

  const setFacilitator = (f: Facilitator | null) => {
    setFacilitatorState(f);
    if (typeof window !== "undefined") {
      if (f) localStorage.setItem(KEY, JSON.stringify(f));
      else localStorage.removeItem(KEY);
    }
  };

  return (
    <FacilitatorCtx.Provider value={{ facilitator, setFacilitator }}>
      {children}
    </FacilitatorCtx.Provider>
  );
}

export const useFacilitator = () => useContext(FacilitatorCtx);