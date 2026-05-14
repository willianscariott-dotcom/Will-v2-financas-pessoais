// @ts-nocheck
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils-date";
import { createClient } from "@/lib/supabase/client";
import { ContextSwitcher } from "@/components/context-switcher";
import { useFinancialContext } from "@/contexts/financial-context";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TransactionType = "income" | "expense";

interface AccountWithBalance {
  id: string;
  name: string;
  balance: number;
  transactions: number;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function AccountsPage() {
  const { activeContext } = useFinancialContext();
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const now = new Date();

  function goToPreviousMonth() {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  }

  function goToNextMonth() {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  }

  useEffect(() => {
    if (activeContext === "pessoal") {
      loadData();
    }
  }, [activeContext, selectedMonth, selectedYear]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const { data: accData, error: accError } = await supabase
        .from("pessoal_accounts")
        .select("*")
        .order("name");

      if (accError) throw accError;

      const { data: txData, error: txError } = await supabase
        .from("pessoal_transactions")
        .select("account_id, amount, type")
        .gte("date", startDate)
        .lte("date", endDate);

      if (txError) throw txError;

      const balanceMap: { [key: string]: { balance: number; count: number } } = {};
      
      (accData || []).forEach((acc: { id: string }) => {
        balanceMap[acc.id] = { balance: 0, count: 0 };
      });

      (txData || []).forEach((t: { account_id: string; amount: number; type: TransactionType }) => {
        if (!balanceMap[t.account_id]) {
          balanceMap[t.account_id] = { balance: 0, count: 0 };
        }
        balanceMap[t.account_id].count++;
        if (t.type === "income") {
          balanceMap[t.account_id].balance += Number(t.amount);
        } else {
          balanceMap[t.account_id].balance -= Number(t.amount);
        }
      });

      const accountsWithBalance: AccountWithBalance[] = (accData || []).map((acc: { id: string; name: string }) => ({
        id: acc.id,
        name: acc.name,
        balance: balanceMap[acc.id]?.balance || 0,
        transactions: balanceMap[acc.id]?.count || 0,
      }));

      setAccounts(accountsWithBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const currentMonthName = monthNames[selectedMonth];

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <h1 className="text-2xl font-bold">Minhas Contas</h1>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-4"><p className="text-red-500">Erro: {error}</p></div>;
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minhas Contas</h1>
        <div className="flex items-center gap-2 mt-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground min-w-[140px] text-center">
            {currentMonthName} de {selectedYear}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ContextSwitcher />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total das Contas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(totalBalance)}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Detalhamento por Conta ({accounts.length})</h2>
        {accounts.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma conta encontrada.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => (
              <Card key={acc.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-lg">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">{acc.transactions} transações</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${acc.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(acc.balance)}
                      </p>
                    </div>
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