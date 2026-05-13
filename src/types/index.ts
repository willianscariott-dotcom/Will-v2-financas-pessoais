export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  subcategory_id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  installment_current: number | null;
  installment_total: number | null;
  account?: { name: string };
  subcategory?: { name: string };
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
}

export interface Subcategory {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
}