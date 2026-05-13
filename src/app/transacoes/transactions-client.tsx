// @ts-nocheck
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Repeat } from "lucide-react";
import { ContextSwitcher } from "@/components/context-switcher";
import { useFinancialContext } from "@/contexts/financial-context";
import { formatDateToInput, formatCurrency } from "@/lib/utils-date";
import { createClient } from "@/lib/supabase/client";
import { Account, Subcategory } from "@/types";

type FilterType = "todas" | "income" | "expense";
type TransactionType = "income" | "expense";
type RepeatType = "none" | "daily" | "weekly" | "monthly" | "yearly";

interface PessoalTransaction {
  id: string;
  user_id: string;
  account_id: string;
  subcategory_id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  installment_current?: number | null;
  installment_total?: number | null;
  pessoal_accounts?: { name: string };
  pessoal_subcategories?: {
    name: string;
    pessoal_categories?: { name: string };
  };
}

interface NegocioTransaction {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  category: string;
}

export function TransactionsClient() {
  const { activeContext } = useFinancialContext();
  const [pessoalTransactions, setPessoalTransactions] = useState<PessoalTransaction[]>([]);
  const [negocioTransactions, setNegocioTransactions] = useState<NegocioTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FilterType>("todas");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<PessoalTransaction | NegocioTransaction | null>(null);

  const [formData, setFormData] = useState({
    account_id: "",
    subcategory_id: "",
    amount: "",
    date: formatDateToInput(new Date()),
    type: "expense" as TransactionType,
    description: "",
    category: "",
    repeat: "none" as RepeatType,
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
        const { data: txData, error: txError } = await supabase
          .from("pessoal_transactions")
          .select(`
            *,
            pessoal_accounts(name),
            pessoal_subcategories(name, pessoal_categories(name))
          `)
          .order("date", { ascending: true });

        const { data: accData, error: accError } = await supabase
          .from("pessoal_accounts")
          .select("*")
          .order("name");

        const { data: subData, error: subError } = await supabase
          .from("pessoal_subcategories")
          .select(`*, pessoal_categories(name)`)
          .order("name");

        if (txError) throw txError;
        if (accError) throw accError;
        if (subError) throw subError;

        setPessoalTransactions(txData || []);
        setAccounts(accData || []);
        setSubcategories(subData || []);
      } else {
        const { data, error: txError } = await supabase
          .from("negocio")
          .select("*")
          .order("date", { ascending: true });

        if (txError) throw txError;
        setNegocioTransactions(data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  function getNextDate(currentDate: string, repeatType: RepeatType): string {
    const [year, month, day] = currentDate.split("-").map(Number);
    let nextDate = new Date(year, month - 1, day);

    switch (repeatType) {
      case "daily":
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case "weekly":
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case "monthly":
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case "yearly":
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    return formatDateToInput(nextDate);
  }

  async function createRecurringTransaction(baseData: Partial<PessoalTransaction | NegocioTransaction>, repeatType: RepeatType, times: number) {
    const supabase = createClient();
    let currentDate = baseData.date as string;

    for (let i = 0; i < times; i++) {
      currentDate = getNextDate(currentDate, repeatType);
      
      if (activeContext === "pessoal") {
        await supabase.from("pessoal_transactions").insert({
          account_id: baseData.account_id,
          subcategory_id: baseData.subcategory_id,
          amount: baseData.amount,
          date: currentDate,
          type: baseData.type,
          description: baseData.description,
        });
      } else {
        await supabase.from("negocio").insert({
          amount: baseData.amount,
          date: currentDate,
          type: baseData.type,
          description: baseData.description,
          category: (baseData as NegocioTransaction).category,
        });
      }
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

        if (formData.repeat !== "none") {
          const baseData = {
            account_id: formData.account_id,
            subcategory_id: formData.subcategory_id,
            amount: amountValue,
            date: formData.date,
            type: formData.type,
            description: formData.description,
          };
          await createRecurringTransaction(baseData, formData.repeat, 11);
        }
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

        if (formData.repeat !== "none") {
          const baseData = {
            amount: amountValue,
            date: formData.date,
            type: formData.type,
            description: formData.description,
            category: formData.category,
          };
          await createRecurringTransaction(baseData, formData.repeat, 11);
        }
      }

      setIsModalOpen(false);
      resetFormData();
      loadData();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao criar transação");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTransaction) return;
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
          .update({
            account_id: formData.account_id,
            subcategory_id: formData.subcategory_id,
            amount: amountValue,
            date: formData.date,
            type: formData.type,
            description: formData.description,
          })
          .eq("id", selectedTransaction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("negocio")
          .update({
            amount: amountValue,
            date: formData.date,
            type: formData.type,
            description: formData.description,
            category: formData.category,
          })
          .eq("id", selectedTransaction.id);

        if (error) throw error;
      }

      setIsEditModalOpen(false);
      resetFormData();
      loadData();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao editar transação");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedTransaction) return;
    setSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();

    try {
      if (activeContext === "pessoal") {
        const { error } = await supabase
          .from("pessoal_transactions")
          .delete()
          .eq("id", selectedTransaction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("negocio")
          .delete()
          .eq("id", selectedTransaction.id);

        if (error) throw error;
      }

      setIsDeleteModalOpen(false);
      setSelectedTransaction(null);
      loadData();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao deletar transação");
    } finally {
      setSubmitting(false);
    }
  }

  function resetFormData() {
    setFormData({
      account_id: "",
      subcategory_id: "",
      amount: "",
      date: formatDateToInput(new Date()),
      type: "expense",
      description: "",
      category: "",
      repeat: "none",
    });
  }

  function openEditModal(t: PessoalTransaction | NegocioTransaction) {
    setSelectedTransaction(t);
    setFormData({
      account_id: activeContext === "pessoal" ? (t as PessoalTransaction).account_id : "",
      subcategory_id: activeContext === "pessoal" ? (t as PessoalTransaction).subcategory_id : "",
      amount: String(t.amount).replace(".", ","),
      date: t.date.split("T")[0],
      type: t.type,
      description: t.description,
      category: activeContext === "negocio" ? (t as NegocioTransaction).category : "",
      repeat: "none",
    });
    setIsEditModalOpen(true);
  }

  function openDeleteModal(t: PessoalTransaction | NegocioTransaction) {
    setSelectedTransaction(t);
    setIsDeleteModalOpen(true);
  }

  const transactions = activeContext === "pessoal"
    ? pessoalTransactions
    : negocioTransactions;

  const transacoesFiltradas = transactions.filter((t) =>
    filtro === "todas" ? true : t.type === filtro
  );

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
          variant={filtro === "todas" ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltro("todas")}
        >
          Todas
        </Button>
        <Button
          variant={filtro === "income" ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltro("income")}
        >
          Receitas
        </Button>
        <Button
          variant={filtro === "expense" ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltro("expense")}
        >
          Despesas
        </Button>
      </div>

      <div className="space-y-2">
        {transacoesFiltradas.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma transação encontrada.</p>
        ) : (
          transacoesFiltradas.map((t) => {
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
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="font-semibold">
                        {t.description || "Sem descrição"}
                      </span>
                      {activeContext === "pessoal" && (t as PessoalTransaction).pessoal_accounts && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {(t as PessoalTransaction).pessoal_accounts?.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        {t.type === "income" ? "+" : "-"}
                        {formatCurrency(Number(t.amount))}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditModal(t)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => openDeleteModal(t)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{dataExibicao}</span>
                    <span>{catText}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Button
        className="fixed bottom-20 md:bottom-4 right-4 h-14 w-14 rounded-full shadow-lg"
        size="icon"
        onClick={() => {
          resetFormData();
          setIsModalOpen(true);
        }}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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

            <div className="space-y-2">
              <Label htmlFor="repeat" className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Repetir
              </Label>
              <Select
                value={formData.repeat}
                onValueChange={(value) => setFormData({ ...formData, repeat: value as RepeatType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não repetir</SelectItem>
                  <SelectItem value="daily">Diariamente</SelectItem>
                  <SelectItem value="weekly">Semanalmente</SelectItem>
                  <SelectItem value="monthly">Mensalmente</SelectItem>
                  <SelectItem value="yearly">Anualmente</SelectItem>
                </SelectContent>
              </Select>
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

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-type">Tipo</Label>
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
                  <Label htmlFor="edit-account">Conta</Label>
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
                  <Label htmlFor="edit-subcategory">Categoria</Label>
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
                <Label htmlFor="edit-category">Categoria</Label>
                <Input
                  id="edit-category"
                  type="text"
                  placeholder="Ex: Vendas, Serviços"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-amount">Valor</Label>
              <Input
                id="edit-amount"
                type="text"
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-date">Data</Label>
              <Input
                id="edit-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Input
                id="edit-description"
                type="text"
                placeholder="Descrição opcional"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-repeat" className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Repetir
              </Label>
              <Select
                value={formData.repeat}
                onValueChange={(value) => setFormData({ ...formData, repeat: value as RepeatType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não repetir</SelectItem>
                  <SelectItem value="daily">Diariamente</SelectItem>
                  <SelectItem value="weekly">Semanalmente</SelectItem>
                  <SelectItem value="monthly">Mensalmente</SelectItem>
                  <SelectItem value="yearly">Anualmente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {submitError && (
              <p className="text-red-500 text-sm">{submitError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
          </p>
          {submitError && (
            <p className="text-red-500 text-sm">{submitError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}