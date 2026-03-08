"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { useErpQuery } from "@/components/erp/use-erp-query";
import { ErpPageHeader } from "@/components/erp/ui";
import { ERP_API_BASE, ProductionBatch } from "@/lib/erp-api";
import { selectUser } from "@/lib/userSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ROWS_PER_PAGE = 10;

export default function ProductionListPage() {
  const router = useRouter();
  const user = useSelector(selectUser);
  const isAdmin = user?.role === "admin";
  const batches = useErpQuery<{ data: ProductionBatch[] }>("/production/batches");
  const leftovers = useErpQuery<{ data: Array<Record<string, string | number>> }>("/production/leftovers");
  const [view, setView] = useState<"production" | "ledger">("production");
  const [search, setSearch] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [parameterFilter, setParameterFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (batches.data?.data ?? []).filter((item) => {
      const matchesSearch =
        query === "" ||
        item.batch_number.toLowerCase().includes(query) ||
        item.production_date.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [batches.data, search, statusFilter]);

  const parameterOptions = useMemo(() => {
    return Array.from(
      new Set(
        (leftovers.data?.data ?? [])
          .map((item) => String(item.parameter_name ?? "").trim())
          .filter((value) => value !== "")
      )
    );
  }, [leftovers.data]);

  const filteredLedgerRows = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase();

    return (leftovers.data?.data ?? []).filter((item) => {
      const parameterName = String(item.parameter_name ?? "");
      const batchRef = String(item.source_batch_id ?? "");
      const matchesSearch =
        query === "" ||
        parameterName.toLowerCase().includes(query) ||
        batchRef.toLowerCase().includes(query);
      const matchesParameter =
        parameterFilter === "all" || parameterName === parameterFilter;

      return matchesSearch && matchesParameter;
    });
  }, [ledgerSearch, leftovers.data, parameterFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );
  const ledgerTotalPages = Math.max(1, Math.ceil(filteredLedgerRows.length / ROWS_PER_PAGE));
  const currentLedgerPage = Math.min(ledgerPage, ledgerTotalPages);
  const paginatedLedgerRows = filteredLedgerRows.slice(
    (currentLedgerPage - 1) * ROWS_PER_PAGE,
    currentLedgerPage * ROWS_PER_PAGE
  );

  const handleDelete = async (batchId: number) => {
    if (!batches.token) return;

    try {
      const response = await fetch(`${ERP_API_BASE}/production/batches/${batchId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${batches.token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Could not delete production batch");
      }
      setMessage("Production batch deleted.");
      await Promise.all([batches.refetch(), leftovers.refetch()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title="Production"
        description="Switch between production batches and the active ledger without mixing the two templates."
      />

      <Tabs
        value={view}
        onValueChange={(value) => {
          setView(value as "production" | "ledger");
          setMessage(null);
        }}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl bg-stone-100">
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="ledger">Active Ledger</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        {view === "production" ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid gap-3 md:grid-cols-2 xl:w-[28rem]">
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
                >
                  <option value="all">All status</option>
                  <option value="completed">Completed</option>
                  <option value="draft">Draft</option>
                </select>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search batch..."
                    className="h-11 rounded-xl border-slate-200 pl-10"
                  />
                </div>
              </div>

              <Button
                className="h-11 rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
                onClick={() => router.push("/dashboard/production/new")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Production
              </Button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Batch ID</th>
                    <th className="px-4 py-4 font-semibold">Date</th>
                    <th className="px-4 py-4 font-semibold">Bottles</th>
                    <th className="px-4 py-4 font-semibold">Cost / Liter</th>
                    <th className="px-4 py-4 font-semibold">Total Cost</th>
                    <th className="px-4 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        No production batches found.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-4 font-medium text-slate-900">{item.batch_number}</td>
                        <td className="px-4 py-4">{item.production_date}</td>
                        <td className="px-4 py-4">{item.bottles_produced}</td>
                        <td className="px-4 py-4">
                          ₦{" "}
                          {(Number(item.batch_size_liters ?? 0) > 0
                            ? Number(item.total_cost ?? 0) / Number(item.batch_size_liters ?? 1)
                            : 0
                          ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-4">₦ {Number(item.total_cost ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                          <Link
                              href={`/dashboard/production/${item.id}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            {isAdmin ? (
                              <>
                                <Link
                                  href={`/dashboard/production/${item.id}/edit`}
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
                              </>
                            ) : null}
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
                {Math.min(currentPage * ROWS_PER_PAGE, filteredRows.length)} of {filteredRows.length} batches
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
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid gap-3 md:grid-cols-2 xl:w-[28rem]">
                <select
                  value={parameterFilter}
                  onChange={(event) => {
                    setParameterFilter(event.target.value);
                    setLedgerPage(1);
                  }}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
                >
                  <option value="all">All parameters</option>
                  {parameterOptions.map((parameter) => (
                    <option key={parameter} value={parameter}>
                      {parameter}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={ledgerSearch}
                    onChange={(event) => {
                      setLedgerSearch(event.target.value);
                      setLedgerPage(1);
                    }}
                    placeholder="Search active ledger..."
                    className="h-11 rounded-xl border-slate-200 pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Parameter</th>
                    <th className="px-4 py-4 font-semibold">Source Batch</th>
                    <th className="px-4 py-4 font-semibold">Quantity Left</th>
                    <th className="px-4 py-4 font-semibold">Unit Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {paginatedLedgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                        No active ledger records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedLedgerRows.map((item, index) => (
                      <tr key={`${item.parameter_name}-${item.source_batch_id}-${index}`}>
                        <td className="px-4 py-4 font-medium text-slate-900">{String(item.parameter_name ?? "-")}</td>
                        <td className="px-4 py-4">{String(item.source_batch_id ?? "-")}</td>
                        <td className="px-4 py-4">{String(item.remaining_quantity ?? "-")}</td>
                        <td className="px-4 py-4">₦ {Number(item.unit_cost ?? 0).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
              <div>
                Showing {filteredLedgerRows.length === 0 ? 0 : (currentLedgerPage - 1) * ROWS_PER_PAGE + 1} -{" "}
                {Math.min(currentLedgerPage * ROWS_PER_PAGE, filteredLedgerRows.length)} of {filteredLedgerRows.length} ledger records
              </div>

              <div className="flex items-center gap-2">
                <span>Rows:</span>
                <div className="rounded-xl border border-slate-200 px-4 py-2">10</div>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={currentLedgerPage === 1}
                  onClick={() => setLedgerPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={currentLedgerPage >= ledgerTotalPages}
                  onClick={() => setLedgerPage((value) => Math.min(ledgerTotalPages, value + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {message ? <p className="text-sm text-slate-500">{message}</p> : null}
      </div>
    </div>
  );
}
