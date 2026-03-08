"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { ErpPageHeader } from "@/components/erp/ui";
import { ERP_API_BASE } from "@/lib/erp-api";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { selectToken } from "@/lib/userSlice";

type ProductionViewPageProps = {
  batchId: string;
};

type BatchItemDetails = {
  parameter_id: number;
  parameter_name: string;
  quantity_unit: string;
  new_quantity_added: number;
  quantity_consumed: number;
  fresh_quantity_consumed: number;
  consumed_cost: number;
  unit_cost_snapshot: number;
};

type BatchDetailsResponse = {
  data: {
    id: number;
    batch_number: string;
    production_date: string;
    batch_size_liters: number;
    bottles_produced: number;
    total_cost: number;
    status: string;
  };
  items: BatchItemDetails[];
  packaging_allocations?: Array<{
    id: number;
    size_name: string;
    volume_liters: number;
    bottles_allocated: number;
    liters_allocated: number;
    selling_price_per_bottle: number;
  }>;
  stock_by_size?: Array<{
    size_name: string;
    volume_liters: number;
    total_bottles_produced: number;
    bottles_remaining: number;
  }>;
  expenses?: Array<{
    id: number;
    expense_label: string;
    amount: number;
  }>;
  sales_summary?: {
    sold_bottles: number;
    revenue: number;
    cost: number;
    profit: number;
  };
};

