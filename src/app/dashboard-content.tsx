// @ts-nocheck
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextSwitcher } from "@/components/context-switcher";
import { useFinancialContext } from "@/contexts/financial-context";
import { formatCurrency } from "@/lib/utils-date";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TransactionType = "income" | "expense";

interface PessoalTransaction {
  id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  account_id: string;
  pessoal_accounts?: { name: string };
  pessoal_subcategories?: {
    name: string;
    pessoal_categories?: { name: string };
  };
}

interface NegocioTransaction {
  id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  category: string;
}

interface AccountBalance {
  id: string;
  name: string;
  balance: number;
}

type PeriodFilter = "month_start_today" | "today_month_end" | "full_month";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function getMonthDateRange(month: number, year: number) {
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

function getDateRange(filter: PeriodFilter, selectedMonth: number, selectedYear: number) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentMonthRange = getMonthDateRange(selectedMonth, selectedYear);

  switch (filter) {
    case "month_start_today":
      return { startDate: currentMonthRange.startDate, endDate: today };
    case "today_month_end":
      return { startDate: today, endDate: currentMonthRange.endDate };
    case "full_month":
    default:
      return { startDate: currentMonthRange.startDate, endDate: currentMonthRange.endDate };
  }
}

export function DashboardContent() {
  const { activeContext } = useFinancialContext();
  const [pessoalTransactions, setPessoalTransactions] = useState<PessoalTransaction[]>([]);
  const [negocioTransactions, setNegocioTransactions] = useState<NegocioTransaction[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("full_month");

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

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
    loadData();
  }, [activeContext, periodFilter, selectedMonth, selectedYear]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { startDate, endDate } = getDateRange(periodFilter, selectedMonth, selectedYear);

      if (activeContext === "pessoal") {
        const { data, error } = await supabase
          .from("pessoal_transactions")
          .select(`
            *,
            pessoal_accounts(id, name),
            pessoal_subcategories(name, pessoal_categories(name))
          `)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false });

        if (error) throw error;
        setPessoalTransactions(data || []);

        const { data: accData } = await supabase.from("pessoal_accounts").select("*").order("name");
        setAccounts(accData || []);

        const balanceMap: { [key: string]: number } = {};
        (data || []).forEach((t: PessoalTransaction) => {
          if (!balanceMap[t.account_id]) balanceMap[t.account_id] = 0;
          if (t.type === "income") {
            balanceMap[t.account_id] += Number(t.amount);
          } else {
            balanceMap[t.account_id] -= Number(t.amount);
          }
        });

        const balances: AccountBalance[] = (accData || []).map((acc: { id: string; name: string }) => ({
          id: acc.id,
          name: acc.name,
          balance: balanceMap[acc.id] || 0,
        }));
        setAccountBalances(balances);
      } else {
        const { data, error } = await supabase
          .from("negocio")
          .select("*")
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false });

        if (error) throw error;
        setNegocioTransactions(data || []);
        setAccountBalances([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  const transactions = activeContext === "pessoal"
    ? pessoalTransactions
    : negocioTransactions;

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = totalIncome - totalExpense;
  const currentMonthName = monthNames[selectedMonth];

  if (loading) {
    return <div className="p-4 space-y-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-40"></div><div className="h-4 bg-muted rounded w-32"></div><div className="grid grid-cols-3 gap-4"><div className="h-20 bg-muted rounded"></div><div className="h-20 bg-muted rounded"></div><div className="h-20 bg-muted rounded"></div></div></div></div>;
  }

  if (error) {
    return <div className="p-4"><p className="text-red-500">Erro: {error}</p></div>;
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
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

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={periodFilter === "full_month" ? "default" : "outline"}
          size="sm"
          onClick={() => setPeriodFilter("full_month")}
        >
          Mês Inteiro
        </Button>
        <Button
          variant={periodFilter === "month_start_today" ? "default" : "outline"}
          size="sm"
          onClick={() => setPeriodFilter("month_start_today")}
        >
          Início do Mês até Hoje
        </Button>
        <Button
          variant={periodFilter === "today_month_end" ? "default" : "outline"}
          size="sm"
          onClick={() => setPeriodFilter("today_month_end")}
        >
          Hoje até Fim do Mês
        </Button>
      </div>

      <ContextSwitcher />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(balance)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalIncome)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpense)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Todas as Transações ({transactions.length})</h2>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma transação neste período.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {transactions.map((t) => {
              const dateStr = t.date.split("T")[0];
              const [ano, mes, dia] = dateStr.split("-");
              const dataExibicao = `${dia}/${mes}/${ano}`;

              let catText = "";
              if (activeContext === "pessoal") {
                const pessoal = t as PessoalTransaction;
                const sub = pessoal.pessoal_subcategories;
                catText = sub?.pessoal_categories?.name
                  ? `${sub.pessoal_categories.name} - ${sub.name}`
                  : "Sem categoria";
              } else {
                const negocio = t as NegocioTransaction;
                catText = negocio.category;
              }

              return (
                <Card key={t.id}>
                  <CardContent className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{t.description || "Sem descrição"}</p>
                      <p className="text-xs text-muted-foreground">{dataExibicao} • {catText}</p>
                    </div>
                    <div className={`font-semibold text-sm ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                      {t.type === "income" ? "+" : "-"}
                      {formatCurrency(Number(t.amount))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}