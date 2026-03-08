import DistributionOrderFormPage from "@/components/erp/distribution-order-form-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DistributionOrderFormPage orderId={id} />;
}
