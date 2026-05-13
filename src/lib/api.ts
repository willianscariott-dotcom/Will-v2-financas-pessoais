import { supabase } from "./supabase";
import { Transaction, Account, Subcategory } from "@/types";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

export function getUserId(): string {
  return DEFAULT_USER_ID;
}

export async function fetchTransactions(userId: string = getUserId()) {
  const { data, error } = await supabase
    .from("pessoal_transactions")
    .select(`
      *,
      account:pessoal_accounts(name),
      subcategory:pessoal_subcategories(name)
    `)
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as Transaction[];
}

export async function fetchTransactionsCurrentMonth(userId: string = getUserId()) {
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
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as Transaction[];
}

export async function fetchAccounts(userId: string = getUserId()) {
  const { data, error } = await supabase
    .from("pessoal_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) throw error;
  return data as Account[];
}

export async function fetchSubcategories(userId: string = getUserId()) {
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

export async function createTransaction(transaction: {
  user_id: string;
  account_id: string;
  subcategory_id: string;
  amount: number;
  date: string;
  type: "income" | "expense";
  description: string;
}) {
  const { data, error } = await supabase
    .from("pessoal_transactions")
    .insert(transaction)
    .select();

  if (error) throw error;
  return data;
}