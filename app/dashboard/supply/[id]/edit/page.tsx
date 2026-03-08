import SupplyCreatePage from "@/components/erp/supply-create-page";

export default function Page({ params }: { params: { id: string } }) {
  return <SupplyCreatePage receiptId={params.id} />;
}
