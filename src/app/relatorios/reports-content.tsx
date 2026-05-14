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
  const { activeContext } = useFinancialContext();
  const [transactions, setTransactions] = useState<(PessoalTransaction | NegocioTransaction)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("full_month");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

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
    setSelectedCategory(null);
    setSelectedSubcategory(null);
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
    return "Principal";
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
    const cashFlowData = allLabels.map((label) => ({ label, receitas: incomeData[label] || 0, despesas: expenseData[label] || 0 }));
    const categoryArray = Object.entries(categoryData).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return { cashFlowData, categoryArray };
  }

  function getSubcategoryBreakdown(categoryName: string) {
    const categoryTransactions = transactions.filter((t) => t.type === "expense" && getCategoryName(t) === categoryName);
    const subcategoryData: { [key: string]: number } = {};
    categoryTransactions.forEach((t) => {
      const subName = getSubcategoryName(t);
      subcategoryData[subName] = (subcategoryData[subName] || 0) + Number(t.amount);
    });
    return Object.entries(subcategoryData).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }

  function getTransactionBreakdown(categoryName: string, subcategoryName: string) {
    return transactions.filter((t) => {
      if (t.type !== "expense") return false;
      if (getCategoryName(t) !== categoryName) return false;
      if (getSubcategoryName(t) !== subcategoryName) return false;
      return true;
    });
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
  const subcategoryBreakdown = selectedCategory ? getSubcategoryBreakdown(selectedCategory) : [];
  const transactionList = selectedCategory && selectedSubcategory ? getTransactionBreakdown(selectedCategory, selectedSubcategory) : [];
  const subcategoryTotal = selectedSubcategory ? subcategoryBreakdown.find(s => s.name === selectedSubcategory)?.value || 0 : 0;

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);

  const currentMonthName = monthNames[selectedMonth];

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
          <CardHeader>
            <CardTitle>
              {selectedSubcategory 
                ? `Transações: ${selectedSubcategory}` 
                : selectedCategory 
                  ? `Subcategorias de: ${selectedCategory}` 
                  : "Despesas por Categoria"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSubcategory ? (
              <>
                <Button variant="outline" size="sm" className="mb-4" onClick={() => setSelectedSubcategory(null)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />Voltar às Subcategorias
                </Button>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {transactionList.map((t) => {
                    const dateStr = t.date.split("T")[0];
                    const [ano, mes, dia] = dateStr.split("-");
                    const dataExibicao = `${dia}/${mes}/${ano}`;
                    const percent = ((Number(t.amount) / subcategoryTotal) * 100).toFixed(1);
                    return (
                      <div key={t.id} className="flex justify-between items-center p-2 border-b last:border-0">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{t.description || "Sem descrição"}</p>
                          <p className="text-xs text-muted-foreground">{dataExibicao}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-red-600">{formatCurrency(Number(t.amount))}</p>
                          <p className="text-xs text-muted-foreground">{percent}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : selectedCategory ? (
              <>
                <Button variant="outline" size="sm" className="mb-4" onClick={() => setSelectedCategory(null)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />Voltar às Categorias
                </Button>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={subcategoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {subcategoryBreakdown.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS.categories[index % CHART_COLORS.categories.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 w-full max-h-[300px] overflow-y-auto">
                    {subcategoryBreakdown.map((sub, index) => {
                      const catValue = categoryArray.find(c => c.name === selectedCategory)?.value || 1;
                      const percent = (sub.value / catValue) * 100;
                      return (
                        <div key={sub.name} className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded" onClick={() => setSelectedSubcategory(sub.name)}>
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS.categories[index % CHART_COLORS.categories.length] }} />
                          <span className="text-sm flex-1 truncate">{sub.name}</span>
                          <span className="text-xs text-muted-foreground">{percent.toFixed(1)}%</span>
                          <span className="text-sm font-medium">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(sub.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Clique em uma subcategoria para ver as transações</p>
              </>
            ) : (
              <>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={categoryArray} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {categoryArray.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS.categories[index % CHART_COLORS.categories.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 w-full max-h-[300px] overflow-y-auto">
                    {categoryArray.map((cat, index) => {
                      const percent = (cat.value / totalExpense) * 100;
                      return (
                        <div key={cat.name} className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded" onClick={() => setSelectedCategory(cat.name)}>
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS.categories[index % CHART_COLORS.categories.length] }} />
                          <span className="text-sm flex-1 truncate">{cat.name}</span>
                          <span className="text-xs text-muted-foreground">{percent.toFixed(1)}%</span>
                          <span className="text-sm font-medium">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cat.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {activeContext === "pessoal" && <p className="text-xs text-muted-foreground mt-2">Clique em uma categoria para ver as subcategorias</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}