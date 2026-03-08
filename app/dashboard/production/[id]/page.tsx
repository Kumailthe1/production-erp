import ProductionViewPage from "@/components/erp/production-view-page";

export default function Page({ params }: { params: { id: string } }) {
  return <ProductionViewPage batchId={params.id} />;
}
