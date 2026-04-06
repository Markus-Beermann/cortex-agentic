import { RunDetailScreen } from "@/components/run-detail-screen";
import { RunListScreen } from "@/components/run-list-screen";

type RunsPageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function RunsPage({ searchParams }: RunsPageProps) {
  const { id } = await searchParams;

  if (typeof id === "string" && id.trim().length > 0) {
    return <RunDetailScreen runId={id.trim()} />;
  }

  return <RunListScreen />;
}
