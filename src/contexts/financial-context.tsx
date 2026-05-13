"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type FinancialContext = "pessoal" | "negocio";

interface ContextProviderProps {
  children: ReactNode;
}

const ContextContext = createContext<{
  activeContext: FinancialContext;
  setActiveContext: (context: FinancialContext) => void;
} | null>(null);

export function ContextProvider({ children }: ContextProviderProps) {
  const [activeContext, setActiveContext] = useState<FinancialContext>("pessoal");

  return (
    <ContextContext.Provider value={{ activeContext, setActiveContext }}>
      {children}
    </ContextContext.Provider>
  );
}

export function useFinancialContext() {
  const context = useContext(ContextContext);
  if (!context) {
    throw new Error("useFinancialContext must be used within ContextProvider");
  }
  return context;
}