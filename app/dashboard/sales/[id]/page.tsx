import SalesViewPage from "@/components/erp/sales-view-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SalesViewPage saleId={id} />;
}
