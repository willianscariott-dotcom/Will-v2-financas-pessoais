// @ts-nocheck
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { ContextSwitcher } from "@/components/context-switcher";
import { useFinancialContext } from "@/contexts/financial-context";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils-date";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { TransactionItem } from "@/components/transaction-item";
import { useRouter } from "next/navigation";

type PeriodFilter = "month_start_today" | "today_month_end" | "full_month";
type TransactionType = "income" | "expense";

interface PessoalTransaction {
  id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  pessoal_subcategories?: { id: string; name: string; pessoal_categories?: { id: string; name: string } };
}

interface NegocioTransaction {
  id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  category: string;
}

interface ChartDataItem {
  name: string;
  value: number;
  percent?: string;
}

const CHART_COLORS = {
  income: "#10b981",
  expense: "#ef4444",
  categories: ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4", "#84cc16", "#ef4444", "#10b981"],
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function formatDateToDisplay(dateStr: string): string {
  const datePart = dateStr.split("T")[0];
  const [ano, mes, dia] = datePart.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function ReportsContent() {
  const router = useRouter();
  const { activeContext } = useFinancialContext();
  const [transactions, setTransactions] = useState<(PessoalTransaction | NegocioTransaction)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("full_month");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [subcategoriaAtiva, setSubcategoriaAtiva] = useState<string | null>(null);

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

  function goBack() {
    if (subcategoriaAtiva) {
      setSubcategoriaAtiva(null);
    } else if (categoriaAtiva) {
      setCategoriaAtiva(null);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeContext, periodFilter, selectedMonth, selectedYear]);

  async function loadData() {
    setLoading(true);
    setError(null);
    setCategoriaAtiva(null);
    setSubcategoriaAtiva(null);
    const supabase = createClient();

    try {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      
      let startDate: string;
      let endDate: string;
      
      const firstDayOfMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
      const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split("T")[0];

      switch (periodFilter) {
        case "month_start_today":
          startDate = firstDayOfMonth;
          endDate = today;
          break;
        case "today_month_end":
          startDate = today;
          endDate = lastDayOfMonth;
          break;
        case "full_month":
        default:
          startDate = firstDayOfMonth;
          endDate = lastDayOfMonth;
          break;
      }

      if (activeContext === "pessoal") {
        const { data, error } = await supabase.from("pessoal_transactions").select(`*, pessoal_subcategories(id, name, pessoal_categories(id, name))`).gte("date", startDate).lte("date", endDate).order("date", { ascending: false });
        if (error) throw error;
        setTransactions(data || []);
      } else {
        const { data, error } = await supabase.from("negocio").select("*").gte("date", startDate).lte("date", endDate).order("date", { ascending: false });
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
      const sub = (t as PessoalTransaction).pessoal_subcategories;
      return sub?.pessoal_categories?.name ? `${sub.pessoal_categories.name} - ${sub.name}` : sub?.name || "Sem categoria";
    }
    return (t as NegocioTransaction).category || "Sem categoria";
  }

  function getSubcategoryName(t: PessoalTransaction | NegocioTransaction): string {
    if (activeContext === "pessoal") return (t as PessoalTransaction).pessoal_subcategories?.name || "Principal";
    return t.description || "Sem descrição";
  }

  function getLevelTitle() {
    if (subcategoriaAtiva) return subcategoriaAtiva;
    if (categoriaAtiva) return `Subcategorias: ${categoriaAtiva}`;
    return "Despesas por Categoria";
  }

  function processChartData() {
    const incomeData: { [key: string]: number } = {};
    const expenseData: { [key: string]: number } = {};
    const categoryDataMap: { [key: string]: number } = {};

    transactions.forEach((t) => {
      const dateStr = t.date.split("T")[0];
      const [year, month] = dateStr.split("-");
      const label = `${month}/${year}`;

      if (t.type === "income") {
        incomeData[label] = (incomeData[label] || 0) + Number(t.amount);
      } else {
        expenseData[label] = (expenseData[label] || 0) + Number(t.amount);
        const catName = getCategoryName(t);
        categoryDataMap[catName] = (categoryDataMap[catName] || 0) + Number(t.amount);
      }
    });

    const allLabels = [...new Set([...Object.keys(incomeData), ...Object.keys(expenseData)])].sort();
    const cashFlowData = allLabels.map((label) => ({ label, receitas: incomeData[label] || 0, despesas: expenseData[label] || 0 }));

    const totalExpense = Object.values(categoryDataMap).reduce((sum, val) => sum + val, 0);
    const categoryData: ChartDataItem[] = Object.entries(categoryDataMap)
      .map(([name, value]) => ({
        name,
        value,
        percent: ((value / totalExpense) * 100).toFixed(1),
      }))
      .sort((a, b) => b.value - a.value);

    return { cashFlowData, categoryData };
  }

  function getSubcategoryChartData(categoryName: string): ChartDataItem[] {
    const categoryTransactions = transactions.filter((t) => t.type === "expense" && getCategoryName(t) === categoryName);
    const subcategoryDataMap: { [key: string]: number } = {};

    categoryTransactions.forEach((t) => {
      const subName = getSubcategoryName(t);
      subcategoryDataMap[subName] = (subcategoryDataMap[subName] || 0) + Number(t.amount);
    });

    const totalCategory = Object.values(subcategoryDataMap).reduce((sum, val) => sum + val, 0);
    return Object.entries(subcategoryDataMap)
      .map(([name, value]) => ({
        name,
        value,
        percent: ((value / totalCategory) * 100).toFixed(1),
      }))
      .sort((a, b) => b.value - a.value);
  }

  function getCategoryTransactions(): (PessoalTransaction | NegocioTransaction)[] {
    return transactions.filter((t) => t.type === "expense" && getCategoryName(t) === categoriaAtiva);
  }

  function getSubcategoryTransactions(): (PessoalTransaction | NegocioTransaction)[] {
    return transactions.filter((t) => {
      if (t.type !== "expense") return false;
      if (getCategoryName(t) !== categoriaAtiva) return false;
      if (getSubcategoryName(t) !== subcategoriaAtiva) return false;
      return true;
    }).sort((a, b) => Number(b.amount) - Number(a.amount));
  }

  function handleDelete(id: string) {
    const table = activeContext === "pessoal" ? "pessoal_transactions" : "negocio";
    
    setTransactions(prev => prev.filter(t => t.id !== id));

    const supabase = createClient();
    supabase.from(table).delete().eq("id", id).then(({ error }) => {
      if (error) {
        loadData();
      }
    });
  }

  function handleEdit(id: string) {
    router.push("/transacoes");
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

  const { cashFlowData, categoryData } = processChartData();
  const subcategoryData = categoriaAtiva ? getSubcategoryChartData(categoriaAtiva) : [];
  const subcategoryTransactions = subcategoriaAtiva ? getSubcategoryTransactions() : [];
  const totalSubcategory = subcategoriaAtiva ? subcategoryTransactions.reduce((sum, t) => sum + Number(t.amount), 0) : 0;
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);

  const currentMonthName = monthNames[selectedMonth];
  const activeChartData = subcategoriaAtiva ? [] : (categoriaAtiva ? subcategoryData : categoryData);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: ChartDataItem }[] }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm">{data.name}</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(data.value)}</p>
          <p className="text-xs text-muted-foreground">{data.percent}%</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="p-4 space-y-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-32"></div><div className="h-10 bg-muted rounded w-full"></div><div className="grid grid-cols-4 gap-4"><div className="h-20 bg-muted rounded"></div><div className="h-20 bg-muted rounded"></div><div className="h-20 bg-muted rounded"></div><div className="h-20 bg-muted rounded"></div></div><div className="h-[300px] bg-muted rounded"></div><div className="h-[300px] bg-muted rounded"></div></div></div>;
  }

  if (error) return <div className="p-4"><p className="text-red-500">Erro: {error}</p></div>;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
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
        <Button variant={periodFilter === "full_month" ? "default" : "outline"} size="sm" onClick={() => setPeriodFilter("full_month")}>
          Mês Inteiro
        </Button>
        <Button variant={periodFilter === "month_start_today" ? "default" : "outline"} size="sm" onClick={() => setPeriodFilter("month_start_today")}>
          Início do Mês até Hoje
        </Button>
        <Button variant={periodFilter === "today_month_end" ? "default" : "outline"} size="sm" onClick={() => setPeriodFilter("today_month_end")}>
          Hoje até Fim do Mês
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={downloadCSV} size="sm">
          <Download className="h-4 w-4 mr-2" />Baixar CSV
        </Button>
      </div>

      <ContextSwitcher />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-green-600">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalIncome)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-red-600">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalExpense)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle></CardHeader><CardContent><p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? "text-green-600" : "text-red-600"}`}>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalIncome - totalExpense)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Transações</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{transactions.length}</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader><CardTitle>Fluxo de Caixa</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value as number)} />
                <Bar dataKey="receitas" fill={CHART_COLORS.income} name="Receitas" />
                <Bar dataKey="despesas" fill={CHART_COLORS.expense} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{getLevelTitle()}</CardTitle>
            {(categoriaAtiva || subcategoriaAtiva) && (
              <Button variant="outline" size="sm" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-2" />Voltar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!subcategoriaAtiva && (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={activeChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    onClick={(_, index) => {
                      if (!categoriaAtiva) {
                        setCategoriaAtiva(activeChartData[index].name);
                      } else {
                        setSubcategoriaAtiva(activeChartData[index].name);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                    label={({ name, percent }) => `${name} (${(Number(percent) * 100).toFixed(0)}%)`}
                  >
                    {activeChartData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS.categories[index % CHART_COLORS.categories.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}

            {subcategoriaAtiva ? (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Transações ({subcategoryTransactions.length})</h3>
                <div className="max-h-[500px] overflow-y-auto">
                  {subcategoryTransactions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhuma transação nesta subcategoria.</p>
                  ) : (
                    subcategoryTransactions.map((t) => (
                      <TransactionItem
                        key={t.id}
                        id={t.id}
                        amount={t.amount}
                        date={t.date}
                        type={t.type}
                        description={t.description}
                        category={getSubcategoryName(t)}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>
            ) : categoriaAtiva ? (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Transações ({getCategoryTransactions().length})</h3>
                <div className="max-h-[400px] overflow-y-auto">
                  {getCategoryTransactions().map((t) => (
                    <TransactionItem
                      key={t.id}
                      id={t.id}
                      amount={t.amount}
                      date={t.date}
                      type={t.type}
                      description={t.description}
                      category={getSubcategoryName(t)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}