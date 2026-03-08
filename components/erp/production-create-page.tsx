"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useErpQuery } from "@/components/erp/use-erp-query";
import { ErpPageHeader, SectionCard } from "@/components/erp/ui";
import { ERP_API_BASE, ProductionParameter } from "@/lib/erp-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProductionCreatePageProps = {
  batchId?: string;
};

type BatchItemDetails = {
  parameter_id: number;
  parameter_name: string;
  new_quantity_added: number;
  closing_leftover_quantity: number;
  opening_leftover_quantity: number;
  total_available_quantity: number;
  quantity_consumed: number;
  fresh_quantity_consumed: number;
  leftover_quantity_consumed: number;
  consumed_cost: number;
  unit_cost_snapshot: number;
  quantity_unit: string;
};

type BatchDetailsResponse = {
  data: {
    id: number;
    batch_number: string;
    production_date: string;
    batch_size_liters: number;
    bottles_produced: number;
    selling_price_per_bottle: number;
    total_cost: number;
    cost_per_bottle: number;
    projected_revenue: number;
    projected_profit: number;
    status: string;
  };
  items: BatchItemDetails[];
  packaging_allocations?: Array<{
    packaging_size_id: number | null;
    size_name: string;
    volume_liters: number;
    liters_allocated: number;
    bottles_allocated: number;
    unit_packaging_cost: number;
    selling_price_per_bottle: number;
  }>;
  expenses?: Array<{
    id: number;
    expense_label: string;
    amount: number;
  }>;
};

type ProductionLine = {
  parameter_id: number;
  name: string;
  quantity_unit: string;
  unit_cost_snapshot: number;
  opening_leftover_quantity: number;
  quantity_taken_from_stock: string;
  closing_leftover_quantity: string;
};

type PackagingAllocationLine = {
  source_parameter_id: string;
  packaging_size_id: string;
  size_name: string;
  liters_allocated: string;
  bottles_allocated: string;
  selling_price_per_bottle: string;
};
type StockBalance = {
  parameter_id: number;
  parameter_name: string;
  quantity_in_stock: number;
  stock_value: number;
  quantity_unit: string;
};
type ExpenseLine = {
  expense_label: string;
  amount: string;
};

const parseBottleVolumeLiters = (name: string): number => {
  const normalized = name.toLowerCase();
  const literMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(l|liter|litre)\b/);
  if (literMatch) {
    return Number(literMatch[1]);
  }

  const mlMatch = normalized.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (mlMatch) {
    return Number(mlMatch[1]) / 1000;
  }

  return 0;
};

const bottleLabel = (parameter: ProductionParameter): string => {
  const qty = Number(parameter.default_quantity ?? 0);
  const unit = (parameter.quantity_unit || "").trim();
  if (qty > 0 && unit !== "") {
    return `${qty} ${unit} ${parameter.name}`;
  }
  return parameter.name;
};

const bottleVolumeFromParameter = (parameter: ProductionParameter): number => {
  const unit = (parameter.quantity_unit || "").toLowerCase().trim();
  const qty = Number(parameter.default_quantity ?? 0);
  if (qty <= 0) {
    return parseBottleVolumeLiters(parameter.name);
  }
  if (unit === "liter" || unit === "litre" || unit === "l") {
    return qty;
  }
  if (unit === "ml") {
    return qty / 1000;
  }
  return qty;
};

const resolveBottleParameterByVolume = (
  parameters: ProductionParameter[],
  targetVolumeLiters: number
): ProductionParameter | undefined => {
  if (targetVolumeLiters <= 0) return undefined;
  const tolerance = 0.0005;
  return parameters.find((parameter) => {
    const volume = bottleVolumeFromParameter(parameter);
    return Math.abs(volume - targetVolumeLiters) <= tolerance;
  });
};

