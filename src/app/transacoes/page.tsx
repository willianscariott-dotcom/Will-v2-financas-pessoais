"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { ContextSwitcher } from "@/components/context-switcher";
import { useFinancialContext, FinancialContext } from "@/contexts/financial-context";
import { formatDateToDisplay, formatDateToInput, formatCurrency } from "@/lib/utils-date";
import { createClient } from "@/lib/supabase/client";
import { Transaction, Account, Subcategory } from "@/types";

type FilterType = "all" | "income" | "expense";
type TransactionType = "income" | "expense";

interface NegocioTransaction {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
  category: string;
}

export default function TransactionsPage() {
  const { activeContext } = useFinancialContext();
  const [pessoalTransactions, setPessoalTransactions] = useState<Transaction[]>([]);
  const [negocioTransactions, setNegocioTransactions] = useState<NegocioTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    account_id: "",
    subcategory_id: "",
    amount: "",
    date: formatDateToInput(new Date()),
    type: "expense" as TransactionType,
    description: "",
    category: "",
  });

  useEffect(() => {
    loadData();
  }, [activeContext]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      if (activeContext === "pessoal") {
        const [txResult, accResult, subResult] = await Promise.all([
          supabase.from("pessoal_transactions").select(`
            *,
            account:pessoal_accounts(name),
            subcategory:pessoal_subcategories(name)
          `).order("date", { ascending: false }),
          supabase.from("pessoal_accounts").select("*").order("name"),
          supabase.from("pessoal_subcategories").select(`*, category:pessoal_categories(name)`).order("name")
        ]);

        if (txResult.error) throw txResult.error;
        if (accResult.error) throw accResult.error;
        if (subResult.error) throw subResult.error;

        setPessoalTransactions(txResult.data || []);
        setAccounts(accResult.data || []);
        setSubcategories(subResult.data || []);
      } else {
        const { data, error } = await supabase
          .from("negocio")
          .select("*")
          .order("date", { ascending: false });

        if (error) throw error;
        setNegocioTransactions(data || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();

    try {
      const amountValue = parseFloat(formData.amount.replace(",", "."));
      if (isNaN(amountValue)) {
        setSubmitError("Valor inválido");
        setSubmitting(false);
        return;
      }

      if (activeContext === "pessoal") {
        const { error } = await supabase
          .from("pessoal_transactions")
          .insert({
            account_id: formData.account_id,
            subcategory_id: formData.subcategory_id,
            amount: amountValue,
            date: formData.date,
            type: formData.type,
            description: formData.description,
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("negocio")
          .insert({
            amount: amountValue,
            date: formData.date,
            type: formData.type,
            description: formData.description,
            category: formData.category,
          });

        if (error) throw error;
      }

      setIsModalOpen(false);
      setFormData({
        account_id: "",
        subcategory_id: "",
        amount: "",
        date: formatDateToInput(new Date()),
        type: "expense",
        description: "",
        category: "",
      });
      loadData();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao criar transação");
    } finally {
      setSubmitting(false);
    }
  }

  const transactions = activeContext === "pessoal"
    ? pessoalTransactions
    : negocioTransactions;

  const filteredTransactions = transactions.filter((t) => {
    if (filter === "all") return true;
    return t.type === filter;
  });

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
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-2xl font-bold">Transações</h1>

      <ContextSwitcher />

      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          Todas
        </Button>
        <Button
          variant={filter === "income" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("income")}
        >
          Receitas
        </Button>
        <Button
          variant={filter === "expense" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("expense")}
        >
          Despesas
        </Button>
      </div>

      <div className="space-y-2">
        {filteredTransactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma transação encontrada.</p>
        ) : (
          filteredTransactions.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-lg">
                      {t.description || "Sem descrição"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateToDisplay(t.date)} • {"subcategory" in t ? (t.subcategory as { name: string })?.name || "Sem categoria" : (t as NegocioTransaction).category}
                    </p>
                  </div>
                  <div className={`text-lg font-bold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {t.type === "income" ? "+" : "-"}
                    {formatCurrency(Number(t.amount))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Button
        className="fixed bottom-20 md:bottom-4 right-4 h-14 w-14 rounded-full shadow-lg"
        size="icon"
        onClick={() => setIsModalOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Transação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as TransactionType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeContext === "pessoal" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="account">Conta</Label>
                  <Select
                    value={formData.account_id || ""}
                    onValueChange={(value) => setFormData({ ...formData, account_id: value || "" })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subcategory">Categoria</Label>
                  <Select
                    value={formData.subcategory_id || ""}
                    onValueChange={(value) => setFormData({ ...formData, subcategory_id: value || "" })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  type="text"
                  placeholder="Ex: Vendas, Serviços"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Valor</Label>
              <Input
                id="amount"
                type="text"
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                type="text"
                placeholder="Descrição opcional"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {submitError && (
              <p className="text-red-500 text-sm">{submitError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}