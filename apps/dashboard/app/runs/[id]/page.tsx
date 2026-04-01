import { RunDetailScreen } from "@/components/run-detail-screen";

type RunDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { id } = await params;

  return <RunDetailScreen runId={id} />;
}
