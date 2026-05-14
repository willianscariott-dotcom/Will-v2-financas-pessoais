"use client";

// @ts-nocheck

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Repeat } from "lucide-react";
import { useFinancialContext } from "@/contexts/financial-context";
import { formatDateToInput } from "@/lib/utils-date";
import { createClient } from "@/lib/supabase/client";
import { Account, Subcategory } from "@/types";
import { useRouter } from "next/navigation";

type TransactionType = "income" | "expense";

interface TransactionToEdit {
  id: string;
  account_id?: string;
  subcategory_id?: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  category?: string;
  pessoal_accounts?: { name: string };
  pessoal_subcategories?: { id: string; name: string; pessoal_categories?: { name: string } };
}

interface GlobalFABProps {
  transactionToEdit?: TransactionToEdit | null;
  onEditComplete?: () => void;
  onTransactionsChange?: () => void;
}

export function GlobalFAB({ transactionToEdit, onEditComplete, onTransactionsChange }: GlobalFABProps) {
  const router = useRouter();
  const { activeContext } = useFinancialContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
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
    repeatType: "none" as "none" | "daily" | "weekly" | "monthly" | "yearly",
    repeatOption: "times" as "times" | "until",
    repeatTimes: "1",
    repeatUntil: formatDateToInput(new Date()),
  });

  function openModal(existingTransaction?: TransactionToEdit | null) {
    setSubmitError(null);
    
    if (activeContext === "pessoal") {
      const supabase = createClient();
      supabase.from("pessoal_accounts").select("*").order("name").then(({ data }) => setAccounts(data || []));
      supabase.from("pessoal_subcategories").select("*, pessoal_categories(name)").order("name").then(({ data }) => setSubcategories(data || []));
    }

    if (existingTransaction) {
      setFormData({
        account_id: existingTransaction.account_id || "",
        subcategory_id: existingTransaction.subcategory_id || "",
        amount: String(existingTransaction.amount).replace(".", ","),
        date: existingTransaction.date.split("T")[0],
        type: existingTransaction.type,
        description: existingTransaction.description,
        category: existingTransaction.category || "",
        repeatType: "none",
        repeatOption: "times",
        repeatTimes: "1",
        repeatUntil: formatDateToInput(new Date()),
      });
    } else {
      setFormData({
        account_id: "",
        subcategory_id: "",
        amount: "",
        date: formatDateToInput(new Date()),
        type: "expense",
        description: "",
        category: "",
        repeatType: "none",
        repeatOption: "times",
        repeatTimes: "1",
        repeatUntil: formatDateToInput(new Date()),
      });
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    if (onEditComplete) onEditComplete();
  }

  function getNextDate(currentDate: string, repeatType: string): string {
    const [year, month, day] = currentDate.split("-").map(Number);
    const nextDate = new Date(year, month - 1, day);

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
        if (transactionToEdit || formData.account_id) {
          const updateData: Record<string, unknown> = {
            amount: amountValue,
            date: formData.date,
            type: formData.type,
            description: formData.description,
          };
          if (formData.account_id) updateData.account_id = formData.account_id;
          if (formData.subcategory_id) updateData.subcategory_id = formData.subcategory_id;
          
          const { error } = await supabase
            .from("pessoal_transactions")
            .update(updateData)
            .eq("id", transactionToEdit?.id || "");
          if (error) throw error;
        } else {
          const { error } = await supabase.from("pessoal_transactions").insert({
            account_id: formData.account_id,
            subcategory_id: formData.subcategory_id,
            amount: amountValue,
            date: formData.date,
            type: formData.type,
            description: formData.description,
          });
          if (error) throw error;
        }
      } else {
        if (transactionToEdit) {
          const { error } = await supabase.from("negocio").update({
            amount: amountValue,
            date: formData.date,
            type: formData.type,
            description: formData.description,
            category: formData.category,
          }).eq("id", transactionToEdit.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("negocio").insert({
            amount: amountValue,
            date: formData.date,
            type: formData.type,
            description: formData.description,
            category: formData.category,
          });
          if (error) throw error;
        }
      }

      closeModal();
      if (onTransactionsChange) onTransactionsChange();
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao salvar transação");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        className="fixed bottom-20 md:bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-40"
        size="icon"
        onClick={() => openModal()}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{transactionToEdit ? "Editar Transação" : "Nova Transação"}</DialogTitle>
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

            {!transactionToEdit && (
              <div className="space-y-2 border p-3 rounded-lg">
                <Label htmlFor="repeat" className="flex items-center gap-2">
                  <Repeat className="h-4 w-4" />
                  Repetir Transação
                </Label>
                <Select
                  value={formData.repeatType}
                  onValueChange={(value) => setFormData({ ...formData, repeatType: value as typeof formData.repeatType })}
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

                {formData.repeatType !== "none" && (
                  <div className="space-y-3 mt-3">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={formData.repeatOption === "times" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setFormData({ ...formData, repeatOption: "times" })}
                      >
                        Vezes
                      </Button>
                      <Button
                        type="button"
                        variant={formData.repeatOption === "until" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setFormData({ ...formData, repeatOption: "until" })}
                      >
                        Até dia
                      </Button>
                    </div>

                    {formData.repeatOption === "times" ? (
                      <div className="flex items-center gap-2">
                        <span>Repetir</span>
                        <Input
                          type="number"
                          min="1"
                          className="w-20"
                          value={formData.repeatTimes}
                          onChange={(e) => setFormData({ ...formData, repeatTimes: e.target.value })}
                        />
                        <span>vez(es)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>Até</span>
                        <Input
                          type="date"
                          className="flex-1"
                          value={formData.repeatUntil}
                          onChange={(e) => setFormData({ ...formData, repeatUntil: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
    </>
  );
}

export { GlobalFAB as OriginalGlobalFAB };
export type { TransactionToEdit };