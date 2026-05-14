// @ts-nocheck
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ContextSwitcher } from "@/components/context-switcher";
import { useFinancialContext } from "@/contexts/financial-context";
import { formatDateToInput, formatCurrency } from "@/lib/utils-date";
import { createClient } from "@/lib/supabase/client";
import { Account, Subcategory } from "@/types";
import { TransactionItem } from "@/components/transaction-item";
import { useRouter } from "next/navigation";

type FilterType = "todas" | "income" | "expense";
type PeriodFilter = "month_start_today" | "today_month_end" | "full_month";
type TransactionType = "income" | "expense";

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface PessoalTransaction {
  id: string;
  account_id: string;
  subcategory_id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  pessoal_accounts?: { id: string; name: string };
  pessoal_subcategories?: { id: string; name: string; pessoal_categories?: { name: string } };
}

interface NegocioTransaction {
  id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  category: string;
}

export function TransactionsContent() {
  const router = useRouter();
  const { activeContext } = useFinancialContext();
  const [pessoalTransactions, setPessoalTransactions] = useState<PessoalTransaction[]>([]);
  const [negocioTransactions, setNegocioTransactions] = useState<NegocioTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FilterType>("todas");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("full_month");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<(PessoalTransaction | NegocioTransaction) | null>(null);

  const [formData, setFormData] = useState({
    account_id: "",
    subcategory_id: "",
    amount: "",
    date: formatDateToInput(new Date()),
    type: "expense" as TransactionType,
    description: "",
    category: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
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
        const [txData, accData, subData] = await Promise.all([
          supabase.from("pessoal_transactions").select(`*, pessoal_accounts(id, name), pessoal_subcategories(id, name, pessoal_categories(name))`).gte("date", startDate).lte("date", endDate).order("date", { ascending: true }),
          supabase.from("pessoal_accounts").select("*").order("name"),
          supabase.from("pessoal_subcategories").select(`*, pessoal_categories(name)`).order("name"),
        ]);

        if (txData.error) throw txData.error;
        setPessoalTransactions(txData.data || []);
        setAccounts(accData.data || []);
        setSubcategories(subData.data || []);
      } else {
        const { data, error } = await supabase.from("negocio").select("*").gte("date", startDate).lte("date", endDate).order("date", { ascending: true });
        if (error) throw error;
        setNegocioTransactions(data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [activeContext, periodFilter, selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeContext === "pessoal") {
      const supabase = createClient();
      supabase.from("pessoal_accounts").select("*").order("name").then(({ data }) => setAccounts(data || []));
      supabase.from("pessoal_subcategories").select(`*, pessoal_categories(name)`).order("name").then(({ data }) => setSubcategories(data || []));
    }
  }, [activeContext]);

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

  function openEditModal(t: PessoalTransaction | NegocioTransaction) {
    setEditingTransaction(t);
    setFormData({
      account_id: activeContext === "pessoal" ? (t as PessoalTransaction).account_id : "",
      subcategory_id: activeContext === "pessoal" ? (t as PessoalTransaction).subcategory_id : "",
      amount: String(t.amount).replace(".", ","),
      date: t.date.split("T")[0],
      type: t.type,
      description: t.description,
      category: activeContext === "negocio" ? (t as NegocioTransaction).category : "",
    });
    setIsEditModalOpen(true);
  }

  function handleDelete(id: string) {
    const table = activeContext === "pessoal" ? "pessoal_transactions" : "negocio";
    
    if (activeContext === "pessoal") {
      setPessoalTransactions(prev => prev.filter(t => t.id !== id));
    } else {
      setNegocioTransactions(prev => prev.filter(t => t.id !== id));
    }

    const supabase = createClient();
    supabase.from(table).delete().eq("id", id).then(({ error }) => {
      if (error) {
        loadData();
      }
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTransaction) return;
    setSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();

    try {
      const amountValue = parseFloat(formData.amount.replace(",", "."));
      if (isNaN(amountValue)) throw new Error("Valor inválido");

      if (activeContext === "pessoal") {
        const { error } = await supabase.from("pessoal_transactions").update({
          account_id: formData.account_id,
          subcategory_id: formData.subcategory_id,
          amount: amountValue,
          date: formData.date,
          type: formData.type,
          description: formData.description,
        }).eq("id", editingTransaction.id);
        if (error) throw error;

        setPessoalTransactions(prev => prev.map(t => t.id === editingTransaction.id ? { ...t, account_id: formData.account_id, subcategory_id: formData.subcategory_id, amount: amountValue, date: formData.date, type: formData.type, description: formData.description } : t));
      } else {
        const { error } = await supabase.from("negocio").update({
          amount: amountValue,
          date: formData.date,
          type: formData.type,
          description: formData.description,
          category: formData.category,
        }).eq("id", editingTransaction.id);
        if (error) throw error;

        setNegocioTransactions(prev => prev.map(t => t.id === editingTransaction.id ? { ...t, amount: amountValue, date: formData.date, type: formData.type, description: formData.description, category: formData.category } : t));
      }

      setIsEditModalOpen(false);
      setEditingTransaction(null);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao editar");
    } finally {
      setSubmitting(false);
    }
  }

  const transactions = activeContext === "pessoal" ? pessoalTransactions : negocioTransactions;
  const transacoesFiltradas = transactions.filter((t) => filtro === "todas" ? true : t.type === filtro);

  function getCategory(t: PessoalTransaction | NegocioTransaction): string {
    if (activeContext === "pessoal") {
      const sub = (t as PessoalTransaction).pessoal_subcategories;
      return sub?.pessoal_categories?.name ? `${sub.pessoal_categories.name} - ${sub.name}` : sub?.name || "Sem categoria";
    }
    return (t as NegocioTransaction).category;
  }

  if (loading) {
    return <div className="p-4 pb-24 space-y-4"><div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-32"></div><div className="h-10 bg-muted rounded w-full"></div><div className="space-y-2"><div className="h-14 bg-muted rounded"></div><div className="h-14 bg-muted rounded"></div><div className="h-14 bg-muted rounded"></div></div></div></div>;
  }

  if (error) return <div className="p-4"><p className="text-red-500">Erro: {error}</p></div>;

  const currentMonthName = monthNames[selectedMonth];

  return (
    <div className="p-4 pb-24 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Transações</h1>
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

      <ContextSwitcher />

      <div className="flex gap-2">
        <Button variant={filtro === "todas" ? "default" : "outline"} size="sm" onClick={() => setFiltro("todas")}>Todas</Button>
        <Button variant={filtro === "income" ? "default" : "outline"} size="sm" onClick={() => setFiltro("income")}>Receitas</Button>
        <Button variant={filtro === "expense" ? "default" : "outline"} size="sm" onClick={() => setFiltro("expense")}>Despesas</Button>
      </div>

      <div className="space-y-2">
        {transacoesFiltradas.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma transação encontrada.</p>
        ) : (
          transacoesFiltradas.map((t) => (
            <TransactionItem
              key={t.id}
              id={t.id}
              amount={t.amount}
              date={t.date}
              type={t.type}
              description={t.description}
              category={getCategory(t)}
              onEdit={() => openEditModal(t)}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Transação</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as TransactionType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeContext === "pessoal" ? (
              <>
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Select value={formData.account_id || ""} onValueChange={(value) => setFormData({ ...formData, account_id: value || "" })} required>
                    <SelectTrigger><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                    <SelectContent>{accounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={formData.subcategory_id || ""} onValueChange={(value) => setFormData({ ...formData, subcategory_id: value || "" })} required>
                    <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                    <SelectContent>{subcategories.map((sub) => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required />
              </div>
            )}

            <div className="space-y-2"><Label>Valor</Label><Input type="text" placeholder="0,00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Data</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Input type="text" placeholder="Descrição opcional" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>

            {submitError && <p className="text-red-500 text-sm">{submitError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}