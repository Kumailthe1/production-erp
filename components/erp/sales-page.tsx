"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import { useErpQuery } from "@/components/erp/use-erp-query";
import { ErpPageHeader, StatCard } from "@/components/erp/ui";
import { ERP_API_BASE, RetailSale } from "@/lib/erp-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BatchLayer = {
  id: number;
  source_batch_id: number;
  packaging_size_id: number | null;
  size_name: string;
  volume_liters: number;
  batch_number: string;
  production_date: string;
  remaining_bottles: number;
  cost_per_bottle: number;
  selling_price_per_bottle: number;
};

export default function SalesPage() {
  const sales = useErpQuery<{ data: RetailSale[] }>("/sales/retail");
  const analytics = useErpQuery<{ summary: Record<string, string | number> }>("/sales/analytics");
  const stock = useErpQuery<{ summary: { bottles_available: number; stock_value: number }; layers: BatchLayer[] }>("/sales/stock");

  const [tab, setTab] = useState<"sales" | "create" | "analysis">("sales");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [form, setForm] = useState({
    sale_number: `SALE-${Date.now()}`,
    sale_date: new Date().toISOString().slice(0, 10),
    customer_name: "",
    initial_payment: "0",
  });
  const [lines, setLines] = useState<
    Array<{
      selected_batch_id: string;
      packaging_size_id: string;
      size_name: string;
      volume_liters: string;
      bottles_sold: string;
      unit_price: string;
    }>
  >([
    {
      selected_batch_id: "",
      packaging_size_id: "",
      size_name: "",
      volume_liters: "",
      bottles_sold: "",
      unit_price: "",
    },
  ]);

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (sales.data?.data ?? []).filter((item) => {
      return (
        query === "" ||
        item.sale_number.toLowerCase().includes(query) ||
        (item.customer_name ?? "").toLowerCase().includes(query) ||
        item.sale_date.toLowerCase().includes(query) ||
        (item.batch_sources ?? "").toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query)
      );
    });
  }, [sales.data, search]);

  const submit = async () => {
    if (!sales.token) return;
    if (lines.every((line) => Number(line.bottles_sold || 0) <= 0)) {
      setMessage("Enter at least one sale line.");
      return;
    }

    try {
      const response = await fetch(`${ERP_API_BASE}/sales/retail`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sales.token}`,
        },
        body: JSON.stringify({
          ...form,
          selected_batch_id: Number(lines.find((line) => Number(line.bottles_sold || 0) > 0)?.selected_batch_id || 0),
          bottles_sold: lines.reduce((sum, line) => sum + Number(line.bottles_sold || 0), 0),
          unit_price: Number(lines.find((line) => Number(line.bottles_sold || 0) > 0)?.unit_price || 0),
          initial_payment: Number(form.initial_payment || 0),
          lines: lines
            .filter((line) => Number(line.bottles_sold || 0) > 0)
            .map((line) => ({
              selected_batch_id: Number(line.selected_batch_id),
              packaging_size_id: line.packaging_size_id !== "" ? Number(line.packaging_size_id) : null,
              size_name: line.size_name,
              volume_liters: Number(line.volume_liters || 0),
              bottles_sold: Number(line.bottles_sold || 0),
              unit_price: Number(line.unit_price || 0),
            })),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Could not create retail sale");
      }
      setForm({
        sale_number: `SALE-${Date.now()}`,
        sale_date: new Date().toISOString().slice(0, 10),
        customer_name: "",
        initial_payment: "0",
      });
      setPaymentTouched(false);
      setLines([
        {
          selected_batch_id: "",
          packaging_size_id: "",
          size_name: "",
          volume_liters: "",
          bottles_sold: "",
          unit_price: "",
        },
      ]);
      setMessage("Retail sale created.");
      await Promise.all([sales.refetch(), analytics.refetch(), stock.refetch()]);
      setTab("sales");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  };

  const totalAmount = lines.reduce((sum, line) => {
    return sum + Number(line.bottles_sold || 0) * Number(line.unit_price || 0);
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
        title="Sales"
        description="Track retail sales by batch source, create a new sell record, and review retail analysis."
      />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as "sales" | "create" | "analysis");
          setMessage(null);
        }}
      >
        <TabsList className="grid w-full max-w-lg grid-cols-3 rounded-xl bg-stone-100">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="create">Create Sell</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>
      </Tabs>

      {message ? <p className="text-sm text-slate-500">{message}</p> : null}

      {tab === "sales" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative xl:w-[28rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sale or batch..."
                className="h-11 rounded-xl border-slate-200 pl-10"
              />
            </div>

            <Button
              className="h-11 rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
              onClick={() => setTab("create")}
            >
              Create Sell
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Sale Number</th>
                  <th className="px-4 py-4 font-semibold">Name</th>
                  <th className="px-4 py-4 font-semibold">Date</th>
                  <th className="px-4 py-4 font-semibold">Batch</th>
                  <th className="px-4 py-4 font-semibold">Bottles</th>
                  <th className="px-4 py-4 font-semibold">Total</th>
                  <th className="px-4 py-4 font-semibold">Paid</th>
                  <th className="px-4 py-4 font-semibold">Outstanding</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                      No retail sales found.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{item.sale_number}</td>
                      <td className="px-4 py-4">{item.customer_name || "-"}</td>
                      <td className="px-4 py-4">{item.sale_date}</td>
                      <td className="px-4 py-4">{item.selected_batch_number || item.batch_sources || "-"}</td>
                      <td className="px-4 py-4">{Number(item.bottles_sold ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">₦ {Number(item.total_amount ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">₦ {Number(item.amount_paid ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">₦ {Number(item.balance_due ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4 capitalize">{item.status}</td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/dashboard/sales/${item.id}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "create" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Create Sell</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter the sale number, date, bottle quantity, unit price, and the amount paid now.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Sale number</Label>
                <Input value={form.sale_number} onChange={(e) => setForm({ ...form, sale_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Sale date</Label>
                <Input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
              </div>
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
                    <tr key={`sale-line-${index}`}>
                      <td className="px-4 py-3">
                        <select
                          value={`${line.selected_batch_id}|${line.packaging_size_id || "null"}|${line.size_name || ""}|${line.volume_liters || ""}`}
                          onChange={(event) => {
                            const [batchId, sizeId, sizeName, volumeLiters] = event.target.value.split("|");
                            const selected = (stock.data?.layers ?? []).find(
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
                          {(stock.data?.layers ?? []).map((layer) => (
                            <option
                              key={`${layer.source_batch_id}-${layer.packaging_size_id ?? "null"}-${layer.size_name}-${layer.volume_liters}-${layer.id}`}
                              value={`${layer.source_batch_id}|${layer.packaging_size_id ?? "null"}|${layer.size_name ?? ""}|${layer.volume_liters ?? ""}`}
                            >
                              {layer.batch_number} | {layer.size_name || "Standard"} | {layer.remaining_bottles} available
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          value={line.bottles_sold}
                          onChange={(event) => {
                            const next = [...lines];
                            next[index].bottles_sold = event.target.value;
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
                    bottles_sold: "",
                    unit_price: "",
                  },
                ])
              }
            >
              Add line
            </Button>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Buyer name (optional)</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="Enter buyer name"
                />
              </div>
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
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total Sale</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">₦ {totalAmount.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Paid</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">₦ {Number(form.initial_payment || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Outstanding</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">₦ {balanceLeft.toLocaleString()}</p>
              </div>
            </div>

            <Button
              className="rounded-xl bg-slate-950 text-white hover:bg-slate-800"
              onClick={submit}
            >
              Save Sell
            </Button>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Available Batch Stock</h2>
              <p className="mt-1 text-sm text-slate-500">
                Sales are allocated from these finished-goods batches, so you can track what batch the sell came from.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Batch</th>
                    <th className="px-4 py-4 font-semibold">Production Date</th>
                    <th className="px-4 py-4 font-semibold">Available Bottles</th>
                    <th className="px-4 py-4 font-semibold">Cost / Bottle</th>
                    <th className="px-4 py-4 font-semibold">Selling Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {(stock.data?.layers ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No finished batch stock available.
                      </td>
                    </tr>
                  ) : (
                    (stock.data?.layers ?? []).map((layer) => (
                      <tr key={`${layer.source_batch_id}-${layer.batch_number}-${layer.packaging_size_id ?? "null"}`}>
                        <td className="px-4 py-4 font-medium text-slate-900">{layer.batch_number}</td>
                        <td className="px-4 py-4">{layer.production_date}</td>
                        <td className="px-4 py-4">
                          {Number(layer.remaining_bottles ?? 0).toLocaleString()} ({layer.size_name || "Standard"})
                        </td>
                        <td className="px-4 py-4">₦ {Number(layer.cost_per_bottle ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-4">₦ {Number(layer.selling_price_per_bottle ?? 0).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "analysis" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard title="Total Sales" value={analytics.data?.summary?.total_sales_count ?? 0} />
            <StatCard title="Total Retail Revenue" value={`₦ ${Number(analytics.data?.summary?.total_sales ?? 0).toLocaleString()}`} />
            <StatCard title="Retail Paid" value={`₦ ${Number(analytics.data?.summary?.total_paid ?? 0).toLocaleString()}`} />
            <StatCard title="Retail Outstanding" value={`₦ ${Number(analytics.data?.summary?.total_outstanding ?? 0).toLocaleString()}`} />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Batch</th>
                  <th className="px-4 py-4 font-semibold">Production Date</th>
                  <th className="px-4 py-4 font-semibold">Available Bottles</th>
                  <th className="px-4 py-4 font-semibold">Cost / Bottle</th>
                  <th className="px-4 py-4 font-semibold">Selling Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {(stock.data?.layers ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No batch stock available for analysis.
                    </td>
                  </tr>
                ) : (
                  (stock.data?.layers ?? []).map((layer) => (
                    <tr key={`${layer.source_batch_id}-${layer.batch_number}-${layer.packaging_size_id ?? "null"}-analysis`}>
                      <td className="px-4 py-4 font-medium text-slate-900">{layer.batch_number}</td>
                      <td className="px-4 py-4">{layer.production_date}</td>
                      <td className="px-4 py-4">
                        {Number(layer.remaining_bottles ?? 0).toLocaleString()} ({layer.size_name || "Standard"})
                      </td>
                      <td className="px-4 py-4">₦ {Number(layer.cost_per_bottle ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">₦ {Number(layer.selling_price_per_bottle ?? 0).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
