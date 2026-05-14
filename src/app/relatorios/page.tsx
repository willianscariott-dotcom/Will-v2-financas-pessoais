export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { ReportsContent } from "./reports-content";
import { ReportsSkeleton } from "@/components/skeletons";

export default function RelatoriosPage() {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsContent />
    </Suspense>
  );
}