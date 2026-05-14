export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { TransactionsContent } from "./transactions-content";
import { TransactionsSkeleton } from "@/components/skeletons";

export default function TransacoesPage() {
  return (
    <Suspense fallback={<TransactionsSkeleton />}>
      <TransactionsContent />
    </Suspense>
  );
}