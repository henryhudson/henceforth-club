import { redirect } from "next/navigation";
import { listDates } from "@/lib/board-data";

export const dynamic = "force-dynamic";

// Old links keep working: /board/report → newest daily edition;
// /board/report?date=X → that date's edition.
export default async function ReportRedirect({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  if (date) redirect(`/board/reports/${date}`);
  const dates = await listDates();
  redirect(dates[0] ? `/board/reports/${dates[0]}` : "/board/reports");
}
