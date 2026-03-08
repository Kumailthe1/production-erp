import DistributorFormPage from "@/components/erp/distributor-form-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DistributorFormPage distributorId={id} />;
}