export default function ProductionCreatePage({ batchId }: ProductionCreatePageProps) {
  const router = useRouter();
  const isEditMode = Boolean(batchId);
  const settings = useErpQuery<{ data: ProductionParameter[] }>("/production/settings");
  const stockBalances = useErpQuery<{ data: StockBalance[] }>("/supply/stock-balances");
  const leftovers = useErpQuery<{ data: Array<Record<string, string | number>> }>("/production/leftovers");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [batch, setBatch] = useState({
    batch_number: `BATCH-${Date.now()}`,
    production_date: new Date().toISOString().slice(0, 10),
    batch_size_liters: "50",
  });
  const [items, setItems] = useState<ProductionLine[]>([]);
  const [packagingAllocations, setPackagingAllocations] = useState<PackagingAllocationLine[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLine[]>([]);

  const usableParameters = useMemo(
    () =>
      (settings.data?.data ?? []).filter((item) => {
        if (item.parameter_kind === "output") return false;
        const name = item.name.toLowerCase();
        const code = item.code.toLowerCase();
        return !(name.includes("bottle") || code.includes("bottle"));
      }),
    [settings.data]
  );
  const bottleParameters = useMemo(
    () =>
      (settings.data?.data ?? []).filter((item) => {
        const name = item.name.toLowerCase();
        const code = item.code.toLowerCase();
        return name.includes("bottle") || code.includes("bottle");
      }),
    [settings.data]
  );

  const openingLeftoverMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of leftovers.data?.data ?? []) {
      const parameterId = Number(item.parameter_id ?? 0);
      const remaining = Number(item.remaining_quantity ?? 0);
      map.set(parameterId, (map.get(parameterId) ?? 0) + remaining);
    }
    return map;
  }, [leftovers.data]);
  const stockAvailableMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of stockBalances.data?.data ?? []) {
      map.set(Number(row.parameter_id), Number(row.quantity_in_stock ?? 0));
    }
    return map;
  }, [stockBalances.data]);
  const stockAverageCostMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of stockBalances.data?.data ?? []) {
      const quantity = Number(row.quantity_in_stock ?? 0);
      const value = Number(row.stock_value ?? 0);
      if (quantity > 0) {
        map.set(Number(row.parameter_id), value / quantity);
      }
    }
    return map;
  }, [stockBalances.data]);

  useEffect(() => {
    if (usableParameters.length === 0 || items.length > 0 || isEditMode) return;
    setItems(
      usableParameters.map((item) => ({
        parameter_id: item.id,
        name: item.name,
        quantity_unit: item.quantity_unit,
        unit_cost_snapshot: Number(item.unit_cost ?? 0),
        opening_leftover_quantity: openingLeftoverMap.get(item.id) ?? 0,
        quantity_taken_from_stock: "",
        closing_leftover_quantity: "0",
      }))
    );
  }, [isEditMode, items.length, openingLeftoverMap, usableParameters]);

  useEffect(() => {
    if (isEditMode || items.length === 0) return;
    setItems((current) =>
      current.map((item) => ({
        ...item,
        opening_leftover_quantity: openingLeftoverMap.get(item.parameter_id) ?? 0,
      }))
    );
  }, [isEditMode, items.length, openingLeftoverMap]);

  useEffect(() => {
    if (!batchId || !settings.token) return;

    let active = true;
    setLoadingExisting(true);
    setMessage(null);

    fetch(`${ERP_API_BASE}/production/batches/${batchId}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${settings.token}`,
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
        if (!active) return;
        setBatch({
          batch_number: result.data.batch_number,
          production_date: result.data.production_date,
          batch_size_liters: String(result.data.batch_size_liters ?? 0),
        });
        setItems(
          result.items
            .filter((item) => !item.parameter_name.toLowerCase().includes("bottle"))
            .map((item) => ({
              parameter_id: item.parameter_id,
              name: item.parameter_name,
              quantity_unit: item.quantity_unit,
              unit_cost_snapshot: Number(item.unit_cost_snapshot ?? 0),
              opening_leftover_quantity: Number(item.opening_leftover_quantity ?? 0),
              quantity_taken_from_stock: String(item.new_quantity_added ?? 0),
              closing_leftover_quantity: String(item.closing_leftover_quantity ?? 0),
            }))
        );
        setPackagingAllocations(
          (result.packaging_allocations ?? []).map((allocation) => ({
            source_parameter_id: String(
              resolveBottleParameterByVolume(
                bottleParameters,
                Number(allocation.volume_liters ?? 0)
              )?.id ?? ""
            ),
            packaging_size_id: allocation.packaging_size_id ? String(allocation.packaging_size_id) : "",
            size_name: String(allocation.size_name ?? ""),
            liters_allocated: String(
              Number(allocation.liters_allocated ?? 0) > 0
                ? allocation.liters_allocated
                : Number(allocation.volume_liters ?? 0) * Number(allocation.bottles_allocated ?? 0)
            ),
            bottles_allocated: String(allocation.bottles_allocated ?? ""),
            selling_price_per_bottle: String(allocation.selling_price_per_bottle ?? ""),
          }))
        );
        setExpenses(
          (result.expenses ?? []).map((expense) => ({
            expense_label: String(expense.expense_label ?? ""),
            amount: String(expense.amount ?? ""),
          }))
        );
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Could not load production batch");
      })
      .finally(() => {
        if (active) {
          setLoadingExisting(false);
        }
      });

    return () => {
      active = false;
    };
  }, [batchId, settings.token, bottleParameters]);

  const analysis = useMemo(() => {
    const lines = items.map((item) => {
      const opening = Number(item.opening_leftover_quantity || 0);
      const taken = Number(item.quantity_taken_from_stock || 0);
      const closing = Number(item.closing_leftover_quantity || 0);
      const storeAvailable = Number(stockAvailableMap.get(item.parameter_id) ?? 0);
      const totalAvailable = opening + taken;
      const actualConsumed = Math.max(totalAvailable - closing, 0);
      const invalidLeftover = closing > totalAvailable;
      const invalidStockTake = taken > storeAvailable;

      return {
        ...item,
        storeAvailable,
        totalAvailable,
        actualConsumed,
        invalidLeftover,
        invalidStockTake,
      };
    });

    const totalCostEstimate = lines.reduce((sum, item) => {
      const parameter = usableParameters.find((entry) => entry.id === item.parameter_id);
      const estimatedUnitCost = Number(
        stockAverageCostMap.get(item.parameter_id) ??
          item.unit_cost_snapshot ??
          parameter?.unit_cost ??
          0
      );
      return sum + item.actualConsumed * estimatedUnitCost;
    }, 0);

    return {
      lines,
      totalCostEstimate,
    };
  }, [items, usableParameters, stockAvailableMap, stockAverageCostMap]);

  const totalPackagingBottles = useMemo(
    () => packagingAllocations.reduce((sum, row) => sum + Number(row.bottles_allocated || 0), 0),
    [packagingAllocations]
  );
  const packagingStockValidation = useMemo(() => {
    const requestedByParameter = new Map<number, number>();
    for (const row of packagingAllocations) {
      const sourceParameterId = Number(row.source_parameter_id || 0);
      if (sourceParameterId <= 0) continue;
      requestedByParameter.set(
        sourceParameterId,
        (requestedByParameter.get(sourceParameterId) ?? 0) + Number(row.bottles_allocated || 0)
      );
    }

    const insufficient = new Map<number, { required: number; available: number }>();
    requestedByParameter.forEach((required, parameterId) => {
      const available = Number(stockAvailableMap.get(parameterId) ?? 0);
      if (required > available) {
        insufficient.set(parameterId, { required, available });
      }
    });

    return insufficient;
  }, [packagingAllocations, stockAvailableMap]);
  const totalAllocatedLiters = useMemo(
    () => packagingAllocations.reduce((sum, row) => sum + Number(row.liters_allocated || 0), 0),
    [packagingAllocations]
  );
  const estimatedBottleCost = useMemo(() => {
    return packagingAllocations.reduce((sum, row) => {
      const parameterId = Number(row.source_parameter_id || 0);
      if (parameterId <= 0) return sum;
      const parameter = bottleParameters.find((item) => item.id === parameterId);
      const bottleUnitCost = Number(
        stockAverageCostMap.get(parameterId) ?? parameter?.unit_cost ?? 0
      );
      return sum + bottleUnitCost * Number(row.bottles_allocated || 0);
    }, 0);
  }, [packagingAllocations, bottleParameters, stockAverageCostMap]);
  const estimatedExpenses = useMemo(
    () => expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [expenses]
  );
  const estimatedTotalBatchCost = useMemo(
    () => analysis.totalCostEstimate + estimatedBottleCost + estimatedExpenses,
    [analysis.totalCostEstimate, estimatedBottleCost, estimatedExpenses]
  );
  const estimatedCostPerLiter = useMemo(() => {
    const liters = Number(batch.batch_size_liters || 0);
    if (liters <= 0) return 0;
    return estimatedTotalBatchCost / liters;
  }, [estimatedTotalBatchCost, batch.batch_size_liters]);

  const submit = async () => {
    if (!settings.token) return;

    if (totalPackagingBottles <= 0) {
      setMessage("Add packaging rows and enter bottles allocated before saving.");
      return;
    }

    if (Number(batch.batch_size_liters || 0) <= 0) {
      setMessage("Enter a batch size greater than zero.");
      return;
    }

    if (analysis.lines.some((item) => item.invalidLeftover)) {
      setMessage("One or more closing leftovers are higher than the total available quantity.");
      return;
    }
    if (analysis.lines.some((item) => item.invalidStockTake)) {
      const invalid = analysis.lines.filter((item) => item.invalidStockTake);
      const details = invalid
        .map(
          (item) =>
            `${item.name}: requested ${Number(item.quantity_taken_from_stock || 0).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })} > store ${item.storeAvailable.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        )
        .join("; ");
      setMessage(`Insufficient store stock. ${details}`);
      return;
    }
    if (packagingStockValidation.size > 0) {
      setMessage("One or more bottle allocations exceed available bottle stock.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const payload = {
      ...batch,
      batch_size_liters: Number(batch.batch_size_liters),
      bottles_produced: totalPackagingBottles,
      items: items
        .filter((item) => Number(item.quantity_taken_from_stock) > 0 || Number(item.closing_leftover_quantity) > 0)
        .map((item) => ({
          parameter_id: item.parameter_id,
          new_quantity_added: Number(item.quantity_taken_from_stock || 0),
          closing_leftover_quantity: Number(item.closing_leftover_quantity || 0),
        })),
      packaging_allocations: packagingAllocations
        .filter((line) => Number(line.bottles_allocated || 0) > 0)
        .map((line) => ({
          source_parameter_id: line.source_parameter_id !== "" ? Number(line.source_parameter_id) : null,
          packaging_size_id:
            line.packaging_size_id !== "" && /^\d+$/.test(line.packaging_size_id)
              ? Number(line.packaging_size_id)
              : null,
          size_name: line.size_name,
          volume_liters:
            Number(line.bottles_allocated || 0) > 0
              ? Number(line.liters_allocated || 0) / Number(line.bottles_allocated || 0)
              : 0,
          bottles_allocated: Number(line.bottles_allocated || 0),
          unit_packaging_cost: 0,
          selling_price_per_bottle: Number(line.selling_price_per_bottle || 0),
        })),
      expenses: expenses
        .filter((item) => item.expense_label.trim() !== "" && Number(item.amount || 0) > 0)
        .map((item) => ({
          expense_label: item.expense_label.trim(),
          amount: Number(item.amount || 0),
        })),
    };

    try {
      const response = await fetch(
        isEditMode ? `${ERP_API_BASE}/production/batches/${batchId}` : `${ERP_API_BASE}/production/batches`,
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.token}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? `Could not ${isEditMode ? "update" : "create"} batch`);
      }
      router.push(isEditMode ? `/dashboard/production/${batchId}` : "/dashboard/production");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title={isEditMode ? "Edit Production" : "Add Production"}
        description={
          isEditMode
            ? "Adjust the batch, materials taken from store, leftovers, bottles produced, and then review the updated analysis."
            : "Enter what was taken from store, record what remained as leftover, and save the batch for analysis."
        }
        action={
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/dashboard/production">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Production
            </Link>
          </Button>
        }
      />

      <SectionCard
        title="Batch Summary"
        description="Save the batch first. Then open the batch view or edit page to review cost per bottle and decide the selling price."
      >
        {loadingExisting ? <p className="mb-4 text-sm text-slate-500">Loading production details...</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Batch number</Label>
            <Input value={batch.batch_number} onChange={(e) => setBatch({ ...batch, batch_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Production date</Label>
            <Input type="date" value={batch.production_date} onChange={(e) => setBatch({ ...batch, production_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Batch size (liters)</Label>
            <Input type="number" value={batch.batch_size_liters} onChange={(e) => setBatch({ ...batch, batch_size_liters: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Bottles produced (auto from sizes)</Label>
            <Input type="number" value={String(totalPackagingBottles)} disabled />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Estimated Batch Cost</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              ₦ {estimatedTotalBatchCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="mt-2 text-xs text-slate-500">Final cost per bottle is calculated after the batch is saved with bottles produced.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Bottles Produced</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {Number(totalPackagingBottles || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Materials and Leftovers"
        description="For each parameter, enter how much fresh quantity you took from stock, record what was already available as leftover, and enter what remained after production."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-4 font-semibold">Parameter</th>
                <th className="px-4 py-4 font-semibold">Opening Leftover</th>
                <th className="px-4 py-4 font-semibold">Available In Store</th>
                <th className="px-4 py-4 font-semibold">Quantity Taken From Stock</th>
                <th className="px-4 py-4 font-semibold">Closing Leftover</th>
                <th className="px-4 py-4 font-semibold">Actual Consumed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {analysis.lines.map((item, index) => (
                <tr key={item.parameter_id}>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.quantity_unit}</div>
                  </td>
                  <td className="px-4 py-4">
                    {item.opening_leftover_quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4">
                    {item.storeAvailable.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4">
                    <Input
                      type="number"
                      max={item.storeAvailable}
                      value={item.quantity_taken_from_stock}
                      onChange={(e) => {
                        const next = [...items];
                        next[index].quantity_taken_from_stock = e.target.value;
                        setItems(next);
                      }}
                      placeholder="0"
                    />
                    {item.invalidStockTake ? (
                      <p className="mt-1 text-xs text-red-500">
                        Exceeds store stock ({item.storeAvailable.toLocaleString(undefined, { maximumFractionDigits: 2 })}).
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">
                        Store available: {item.storeAvailable.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <Input
                      type="number"
                      value={item.closing_leftover_quantity}
                      onChange={(e) => {
                        const next = [...items];
                        next[index].closing_leftover_quantity = e.target.value;
                        setItems(next);
                      }}
                      placeholder="0"
                    />
                    {item.invalidLeftover ? (
                      <p className="mt-1 text-xs text-red-500">Leftover cannot be more than available quantity.</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900">
                      {item.actualConsumed.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <h3 className="text-base font-semibold text-slate-900">Packaging Allocation</h3>
          <p className="mt-1 text-sm text-slate-500">
            Select bottle size from parameters, enter liters allocated and bottles used. Cost per bottle is auto-generated.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-4 font-semibold">Bottle Size</th>
                      <th className="px-4 py-4 font-semibold">Liters Allocated</th>
                      <th className="px-4 py-4 font-semibold">Bottles Used</th>
                      <th className="px-4 py-4 font-semibold">Bottle Stock</th>
                      <th className="px-4 py-4 font-semibold">Cost / Bottle (Auto)</th>
                      <th className="px-4 py-4 font-semibold">Selling Price / Bottle</th>
                    </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {packagingAllocations.map((line, index) => (
                <tr key={`packaging-${index}`}>
                  <td className="px-4 py-4">
                    <select
                      value={line.source_parameter_id}
                      onChange={(event) => {
                        const next = [...packagingAllocations];
                        const selected = bottleParameters.find(
                          (item) => String(item.id) === event.target.value
                        );
                        next[index].source_parameter_id = event.target.value;
                        next[index].packaging_size_id = "";
                        if (selected) {
                          next[index].size_name = bottleLabel(selected);
                          next[index].liters_allocated =
                            Number(next[index].bottles_allocated || 0) > 0
                              ? String(bottleVolumeFromParameter(selected) * Number(next[index].bottles_allocated || 0))
                              : String(bottleVolumeFromParameter(selected));
                        }
                        setPackagingAllocations(next);
                      }}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="">Custom size</option>
                      {bottleParameters.map((size) => (
                        <option key={size.id} value={String(size.id)}>
                          {bottleLabel(size)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <Input
                      type="number"
                      value={line.liters_allocated}
                      onChange={(event) => {
                        const next = [...packagingAllocations];
                        next[index].liters_allocated = event.target.value;
                        setPackagingAllocations(next);
                      }}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Input
                      type="number"
                      value={line.bottles_allocated}
                      onChange={(event) => {
                        const next = [...packagingAllocations];
                        next[index].bottles_allocated = event.target.value;
                        setPackagingAllocations(next);
                      }}
                    />
                  </td>
                  <td className="px-4 py-4">
                    {(() => {
                      const parameterId = Number(line.source_parameter_id || 0);
                      const available = Number(stockAvailableMap.get(parameterId) ?? 0);
                      const requested = Number(line.bottles_allocated || 0);
                      const invalid = requested > available && parameterId > 0;
                      return (
                        <div>
                          <div className="font-medium text-slate-900">
                            {available.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                          {invalid ? (
                            <p className="mt-1 text-xs text-red-500">
                              Requested {requested.toLocaleString(undefined, { maximumFractionDigits: 2 })} exceeds available.
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-4">
                    {(() => {
                      const litersAllocated = Number(line.liters_allocated || 0);
                      const bottles = Number(line.bottles_allocated || 0);
                      const parameterId = Number(line.source_parameter_id || 0);
                      const parameter = bottleParameters.find((item) => item.id === parameterId);
                      const bottleUnitCost = Number(
                        stockAverageCostMap.get(parameterId) ?? parameter?.unit_cost ?? 0
                      );
                      const liquidCostPerBottle = bottles > 0 ? (estimatedCostPerLiter * litersAllocated) / bottles : 0;
                      const autoCost = liquidCostPerBottle + bottleUnitCost;
                      return (
                        <Input
                          type="number"
                          value={autoCost.toFixed(2)}
                          disabled
                        />
                      );
                    })()}
                  </td>
                  <td className="px-4 py-4">
                    <Input
                      type="number"
                      value={line.selling_price_per_bottle}
                      onChange={(event) => {
                        const next = [...packagingAllocations];
                        next[index].selling_price_per_bottle = event.target.value;
                        setPackagingAllocations(next);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() =>
              setPackagingAllocations((current) => [
                ...current,
                {
                  source_parameter_id: "",
                  packaging_size_id: "",
                  size_name: "Custom size",
                  liters_allocated: "",
                  bottles_allocated: "",
                  selling_price_per_bottle: "0",
                },
              ])
            }
          >
            Add size row
          </Button>
          <p className="text-sm text-slate-500">
            Bottles allocated: <strong>{totalPackagingBottles.toLocaleString()}</strong>. Liters allocated:{" "}
            <strong>{totalAllocatedLiters.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> /{" "}
            <strong>{Number(batch.batch_size_liters || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>.
          </p>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <h3 className="text-base font-semibold text-slate-900">Expenses</h3>
          <p className="mt-1 text-sm text-slate-500">
            Add extra production expenses. These amounts are included in total batch cost.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-4 font-semibold">Label</th>
                <th className="px-4 py-4 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {expenses.map((line, index) => (
                <tr key={`expense-${index}`}>
                  <td className="px-4 py-4">
                    <Input
                      value={line.expense_label}
                      placeholder="Expense label"
                      onChange={(event) => {
                        const next = [...expenses];
                        next[index].expense_label = event.target.value;
                        setExpenses(next);
                      }}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Input
                      type="number"
                      value={line.amount}
                      placeholder="0"
                      onChange={(event) => {
                        const next = [...expenses];
                        next[index].amount = event.target.value;
                        setExpenses(next);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() =>
              setExpenses((current) => [...current, { expense_label: "", amount: "" }])
            }
          >
            Add expense row
          </Button>
          <p className="text-sm text-slate-500">
            Total expenses: <strong>₦ {estimatedExpenses.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          </p>
        </div>

        {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            className="rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
            onClick={submit}
            disabled={submitting || !settings.token || loadingExisting}
          >
            {submitting ? "Saving..." : isEditMode ? "Update Production" : "Save Production"}
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/dashboard/production">Cancel</Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
