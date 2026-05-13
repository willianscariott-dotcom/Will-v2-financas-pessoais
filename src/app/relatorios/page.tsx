// @ts-nocheck
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Calendar } from "lucide-react";
import { ContextSwitcher } from "@/components/context-switcher";
import { useFinancialContext } from "@/contexts/financial-context";
import { createClient } from "@/lib/supabase/client";
import { formatDateToInput } from "@/lib/utils-date";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type PeriodFilter = "current_month" | "previous_month" | "last_3_months" | "last_6_months" | "last_12_months" | "custom";
type TransactionType = "income" | "expense";

interface PessoalTransaction {
  id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
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

const CHART_COLORS = {
  income: "#10b981",
  expense: "#ef4444",
  categories: ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4", "#84cc16"],
};

function formatDateToDisplay(dateStr: string): string {
  const datePart = dateStr.split("T")[0];
  const [ano, mes, dia] = datePart.split("-");
  return `${dia}/${mes}/${ano}`;
}

function calculateDateRange(filter: PeriodFilter, customStart?: string, customEnd?: string) {
  const today = new Date();
  let startDate: Date;
  let endDate: Date = new Date(today.getFullYear(), today.getMonth(), today.getDate());

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
    case "custom":
      startDate = customStart ? new Date(customStart) : new Date(today.getFullYear(), 0, 1);
      endDate = customEnd ? new Date(customEnd) : today;
      break;
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return {
    startDate: formatDateToInput(startDate),
    endDate: formatDateToInput(endDate),
  };
}

export default function ReportsPage() {
  const { activeContext } = useFinancialContext();
  const [transactions, setTransactions] = useState<(PessoalTransaction | NegocioTransaction)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("current_month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  useEffect(() => {
    loadData();
  }, [activeContext, periodFilter, customStartDate, customEndDate]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { startDate, endDate } = calculateDateRange(periodFilter, customStartDate, customEndDate);

      if (activeContext === "pessoal") {
        const { data, error } = await supabase
          .from("pessoal_transactions")
          .select(`
            *,
            pessoal_subcategories(name, pessoal_categories(name))
          `)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false });

        if (error) throw error;
        setTransactions(data || []);
      } else {
        const { data, error } = await supabase
          .from("negocio")
          .select("*")
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false });

        if (error) throw error;
        setTransactions(data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  function getCategoryName(t: PessoalTransaction | NegocioTransaction): string {
    if (activeContext === "pessoal") {
      const pessoal = t as PessoalTransaction;
      const sub = pessoal.pessoal_subcategories;
      return sub?.pessoal_categories?.name
        ? `${sub.pessoal_categories.name} - ${sub.name}`
        : sub?.name || "Sem categoria";
    }
    return (t as NegocioTransaction).category || "Sem categoria";
  }

  function processChartData() {
    const incomeData: { [key: string]: number } = {};
    const expenseData: { [key: string]: number } = {};
    const categoryData: { [key: string]: number } = {};

    transactions.forEach((t) => {
      const dateStr = t.date.split("T")[0];
      const [year, month] = dateStr.split("-");
      const label = `${month}/${year}`;

      if (t.type === "income") {
        incomeData[label] = (incomeData[label] || 0) + Number(t.amount);
      } else {
        expenseData[label] = (expenseData[label] || 0) + Number(t.amount);
        const catName = getCategoryName(t);
        categoryData[catName] = (categoryData[catName] || 0) + Number(t.amount);
      }
    });

    const allLabels = [...new Set([...Object.keys(incomeData), ...Object.keys(expenseData)])].sort();

    const cashFlowData = allLabels.map((label) => ({
      label,
      receitas: incomeData[label] || 0,
      despesas: expenseData[label] || 0,
    }));

    const categoryArray = Object.entries(categoryData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { cashFlowData, categoryArray };
  }

  function downloadCSV() {
    const headers = "Data,Descricao,Valor,Tipo,Categoria\n";
    const rows = transactions.map((t) => {
      const date = formatDateToDisplay(t.date);
      const desc = (t.description || "").replace(/"/g, '""');
      const amount = Number(t.amount).toFixed(2).replace(".", ",");
      const type = t.type === "income" ? "Receita" : "Despesa";
      const category = getCategoryName(t).replace(/"/g, '""');
      return `"${date}","${desc}","${amount}","${type}","${category}"`;
    }).join("\n");

    const csv = "\ufeff" + headers + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_${activeContext}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const { cashFlowData, categoryArray } = processChartData();

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

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

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <Button onClick={downloadCSV} size="sm">
          <Download className="h-4 w-4 mr-2" />
          Baixar CSV
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-48">
          <Select
            value={periodFilter}
            onValueChange={(value) => setPeriodFilter(value as PeriodFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Mês atual</SelectItem>
              <SelectItem value="previous_month">Mês anterior</SelectItem>
              <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
              <SelectItem value="last_6_months">Últimos 6 meses</SelectItem>
              <SelectItem value="last_12_months">Últimos 12 meses</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {periodFilter === "custom" && (
          <div className="flex gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Data Inicial</Label>
              <Input
                type="date"
                className="w-[160px]"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Data Final</Label>
              <Input
                type="date"
                className="w-[160px]"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <ContextSwitcher />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? "text-green-600" : "text-red-600"}`}>
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalIncome - totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{transactions.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Fluxo de Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)} />
                <Bar dataKey="receitas" fill={CHART_COLORS.income} name="Receitas" />
                <Bar dataKey="despesas" fill={CHART_COLORS.expense} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {categoryArray.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryArray}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categoryArray.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS.categories[index % CHART_COLORS.categories.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 w-full">
                  {categoryArray.slice(0, 6).map((cat, index) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS.categories[index % CHART_COLORS.categories.length] }}
                      />
                      <span className="text-sm flex-1">{cat.name}</span>
                      <span className="text-sm font-medium">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cat.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}