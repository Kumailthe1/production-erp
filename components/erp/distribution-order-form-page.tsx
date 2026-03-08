"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { ErpPageHeader } from "@/components/erp/ui";
import { Distributor, ERP_API_BASE } from "@/lib/erp-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectToken } from "@/lib/userSlice";

type DistributionOrderFormPageProps = {
  orderId?: string;
};

export default function DistributionOrderFormPage({ orderId }: DistributionOrderFormPageProps) {
  const token = useSelector(selectToken);
  const router = useRouter();
  const isEditMode = Boolean(orderId);
  const [batches, setBatches] = useState<Array<{
    id: number;
    source_batch_id: number;
    batch_number: string;
    packaging_size_id: number | null;
    size_name: string;
    volume_liters: number;
    production_date: string;
    remaining_bottles: number;
    cost_per_bottle: number;
    selling_price_per_bottle: number;
  }>>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [form, setForm] = useState({
    selected_batch_id: "",
    order_number: `DIST-${Date.now()}`,
    distributor_id: "",
    order_date: new Date().toISOString().slice(0, 10),
    bottles_issued: "",
    unit_price: "",
    initial_payment: "0",
    status: "confirmed",
  });
  const [lines, setLines] = useState<
    Array<{
      selected_batch_id: string;
      packaging_size_id: string;
      size_name: string;
      volume_liters: string;
      bottles_issued: string;
      unit_price: string;
    }>
  >([
    {
      selected_batch_id: "",
      packaging_size_id: "",
      size_name: "",
      volume_liters: "",
      bottles_issued: "",
      unit_price: "",
    },
  ]);

  useEffect(() => {
    if (!token) return;
    fetch(`${ERP_API_BASE}/distributors`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message ?? "Could not load distributors");
        }
        return result;
      })
      .then((result) => setDistributors(result.data ?? []))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Request failed"));

    fetch(`${ERP_API_BASE}/sales/stock`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message ?? "Could not load batch stock");
        }
        return result;
      })
      .then((result) => setBatches(result.layers ?? []))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Request failed"));
  }, [token]);

  useEffect(() => {
    if (!orderId || !token) return;

    let active = true;
    setLoading(true);
    fetch(`${ERP_API_BASE}/distribution/orders/${orderId}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message ?? "Could not load distribution record");
        }
        return result;
      })
      .then((result) => {
        if (!active) return;
        setForm({
          selected_batch_id: String(result.data.selected_batch_id ?? ""),
          order_number: result.data.order_number ?? "",
          distributor_id: String(result.data.distributor_id ?? ""),
          order_date: result.data.order_date ?? new Date().toISOString().slice(0, 10),
          bottles_issued: String(result.data.bottles_issued ?? ""),
          unit_price: String(result.data.unit_price ?? ""),
          initial_payment: String(result.data.amount_paid ?? 0),
          status: result.data.status ?? "confirmed",
        });
        setPaymentTouched(true);
        if (Array.isArray(result.lines) && result.lines.length > 0) {
          setLines(
            result.lines.map((line: Record<string, unknown>) => ({
              selected_batch_id: String(line.selected_batch_id ?? ""),
              packaging_size_id:
                line.packaging_size_id === null || line.packaging_size_id === undefined
                  ? ""
                  : String(line.packaging_size_id),
              size_name: String(line.size_name ?? ""),
              volume_liters: String(line.volume_liters ?? ""),
              bottles_issued: String(line.bottles_issued ?? ""),
              unit_price: String(line.unit_price ?? ""),
            }))
          );
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Request failed");
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
  }, [orderId, token]);

  const submit = async () => {
    if (!token) return;

    if (!form.distributor_id) {
      setMessage("Select a distributor before saving the distribution.");
      return;
    }
    if (lines.every((line) => Number(line.bottles_issued || 0) <= 0)) {
      setMessage("Enter at least one line with bottles issued.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(
        isEditMode ? `${ERP_API_BASE}/distribution/orders/${orderId}` : `${ERP_API_BASE}/distribution/orders`,
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...form,
            selected_batch_id: Number(form.selected_batch_id),
            distributor_id: Number(form.distributor_id),
            bottles_issued: Number(form.bottles_issued),
            unit_price: Number(form.unit_price || 0),
            initial_payment: Number(form.initial_payment || 0),
            lines: lines
              .filter((line) => Number(line.bottles_issued || 0) > 0)
              .map((line) => ({
                selected_batch_id: Number(line.selected_batch_id),
                packaging_size_id: line.packaging_size_id !== "" ? Number(line.packaging_size_id) : null,
                size_name: line.size_name,
                volume_liters: Number(line.volume_liters || 0),
                bottles_issued: Number(line.bottles_issued || 0),
                unit_price: Number(line.unit_price || 0),
              })),
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? `Could not ${isEditMode ? "update" : "create"} distribution record`);
      }
      router.push(isEditMode ? `/dashboard/distribution/orders/${orderId}` : "/dashboard/distribution");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = lines.reduce((sum, line) => {
    return sum + Number(line.bottles_issued || 0) * Number(line.unit_price || 0);
  }, 0);

  useEffect(() => {
    if (paymentTouched) {
      return;
    }
    setForm((current) => ({ ...current, initial_payment: String(totalAmount) }));
  }, [paymentTouched, totalAmount]);

  const balanceLeft = Math.max(totalAmount - Number(form.initial_payment || 0), 0);

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title={isEditMode ? "Edit Distribution" : "Add Distribution"}
        description="Record what the distributor took, what was paid now, and what will remain as balance."
        action={
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/dashboard/distribution">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Distribution
            </Link>
          </Button>
        }
      />

      <div className="grid xl:grid-cols-[minmax(0,0.7fr)_minmax(0,0.3fr)] xl:gap-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          {loading ? <p className="mb-4 text-sm text-slate-500">Loading distribution record...</p> : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Batch</Label>
              <select
                value={form.selected_batch_id}
                onChange={(e) => setForm((current) => ({ ...current, selected_batch_id: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm"
              >
                <option value="">Auto from lines</option>
                {Array.from(new Map(batches.map((item) => [item.source_batch_id, item])).values()).map((item) => (
                  <option key={item.source_batch_id} value={item.source_batch_id}>
                    {item.batch_number}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Order number</Label>
              <Input value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Distributor</Label>
              <select
                value={form.distributor_id}
                onChange={(e) => setForm({ ...form, distributor_id: e.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm"
              >
                <option value="">Select distributor</option>
                {distributors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Batch + Size</th>
                    <th className="px-4 py-3 font-semibold">Bottles</th>
                    <th className="px-4 py-3 font-semibold">Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {lines.map((line, index) => (
                    <tr key={`line-${index}`}>
                      <td className="px-4 py-3">
                        <select
                          value={`${line.selected_batch_id}|${line.packaging_size_id || "null"}|${line.size_name || ""}|${line.volume_liters || ""}`}
                          onChange={(event) => {
                            const [batchId, sizeId, sizeName, volumeLiters] = event.target.value.split("|");
                            const selected = batches.find(
                              (item) =>
                                String(item.source_batch_id) === batchId &&
                                String(item.packaging_size_id ?? "null") === sizeId &&
                                String(item.size_name ?? "") === sizeName &&
                                String(item.volume_liters ?? "") === volumeLiters
                            );
                            const next = [...lines];
                            next[index] = {
                              ...next[index],
                              selected_batch_id: batchId,
                              packaging_size_id: sizeId === "null" ? "" : sizeId,
                              size_name: selected?.size_name ?? sizeName ?? "Standard Bottle",
                              volume_liters: String(selected?.volume_liters ?? volumeLiters ?? 0),
                              unit_price: String(selected?.selling_price_per_bottle ?? 0),
                            };
                            setLines(next);
                          }}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        >
                          <option value=":null">Select batch + size</option>
                          {batches.map((item) => (
                            <option
                              key={`${item.source_batch_id}-${item.packaging_size_id ?? "null"}-${item.size_name}-${item.volume_liters}-${item.id}`}
                              value={`${item.source_batch_id}|${item.packaging_size_id ?? "null"}|${item.size_name ?? ""}|${item.volume_liters ?? ""}`}
                            >
                              {item.batch_number} | {item.size_name || "Standard"} | {item.remaining_bottles} available
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          value={line.bottles_issued}
                          onChange={(event) => {
                            const next = [...lines];
                            next[index].bottles_issued = event.target.value;
                            setLines(next);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          value={line.unit_price}
                          onChange={(event) => {
                            const next = [...lines];
                            next[index].unit_price = event.target.value;
                            setLines(next);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    selected_batch_id: "",
                    packaging_size_id: "",
                    size_name: "",
                    volume_liters: "",
                    bottles_issued: "",
                    unit_price: "",
                  },
                ])
              }
            >
              Add line
            </Button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Amount paid now</Label>
              <Input
                type="number"
                value={form.initial_payment}
                onChange={(e) => {
                  setPaymentTouched(true);
                  setForm({ ...form, initial_payment: e.target.value });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm"
              >
                <option value="confirmed">Confirmed</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Total Amount</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">₦ {totalAmount.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Paid</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">₦ {Number(form.initial_payment || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Left</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">₦ {balanceLeft.toLocaleString()}</p>
            </div>
          </div>

          {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
          <Button
            className="rounded-xl bg-slate-950 text-white hover:bg-slate-800"
            onClick={submit}
            disabled={submitting || loading || !token || !form.distributor_id}
          >
            {submitting ? "Saving..." : isEditMode ? "Update Distribution" : "Save Distribution"}
          </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/dashboard/distribution">Cancel</Link>
            </Button>
          </div>
        </section>
        <div className="hidden xl:block" />
      </div>
    </div>
  );
}