export default function ProductionViewPage({ batchId }: ProductionViewPageProps) {
  const token = useSelector(selectToken);
  const [data, setData] = useState<BatchDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let active = true;
    setLoading(true);
    setError(null);

    fetch(`${ERP_API_BASE}/production/batches/${batchId}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const result = (await response.json()) as BatchDetailsResponse & { message?: string };
        if (!response.ok) {
          throw new Error(result.message ?? "Could not load production batch");
        }
        return result;
      })
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Request failed");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [batchId, token]);

  const batch = data?.data;
  const itemsTotalCost = (data?.items ?? []).reduce(
    (sum, item) => sum + Number(item.consumed_cost ?? 0),
    0
  );
  const expensesTotalCost = (data?.expenses ?? []).reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0
  );
  const computedBatchCost = itemsTotalCost + expensesTotalCost;
  const amountPerLiter =
    batch && Number(batch.batch_size_liters ?? 0) > 0
      ? computedBatchCost / Number(batch.batch_size_liters ?? 1)
      : 0;

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title={batch ? `Batch ${batch.batch_number}` : "Production Batch"}
        description="Review batch cost, material usage, bottle allocation, stock movement, and realized sales performance."
        action={
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/dashboard/production">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Production
              </Link>
            </Button>
            <Button asChild className="rounded-xl bg-slate-950 text-white hover:bg-slate-800">
              <Link href={`/dashboard/production/${batchId}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Batch
              </Link>
            </Button>
          </div>
        }
      />

      {loading ? <p className="text-sm text-slate-500">Loading production analysis...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {batch ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Sold Bottles</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{Number(data?.sales_summary?.sold_bottles ?? 0).toLocaleString()}</p>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Revenue</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">₦ {Number(data?.sales_summary?.revenue ?? 0).toLocaleString()}</p>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Cost Of Sold Items</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">₦ {Number(data?.sales_summary?.cost ?? 0).toLocaleString()}</p>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Profit</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">₦ {Number(data?.sales_summary?.profit ?? 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Bottles Produced</th>
                  <th className="px-4 py-4 font-semibold">Total Batch Cost</th>
                  <th className="px-4 py-4 font-semibold">Cost / Liter</th>
                  <th className="px-4 py-4 font-semibold">Bottle Sizes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <tr>
                  <td className="px-4 py-4 font-medium text-slate-900">{batch.bottles_produced.toLocaleString()}</td>
                  <td className="px-4 py-4 font-medium text-slate-900">₦ {computedBatchCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-4 font-medium text-slate-900">
                    ₦ {amountPerLiter.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-900">{Number(data?.packaging_allocations?.length ?? 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Batch Analysis</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Parameter</th>
                    <th className="px-4 py-4 font-semibold">Taken From Stock</th>
                    <th className="px-4 py-4 font-semibold">Fresh Unit Cost</th>
                    <th className="px-4 py-4 font-semibold">Consumed From Fresh Stock</th>
                    <th className="px-4 py-4 font-semibold">Actual Consumed</th>
                    <th className="px-4 py-4 font-semibold">Consumed Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {data?.items.map((item) => (
                    <tr key={item.parameter_id}>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{item.parameter_name}</div>
                        <div className="text-xs text-slate-500">{item.quantity_unit}</div>
                      </td>
                      <td className="px-4 py-4">{Number(item.new_quantity_added ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">₦ {Number(item.unit_cost_snapshot ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">{Number(item.fresh_quantity_consumed ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">{Number(item.quantity_consumed ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">₦ {Number(item.consumed_cost ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {(data?.expenses ?? []).length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Expenses</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Label</th>
                      <th className="px-4 py-4 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {(data?.expenses ?? []).map((expense) => (
                      <tr key={expense.id}>
                        <td className="px-4 py-4">{expense.expense_label}</td>
                        <td className="px-4 py-4">₦ {Number(expense.amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-4 py-4 font-semibold text-slate-900">Total Expenses</td>
                      <td className="px-4 py-4 font-semibold text-slate-900">₦ {expensesTotalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {(data?.packaging_allocations ?? []).length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Packaging Size Allocation</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Bottle Size</th>
                      <th className="px-4 py-4 font-semibold">Liters Allocated</th>
                      <th className="px-4 py-4 font-semibold">Bottles Produced</th>
                      <th className="px-4 py-4 font-semibold">Amount / Bottle</th>
                      <th className="px-4 py-4 font-semibold">Total Cost</th>
                      <th className="px-4 py-4 font-semibold">Selling Price / Bottle</th>
                      <th className="px-4 py-4 font-semibold">Total Selling Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {(data?.packaging_allocations ?? []).map((allocation) => {
                      const bottles = Number(allocation.bottles_allocated ?? 0);
                      const litersAllocatedRaw = Number(allocation.liters_allocated ?? 0);
                      const litersAllocated =
                        litersAllocatedRaw > 0 ? litersAllocatedRaw : Number(allocation.volume_liters ?? 0) * bottles;
                      const amountPerBottle = bottles > 0 ? (litersAllocated * amountPerLiter) / bottles : 0;
                      const totalCost = amountPerBottle * bottles;
                      const sellingPerBottle = Number(allocation.selling_price_per_bottle ?? 0);
                      const totalSelling = sellingPerBottle * bottles;

                      return (
                        <tr key={allocation.id}>
                          <td className="px-4 py-4 font-medium text-slate-900">{allocation.size_name}</td>
                          <td className="px-4 py-4">{litersAllocated.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                          <td className="px-4 py-4">{bottles.toLocaleString()}</td>
                          <td className="px-4 py-4">₦ {amountPerBottle.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-4">₦ {totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-4">₦ {sellingPerBottle.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-4">₦ {totalSelling.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {(data?.stock_by_size ?? []).length > 0 ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Finished Stock by Bottle Size</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Bottle Size</th>
                      <th className="px-4 py-4 font-semibold">Volume (L)</th>
                      <th className="px-4 py-4 font-semibold">Produced</th>
                      <th className="px-4 py-4 font-semibold">Remaining</th>
                      <th className="px-4 py-4 font-semibold">Sold/Distributed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {(data?.stock_by_size ?? []).map((stock) => {
                      const produced = Number(stock.total_bottles_produced ?? 0);
                      const remaining = Number(stock.bottles_remaining ?? 0);
                      const moved = Math.max(produced - remaining, 0);
                      return (
                        <tr key={`${stock.size_name}-${stock.volume_liters}`}>
                          <td className="px-4 py-4 font-medium text-slate-900">{stock.size_name}</td>
                          <td className="px-4 py-4">{Number(stock.volume_liters ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-4">{produced.toLocaleString()}</td>
                          <td className="px-4 py-4">{remaining.toLocaleString()}</td>
                          <td className="px-4 py-4">{moved.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
