"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useErpQuery } from "@/components/erp/use-erp-query";
import { ErpPageHeader } from "@/components/erp/ui";
import { ERP_API_BASE, SupplyReceipt } from "@/lib/erp-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";

const ROWS_PER_PAGE = 10;

type SupplyStockBalance = {
  parameter_id: number | string;
  parameter_name?: string;
  quantity_unit?: string;
  total_quantity_supplied?: number | string;
  total_quantity_consumed?: number | string;
  quantity_in_stock?: number | string;
  default_quantity?: number | string;
};

type SupplyStockRow = {
  parameter_id: number | string;
  parameter_name: string;
  quantity_unit: string;
  supplied: number;
  consumed: number;
  inStock: number;
  defaultQuantity: number;
  stockPercent: number;
  thresholdPercent: number;
};

export default function SupplyListPage() {
  const router = useRouter();
  const receipts = useErpQuery<{ data: SupplyReceipt[] }>("/supply/receipts");
  const stock = useErpQuery<{ data: SupplyStockBalance[] }>("/supply/stock-balances");
  const [view, setView] = useState<"stock" | "supply">("stock");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const supplierOptions = useMemo(() => {
    return Array.from(
      new Set(
        (receipts.data?.data ?? [])
          .map((item) => item.supplier_name?.trim())
          .filter((value): value is string => Boolean(value))
      )
    );
  }, [receipts.data]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (receipts.data?.data ?? []).filter((item) => {
      const matchesSearch =
        query === "" ||
        item.receipt_number.toLowerCase().includes(query) ||
        (item.supplier_name || "").toLowerCase().includes(query) ||
        item.supply_date.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSupplier =
        supplierFilter === "all" || (item.supplier_name || "") === supplierFilter;

      return matchesSearch && matchesStatus && matchesSupplier;
    });
  }, [receipts.data, search, statusFilter, supplierFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  const stockRows = useMemo<SupplyStockRow[]>(() => {
    return (stock.data?.data ?? []).map((item) => {
      const supplied = Number(item.total_quantity_supplied ?? 0);
      const consumed = Number(item.total_quantity_consumed ?? 0);
      const inStock = Number(item.quantity_in_stock ?? 0);
      const defaultQuantity = Number(item.default_quantity ?? 0);
      const stockPercent = supplied > 0 ? Math.min(100, (inStock / supplied) * 100) : 0;
      const thresholdPercent =
        defaultQuantity > 0 ? Math.min(100, (inStock / defaultQuantity) * 100) : 0;

      return {
        parameter_id: item.parameter_id,
        parameter_name: String(item.parameter_name ?? "-"),
        quantity_unit: String(item.quantity_unit ?? "-"),
        supplied,
        consumed,
        inStock,
        defaultQuantity,
        stockPercent,
        thresholdPercent,
      };
    });
  }, [stock.data]);

  const handleDelete = async (receiptId: number) => {
    if (!receipts.token) return;

    try {
      const response = await fetch(`${ERP_API_BASE}/supply/receipts/${receiptId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${receipts.token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Could not delete supply receipt");
      }
      setMessage("Supply receipt deleted.");
      await Promise.all([receipts.refetch(), stock.refetch()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title="Production Supply"
        description="Track what has been supplied into store, what production has consumed, and the live level remaining in stock."
      />

      <Tabs
        value={view}
        onValueChange={(value) => {
          setView(value as "stock" | "supply");
          setMessage(null);
        }}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl bg-stone-100">
          <TabsTrigger value="stock">Stoke</TabsTrigger>
          <TabsTrigger value="supply">Supply</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        {view === "stock" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Parameter</th>
                    <th className="px-4 py-4 font-semibold">Supplied</th>
                    <th className="px-4 py-4 font-semibold">Used</th>
                    <th className="px-4 py-4 font-semibold">Available</th>
                    <th className="px-4 py-4 font-semibold">Stock Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {stockRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No stock records yet.
                      </td>
                    </tr>
                  ) : (
                    stockRows.map((item) => (
                      <tr key={String(item.parameter_id)}>
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-900">{String(item.parameter_name ?? "-")}</div>
                          <div className="text-xs text-slate-500">{String(item.quantity_unit ?? "-")}</div>
                        </td>
                        <td className="px-4 py-4">{item.supplied.toLocaleString()}</td>
                        <td className="px-4 py-4">{item.consumed.toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-900">{item.inStock.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">
                            Base target: {item.defaultQuantity.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-2">
                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${item.stockPercent}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{item.stockPercent.toFixed(0)}% of supplied stock left</span>
                              <span>{item.thresholdPercent.toFixed(0)}% vs base need</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid gap-3 md:grid-cols-2 xl:w-[40rem]">
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
                >
                  <option value="all">All status</option>
                  <option value="received">Received</option>
                  <option value="draft">Draft</option>
                </select>

                <select
                  value={supplierFilter}
                  onChange={(event) => {
                    setSupplierFilter(event.target.value);
                    setPage(1);
                  }}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
                >
                  <option value="all">All suppliers</option>
                  {supplierOptions.map((supplier) => (
                    <option key={supplier} value={supplier}>
                      {supplier}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative min-w-[18rem]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search supply..."
                    className="h-11 rounded-xl border-slate-200 pl-10"
                  />
                </div>
                <Button
                  className="h-11 rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
                  onClick={() => router.push("/dashboard/supply/new")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Supply
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Receipt ID</th>
                    <th className="px-4 py-4 font-semibold">Supplier</th>
                    <th className="px-4 py-4 font-semibold">Supply Date</th>
                    <th className="px-4 py-4 font-semibold">Status</th>
                    <th className="px-4 py-4 font-semibold">Total Cost</th>
                    <th className="px-4 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        No supply receipts found.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-4 font-medium text-slate-900">{item.receipt_number}</td>
                        <td className="px-4 py-4">{item.supplier_name || "-"}</td>
                        <td className="px-4 py-4">{item.supply_date}</td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium capitalize text-emerald-700">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">₦ {Number(item.total_cost ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/supply/${item.id}/edit`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-500 text-white transition hover:bg-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
              <div>
                Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * ROWS_PER_PAGE + 1} -{" "}
                {Math.min(currentPage * ROWS_PER_PAGE, filteredRows.length)} of {filteredRows.length} receipts
              </div>

              <div className="flex items-center gap-2">
                <span>Rows:</span>
                <div className="rounded-xl border border-slate-200 px-4 py-2">10</div>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}

        {message ? <p className="text-sm text-slate-500">{message}</p> : null}
      </div>
    </div>
  );
}
