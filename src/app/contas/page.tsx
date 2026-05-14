// @ts-nocheck
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils-date";
import { createClient } from "@/lib/supabase/client";
import { ContextSwitcher } from "@/components/context-switcher";
import { useFinancialContext } from "@/contexts/financial-context";

type PeriodFilter = "current_month" | "previous_month" | "last_3_months" | "last_6_months" | "last_12_months";
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

function calculateDateRange(filter: PeriodFilter) {
  const today = new Date();
  let startDate: Date;
  let endDate: Date = today;

  switch (filter) {
    case "current_month":
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "previous_month":
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case "last_3_months":
      startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      break;
    case "last_6_months":
      startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      break;
    case "last_12_months":
      startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      break;
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    startDate: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
    endDate: `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`,
  };
}

export default function AccountsPage() {
  const { activeContext } = useFinancialContext();
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("current_month");

  const now = new Date();
  const currentMonthName = monthNames[now.getMonth()];

  useEffect(() => {
    if (activeContext === "pessoal") {
      loadData();
    }
  }, [activeContext, periodFilter]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { startDate, endDate } = calculateDateRange(periodFilter);

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
        <p className="text-muted-foreground">{currentMonthName} de {now.getFullYear()}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Select
          value={periodFilter}
          onValueChange={(value) => setPeriodFilter(value as PeriodFilter)}
        >
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current_month">Mês atual</SelectItem>
            <SelectItem value="previous_month">Mês anterior</SelectItem>
            <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
            <SelectItem value="last_6_months">Últimos 6 meses</SelectItem>
            <SelectItem value="last_12_months">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
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