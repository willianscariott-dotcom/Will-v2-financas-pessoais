import { createClient } from "@/lib/supabase/server";
import { Transaction, Account, Subcategory } from "@/types";

export type TransactionType = "income" | "expense";

export interface NegocioTransaction {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
  category: string;
}

export async function getUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  return user.id;
}

export async function fetchPessoalTransactions(userId?: string) {
  const supabase = await createClient();
  const id = userId || await getUserId();
  const { data, error } = await supabase
    .from("pessoal_transactions")
    .select(`
      *,
      account:pessoal_accounts(name),
      subcategory:pessoal_subcategories(name)
    `)
    .eq("user_id", id)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as Transaction[];
}

export async function fetchPessoalTransactionsCurrentMonth(userId?: string) {
  const supabase = await createClient();
  const id = userId || await getUserId();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("pessoal_transactions")
    .select(`
      *,
      account:pessoal_accounts(name),
      subcategory:pessoal_subcategories(name)
    `)
    .eq("user_id", id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as Transaction[];
}

export async function fetchNegocioTransactions(userId?: string) {
  const supabase = await createClient();
  const id = userId || await getUserId();
  const { data, error } = await supabase
    .from("negocio")
    .select("*")
    .eq("user_id", id)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as NegocioTransaction[];
}

export async function fetchNegocioTransactionsCurrentMonth(userId?: string) {
  const supabase = await createClient();
  const id = userId || await getUserId();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("negocio")
    .select("*")
    .eq("user_id", id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as NegocioTransaction[];
}

export async function fetchAccounts() {
  const supabase = await createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("pessoal_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) throw error;
  return data as Account[];
}

export async function fetchSubcategories() {
  const supabase = await createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("pessoal_subcategories")
    .select(`
      *,
      category:pessoal_categories(name)
    `)
    .eq("user_id", userId)
    .order("name");

  if (error) throw error;
  return data as Subcategory[];
}

export async function createPessoalTransaction(transaction: {
  account_id: string;
  subcategory_id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
}) {
  const supabase = await createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("pessoal_transactions")
    .insert({ ...transaction, user_id: userId })
    .select();

  if (error) throw error;
  return data;
}

export async function createNegocioTransaction(transaction: {
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  category: string;
}) {
  const supabase = await createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("negocio")
    .insert({ ...transaction, user_id: userId })
    .select();

  if (error) throw error;
  return data;
}