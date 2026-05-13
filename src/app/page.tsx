"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextSwitcher } from "@/components/context-switcher";
import { useFinancialContext } from "@/contexts/financial-context";
import { formatCurrency } from "@/lib/utils-date";
import { createClient } from "@/lib/supabase/client";
import { NegocioTransaction } from "@/lib/api";
import { Transaction } from "@/types";

interface PessoalData {
  transactions: Transaction[];
}

interface NegocioData {
  transactions: NegocioTransaction[];
}

export default function Dashboard() {
  const { activeContext } = useFinancialContext();
  const [pessoalData, setPessoalData] = useState<PessoalData | null>(null);
  const [negocioData, setNegocioData] = useState<NegocioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activeContext]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

      if (activeContext === "pessoal") {
        const { data, error } = await supabase
          .from("pessoal_transactions")
          .select(`
            *,
            account:pessoal_accounts(name),
            subcategory:pessoal_subcategories(name)
          `)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false });

        if (error) throw error;
        setPessoalData({ transactions: data || [] });
      } else {
        const { data, error } = await supabase
          .from("negocio")
          .select("*")
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false });

        if (error) throw error;
        setNegocioData({ transactions: data || [] });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  const now = new Date();
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const currentMonth = monthNames[now.getMonth()];

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-500">Erro: {error}</p>
      </div>
    );
  }

  const transactions = activeContext === "pessoal"
    ? pessoalData?.transactions || []
    : negocioData?.transactions || [];

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = totalIncome - totalExpense;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">{currentMonth} de {now.getFullYear()}</p>
      </div>

      <ContextSwitcher />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(balance)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalIncome)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpense)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Últimas Transações</h2>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma transação este mês.</p>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 5).map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{t.description || "Sem descrição"}</p>
                    <p className="text-sm text-muted-foreground">
                      {"subcategory" in t ? (t.subcategory as { name: string })?.name || "Sem categoria" : (t as NegocioTransaction).category}
                    </p>
                  </div>
                  <div className={`font-bold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {t.type === "income" ? "+" : "-"}
                    {formatCurrency(Number(t.amount))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}