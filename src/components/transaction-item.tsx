// @ts-nocheck
"use client";

import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils-date";

type TransactionType = "income" | "expense";

interface TransactionItemProps {
  id: string;
  amount: number;
  date: string;
  type: TransactionType;
  description: string;
  category?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TransactionItem({
  id,
  amount,
  date,
  type,
  description,
  category,
  onEdit,
  onDelete,
}: TransactionItemProps) {
  const dateStr = date.split("T")[0];
  const [ano, mes, dia] = dateStr.split("-");
  const dataExibicao = `${dia}/${mes}/${ano}`;

  return (
    <div className="flex justify-between items-center py-3 border-b border-border last:border-0">
      <div className="flex flex-col">
        <span className="font-medium text-sm">{description || "Sem descrição"}</span>
        <span className="text-xs text-muted-foreground">
          {dataExibicao}{category ? ` • ${category}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`font-semibold text-sm ${type === "income" ? "text-green-600" : "text-red-600"}`}>
          {type === "income" ? "+" : "-"}
          {formatCurrency(Number(amount))}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(id)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(id)} className="text-red-500">
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}