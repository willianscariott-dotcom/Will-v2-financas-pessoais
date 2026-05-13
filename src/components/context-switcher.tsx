"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFinancialContext } from "@/contexts/financial-context";

export function ContextSwitcher() {
  const { activeContext, setActiveContext } = useFinancialContext();

  return (
    <Tabs
      value={activeContext}
      onValueChange={(value) => setActiveContext(value as "pessoal" | "negocio")}
    >
      <TabsList className="w-full">
        <TabsTrigger value="pessoal" className="flex-1">Pessoal</TabsTrigger>
        <TabsTrigger value="negocio" className="flex-1">Negócio</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}