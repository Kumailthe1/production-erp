"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useErpQuery } from "@/components/erp/use-erp-query";
import { ErpPageHeader, SectionCard } from "@/components/erp/ui";
import { ERP_API_BASE, ProductionParameter } from "@/lib/erp-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

type SupplyLine = {
  parameter_id: string;
  quantity_received: string;
  unit_cost: string;
};

type SupplyCreatePageProps = {
  receiptId?: string;
};

type SupplyReceiptDetails = {
  data: {
    id: number;
    receipt_number: string;
    supply_date: string;
    supplier_name?: string | null;
    status?: string;
  };
  items: Array<{
    parameter_id: number;
    quantity_received: number;
    unit_cost: number;
  }>;
};

const parameterOptionLabel = (parameter: ProductionParameter): string => {
  const quantity = Number(parameter.default_quantity ?? 0);
  const unit = (parameter.quantity_unit || "").trim();
  if (quantity > 0 && unit !== "") {
    return `${quantity} ${unit} ${parameter.name}`;
  }
  if (unit !== "") {
    return `${parameter.name} (${unit})`;
  }
  return parameter.name;
};

export default function SupplyCreatePage({ receiptId }: SupplyCreatePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const isEditMode = Boolean(receiptId);
  const settings = useErpQuery<{ data: ProductionParameter[] }>("/production/settings");
  const [supplierName, setSupplierName] = useState("");
  const [receiptNumber, setReceiptNumber] = useState(`SUP-${Date.now()}`);
  const [supplyDate, setSupplyDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<SupplyLine[]>([
    { parameter_id: "", quantity_received: "", unit_cost: "" },
  ]);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const inputParameters = useMemo(
    () => (settings.data?.data ?? []).filter((item) => item.parameter_kind !== "output"),
    [settings.data]
  );

  useEffect(() => {
    if (!duplicateId || isEditMode) return;
    setReceiptNumber(`SUP-${Date.now()}`);
  }, [duplicateId, isEditMode]);

  useEffect(() => {
    if (!receiptId || !settings.token) return;

    let active = true;
    setLoadingExisting(true);
    setMessage(null);

    fetch(`${ERP_API_BASE}/supply/receipts/${receiptId}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${settings.token}`,
      },
    })
      .then(async (response) => {
        const result = (await response.json()) as SupplyReceiptDetails & { message?: string };
        if (!response.ok) {
          throw new Error(result.message ?? "Could not load supply receipt");
        }
        return result;
      })
      .then((result) => {
        if (!active) return;
        setReceiptNumber(result.data.receipt_number);
        setSupplyDate(result.data.supply_date);
        setSupplierName(result.data.supplier_name || "");
        setItems(
          result.items.length > 0
            ? result.items.map((item) => ({
                parameter_id: String(item.parameter_id),
                quantity_received: String(item.quantity_received),
                unit_cost: String(item.unit_cost),
              }))
            : [{ parameter_id: "", quantity_received: "", unit_cost: "" }]
        );
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Could not load supply receipt");
      })
      .finally(() => {
        if (active) {
          setLoadingExisting(false);
        }
      });

    return () => {
      active = false;
    };
  }, [receiptId, settings.token]);

  const submit = async () => {
    if (!settings.token) return;
    setSubmitting(true);
    setMessage(null);

    const payload = {
      receipt_number: receiptNumber,
      supply_date: supplyDate,
      supplier_name: supplierName,
      items: items
        .filter((item) => item.parameter_id && item.quantity_received)
        .map((item) => ({
          parameter_id: Number(item.parameter_id),
          quantity_received: Number(item.quantity_received),
          unit_cost: Number(item.unit_cost || 0),
        })),
    };

    try {
      const response = await fetch(
        isEditMode ? `${ERP_API_BASE}/supply/receipts/${receiptId}` : `${ERP_API_BASE}/supply/receipts`,
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
        throw new Error(result.message ?? `Could not ${isEditMode ? "update" : "create"} supply receipt`);
      }
      router.push("/dashboard/supply");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title={isEditMode ? "Edit Production Supply" : "Add Production Supply"}
        description={
          isEditMode
            ? "Update the current supply receipt, its supplier details, and all material lines."
            : "Create a new supply receipt for production materials and return to the supply list when done."
        }
        action={
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/dashboard/supply">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Supply
            </Link>
          </Button>
        }
      />

      <SectionCard
        title={isEditMode ? "Edit Supply Receipt" : "Supply Receipt Details"}
        description="Capture supplier, date, material lines, and cost values."
      >
        {loadingExisting ? <p className="mb-4 text-sm text-slate-500">Loading supply details...</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Receipt number</Label>
            <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Supply date</Label>
            <Input type="date" value={supplyDate} onChange={(e) => setSupplyDate(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Supplier name</Label>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {items.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-3">
              <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
                value={item.parameter_id}
                onChange={(e) => {
                  const next = [...items];
                  next[index].parameter_id = e.target.value;
                  setItems(next);
                }}
              >
                <option value="">Select parameter</option>
                {inputParameters.map((parameter) => (
                  <option key={parameter.id} value={parameter.id}>
                    {parameterOptionLabel(parameter)}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                placeholder="Quantity received"
                value={item.quantity_received}
                onChange={(e) => {
                  const next = [...items];
                  next[index].quantity_received = e.target.value;
                  setItems(next);
                }}
                className="h-11 rounded-xl"
              />
              <Input
                type="number"
                placeholder="Unit cost"
                value={item.unit_cost}
                onChange={(e) => {
                  const next = [...items];
                  next[index].unit_cost = e.target.value;
                  setItems(next);
                }}
                className="h-11 rounded-xl"
              />
            </div>
          ))}

          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() =>
              setItems([...items, { parameter_id: "", quantity_received: "", unit_cost: "" }])
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add line
          </Button>
        </div>

        {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            className="rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
            onClick={submit}
            disabled={submitting || !settings.token || loadingExisting}
          >
            {submitting ? "Saving..." : isEditMode ? "Update Supply" : "Save Supply"}
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/dashboard/supply">Cancel</Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
