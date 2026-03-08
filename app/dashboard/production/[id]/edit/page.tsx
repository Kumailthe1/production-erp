import ProductionCreatePage from "@/components/erp/production-create-page";

export default function Page({ params }: { params: { id: string } }) {
  return <ProductionCreatePage batchId={params.id} />;
}
