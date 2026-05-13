"use client";

import { ContextProvider } from "@/contexts/financial-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ContextProvider>{children}</ContextProvider>;
}