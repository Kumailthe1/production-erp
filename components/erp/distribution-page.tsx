"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useErpQuery } from "@/components/erp/use-erp-query";
import { ErpPageHeader, StatCard } from "@/components/erp/ui";
import { Distributor, DistributionOrder, ERP_API_BASE } from "@/lib/erp-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSelector } from "react-redux";
import { selectUser } from "@/lib/userSlice";

const ROWS_PER_PAGE = 10;

export default function DistributionPage() {
  const user = useSelector(selectUser);
  const isAdmin = user?.role === "admin";
  const distributors = useErpQuery<{ data: Distributor[] }>("/distributors");
  const orders = useErpQuery<{ data: DistributionOrder[] }>("/distribution/orders");
  const analytics = useErpQuery<{
    summary: Record<string, string | number>;
    top_distributors: Array<Record<string, string | number>>;
  }>("/distribution/analytics");
  const stock = useErpQuery<{ summary: { bottles_available: number } }>("/sales/stock");

  const [tab, setTab] = useState<"orders" | "distributors" | "analysis">("orders");
  const [orderSearch, setOrderSearch] = useState("");
  const [distributorSearch, setDistributorSearch] = useState("");
  const [orderDistributorFilter, setOrderDistributorFilter] = useState("all");
  const [orderPage, setOrderPage] = useState(1);
  const [distributorPage, setDistributorPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin && tab === "distributors") {
      setTab("orders");
    }
  }, [isAdmin, tab]);

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return (orders.data?.data ?? []).filter((item) => {
      return (
        (query === "" ||
          item.order_number.toLowerCase().includes(query) ||
          (item.distributor_name ?? "").toLowerCase().includes(query) ||
          item.order_date.toLowerCase().includes(query) ||
          item.status.toLowerCase().includes(query)) &&
        (orderDistributorFilter === "all" || String(item.distributor_id) === orderDistributorFilter)
      );
    });
  }, [orderDistributorFilter, orderSearch, orders.data]);

  const filteredDistributors = useMemo(() => {
    const query = distributorSearch.trim().toLowerCase();
    return (distributors.data?.data ?? []).filter((item) => {
      return (
        query === "" ||
        item.name.toLowerCase().includes(query) ||
        (item.phone ?? "").toLowerCase().includes(query) ||
        (item.email ?? "").toLowerCase().includes(query) ||
        (item.address ?? "").toLowerCase().includes(query)
      );
    });
  }, [distributorSearch, distributors.data]);

  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ROWS_PER_PAGE));
  const currentOrderPage = Math.min(orderPage, totalOrderPages);
  const paginatedOrders = filteredOrders.slice((currentOrderPage - 1) * ROWS_PER_PAGE, currentOrderPage * ROWS_PER_PAGE);

  const totalDistributorPages = Math.max(1, Math.ceil(filteredDistributors.length / ROWS_PER_PAGE));
  const currentDistributorPage = Math.min(distributorPage, totalDistributorPages);
  const paginatedDistributors = filteredDistributors.slice(
    (currentDistributorPage - 1) * ROWS_PER_PAGE,
    currentDistributorPage * ROWS_PER_PAGE
  );

  const deleteDistributor = async (id: number) => {
    if (!distributors.token) return;
    try {
      const response = await fetch(`${ERP_API_BASE}/distributors/${id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${distributors.token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Could not delete distributor");
      }
      setMessage("Distributor deleted.");
      await Promise.all([distributors.refetch(), analytics.refetch()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const deleteOrder = async (id: number) => {
    if (!orders.token) return;
    try {
      const response = await fetch(`${ERP_API_BASE}/distribution/orders/${id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${orders.token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Could not delete order");
      }
      setMessage("Distribution record deleted.");
      await Promise.all([orders.refetch(), analytics.refetch(), stock.refetch()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const distributorSnapshots = useMemo(() => {
    const orderRows = orders.data?.data ?? [];
    return (distributors.data?.data ?? []).map((distributor) => {
      const matching = orderRows.filter((order) => Number(order.distributor_id) === distributor.id);
      const bottles = matching.reduce((sum, order) => sum + Number(order.bottles_issued ?? 0), 0);
      const paid = matching.reduce((sum, order) => sum + Number(order.amount_paid ?? 0), 0);
      const balance = matching.reduce((sum, order) => sum + Number(order.balance_due ?? 0), 0);

      return {
        ...distributor,
        orders_count: matching.length,
        bottles_issued: bottles,
        amount_paid: paid,
        balance_due: balance,
      };
    });
  }, [distributors.data, orders.data]);

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title="Distribution"
        description="Track what each distributor took, how much they paid, what is left, and manage each record cleanly."
      />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as "orders" | "distributors" | "analysis");
          setMessage(null);
        }}
      >
        <TabsList className={`grid w-full max-w-lg rounded-xl bg-stone-100 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
          <TabsTrigger value="orders">Distribution</TabsTrigger>
          {isAdmin ? <TabsTrigger value="distributors">Distributors</TabsTrigger> : null}
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>
      </Tabs>

      {message ? <p className="text-sm text-slate-500">{message}</p> : null}

      {tab === "orders" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid gap-3 xl:w-[34rem] xl:grid-cols-[14rem_1fr]">
              <select
                value={orderDistributorFilter}
                onChange={(event) => {
                  setOrderDistributorFilter(event.target.value);
                  setOrderPage(1);
                }}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
              >
                <option value="all">All distributors</option>
                {(distributors.data?.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={orderSearch}
                  onChange={(event) => {
                    setOrderSearch(event.target.value);
                    setOrderPage(1);
                  }}
                  placeholder="Search distribution record..."
                  className="h-11 rounded-xl border-slate-200 pl-10"
                />
              </div>
            </div>

            <Button asChild className="h-11 rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800">
              <Link href="/dashboard/distribution/orders/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Distribution
              </Link>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Order</th>
                  <th className="px-4 py-4 font-semibold">Distributor</th>
                  <th className="px-4 py-4 font-semibold">Date</th>
                  <th className="px-4 py-4 font-semibold">Bottles</th>
                  <th className="px-4 py-4 font-semibold">Total</th>
                  <th className="px-4 py-4 font-semibold">Paid</th>
                  <th className="px-4 py-4 font-semibold">Left</th>
                  <th className="px-4 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      No distribution records found.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{item.order_number}</td>
                      <td className="px-4 py-4">{item.distributor_name || "-"}</td>
                      <td className="px-4 py-4">{item.order_date}</td>
                      <td className="px-4 py-4">{Number(item.bottles_issued ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">₦ {Number(item.total_amount ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">₦ {Number(item.amount_paid ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">₦ {Number(item.balance_due ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/distribution/orders/${item.id}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {isAdmin ? (
                            <>
                              <Link
                                href={`/dashboard/distribution/orders/${item.id}/edit`}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => deleteOrder(item.id)}
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
              Showing {filteredOrders.length === 0 ? 0 : (currentOrderPage - 1) * ROWS_PER_PAGE + 1} -{" "}
              {Math.min(currentOrderPage * ROWS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} records
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-xl" disabled={currentOrderPage === 1} onClick={() => setOrderPage((value) => Math.max(1, value - 1))}>
                Previous
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={currentOrderPage >= totalOrderPages}
                onClick={() => setOrderPage((value) => Math.min(totalOrderPages, value + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "distributors" && isAdmin ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative xl:w-[26rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={distributorSearch}
                onChange={(event) => {
                  setDistributorSearch(event.target.value);
                  setDistributorPage(1);
                }}
                placeholder="Search distributor..."
                className="h-11 rounded-xl border-slate-200 pl-10"
              />
            </div>

            <Button asChild className="h-11 rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800">
              <Link href="/dashboard/distribution/distributors/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Distributor
              </Link>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Distributor</th>
                  <th className="px-4 py-4 font-semibold">Phone</th>
                  <th className="px-4 py-4 font-semibold">Address</th>
                  <th className="px-4 py-4 font-semibold">Records</th>
                  <th className="px-4 py-4 font-semibold">Bottles</th>
                  <th className="px-4 py-4 font-semibold">Paid</th>
                  <th className="px-4 py-4 font-semibold">Left</th>
                  <th className="px-4 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedDistributors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      No distributors found.
                    </td>
                  </tr>
                ) : (
                  paginatedDistributors.map((item) => {
                    const snapshot = distributorSnapshots.find((entry) => entry.id === item.id);
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-4 font-medium text-slate-900">{item.name}</td>
                        <td className="px-4 py-4">{item.phone || "-"}</td>
                        <td className="px-4 py-4">{item.address || "-"}</td>
                        <td className="px-4 py-4">{Number(snapshot?.orders_count ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-4">{Number(snapshot?.bottles_issued ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-4">₦ {Number(snapshot?.amount_paid ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-4">₦ {Number(snapshot?.balance_due ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/distribution/distributors/${item.id}/edit`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => deleteDistributor(item.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-500 text-white transition hover:bg-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
            <div>
              Showing {filteredDistributors.length === 0 ? 0 : (currentDistributorPage - 1) * ROWS_PER_PAGE + 1} -{" "}
              {Math.min(currentDistributorPage * ROWS_PER_PAGE, filteredDistributors.length)} of {filteredDistributors.length} distributors
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-xl" disabled={currentDistributorPage === 1} onClick={() => setDistributorPage((value) => Math.max(1, value - 1))}>
                Previous
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={currentDistributorPage >= totalDistributorPages}
                onClick={() => setDistributorPage((value) => Math.min(totalDistributorPages, value + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "analysis" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard title="Bottles Available" value={stock.data?.summary?.bottles_available ?? 0} />
            <StatCard title="Distributor Revenue" value={`₦ ${Number(analytics.data?.summary?.total_sales ?? 0).toLocaleString()}`} />
            <StatCard title="Paid" value={`₦ ${Number(analytics.data?.summary?.total_paid ?? 0).toLocaleString()}`} />
            <StatCard title="Outstanding" value={`₦ ${Number(analytics.data?.summary?.total_outstanding ?? 0).toLocaleString()}`} />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <StatCard title="Total Orders" value={analytics.data?.summary?.total_orders ?? 0} />
            <StatCard title="Total Sales" value={`₦ ${Number(analytics.data?.summary?.total_sales ?? 0).toLocaleString()}`} />
            <StatCard title="Total Paid" value={`₦ ${Number(analytics.data?.summary?.total_paid ?? 0).toLocaleString()}`} />
            <StatCard title="Total Left" value={`₦ ${Number(analytics.data?.summary?.total_outstanding ?? 0).toLocaleString()}`} />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Distributor</th>
                  <th className="px-4 py-4 font-semibold">Orders</th>
                  <th className="px-4 py-4 font-semibold">Total Sales</th>
                  <th className="px-4 py-4 font-semibold">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {(analytics.data?.top_distributors ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      No distribution analysis found.
                    </td>
                  </tr>
                ) : (
                  (analytics.data?.top_distributors ?? []).map((item, index) => (
                    <tr key={`${item.name}-${index}`}>
                      <td className="px-4 py-4 font-medium text-slate-900">{String(item.name ?? "-")}</td>
                      <td className="px-4 py-4">{Number(item.orders_count ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">₦ {Number(item.total_sales ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">₦ {Number(item.outstanding_balance ?? 0).toLocaleString()}</td>
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
