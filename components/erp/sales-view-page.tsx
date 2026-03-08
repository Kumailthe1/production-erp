"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useSelector } from "react-redux";
import { ErpPageHeader, SectionCard } from "@/components/erp/ui";
import { ERP_API_BASE } from "@/lib/erp-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectToken } from "@/lib/userSlice";

type SalesViewPageProps = {
  saleId: string;
};

type PaymentRow = {
  id: number;
  payment_date: string;
  amount: number;
  payment_method: string;
};

type AllocationRow = {
  batch_number: string;
  production_date: string;
  bottles_allocated: number;
  cost_per_bottle: number;
  total_cost: number;
};

type SalePayload = {
  data: {
    id: number;
    sale_number: string;
    selected_batch_id: number;
    selected_batch_number?: string;
    batch_sources?: string;
    sale_date: string;
    customer_name?: string | null;
    bottles_sold: number;
    unit_price: number;
    total_amount: number;
    amount_paid: number;
    balance_due: number;
    status: string;
  };
  payments: PaymentRow[];
  allocations: AllocationRow[];
};

export default function SalesViewPage({ saleId }: SalesViewPageProps) {
  const token = useSelector(selectToken);
  const [payload, setPayload] = useState<SalePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    amount: "",
    payment_method: "cash",
  });

  useEffect(() => {
    if (!token) return;

    let active = true;
    setLoading(true);
    fetch(`${ERP_API_BASE}/sales/retail/${saleId}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message ?? "Could not load retail sale");
        }
        return result;
      })
      .then((result) => {
        if (active) {
          setPayload(result);
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
  }, [saleId, token]);

  const submitPayment = async () => {
    if (!token) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`${ERP_API_BASE}/sales/retail/${saleId}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payment_date: paymentForm.payment_date,
          amount: Number(paymentForm.amount),
          payment_method: paymentForm.payment_method,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Could not add payment");
      }

      const refresh = await fetch(`${ERP_API_BASE}/sales/retail/${saleId}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const freshPayload = await refresh.json();
      setPayload(freshPayload);
      setPaymentForm({
        payment_date: new Date().toISOString().slice(0, 10),
        amount: "",
        payment_method: "cash",
      });
      setMessage("Payment added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const sale = payload?.data;
  const paymentTotal = useMemo(
    () => (payload?.payments ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [payload]
  );

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title={sale ? sale.sale_number : "Retail Sale"}
        description="View the sale transaction, selected batch, payment history, and add new payments."
        action={
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/dashboard/sales">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sales
            </Link>
          </Button>
        }
      />

      {loading ? <p className="text-sm text-slate-500">Loading sale record...</p> : null}
      {message ? <p className="text-sm text-slate-500">{message}</p> : null}

      {sale ? (
        <>
          <section className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Sale Number</th>
                    <th className="px-4 py-4 font-semibold">Name</th>
                    <th className="px-4 py-4 font-semibold">Date</th>
                    <th className="px-4 py-4 font-semibold">Selected Batch</th>
                    <th className="px-4 py-4 font-semibold">Bottles</th>
                    <th className="px-4 py-4 font-semibold">Paid</th>
                    <th className="px-4 py-4 font-semibold">Left</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  <tr>
                    <td className="px-4 py-4 font-medium text-slate-900">{sale.sale_number}</td>
                    <td className="px-4 py-4">{sale.customer_name || "-"}</td>
                    <td className="px-4 py-4">{sale.sale_date}</td>
                    <td className="px-4 py-4">{sale.selected_batch_number || sale.batch_sources || "-"}</td>
                    <td className="px-4 py-4">{Number(sale.bottles_sold ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-4">₦ {Number(sale.amount_paid ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-4">₦ {Number(sale.balance_due ?? 0).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Batch</th>
                    <th className="px-4 py-4 font-semibold">Production Date</th>
                    <th className="px-4 py-4 font-semibold">Bottles Taken</th>
                    <th className="px-4 py-4 font-semibold">Cost / Bottle</th>
                    <th className="px-4 py-4 font-semibold">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {(payload?.allocations ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No batch allocations found.
                      </td>
                    </tr>
                  ) : (
                    (payload?.allocations ?? []).map((allocation, index) => (
                      <tr key={`${allocation.batch_number}-${index}`}>
                        <td className="px-4 py-4 font-medium text-slate-900">{allocation.batch_number}</td>
                        <td className="px-4 py-4">{allocation.production_date}</td>
                        <td className="px-4 py-4">{Number(allocation.bottles_allocated ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-4">₦ {Number(allocation.cost_per_bottle ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-4">₦ {Number(allocation.total_cost ?? 0).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Unit Price</th>
                    <th className="px-4 py-4 font-semibold">Total Amount</th>
                    <th className="px-4 py-4 font-semibold">Paid</th>
                    <th className="px-4 py-4 font-semibold">Left</th>
                    <th className="px-4 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  <tr>
                    <td className="px-4 py-4">₦ {Number(sale.unit_price ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-4">₦ {Number(sale.total_amount ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-4">₦ {Number(sale.amount_paid ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-4">₦ {Number(sale.balance_due ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-4 capitalize">{sale.status}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Payment Date</th>
                      <th className="px-4 py-4 font-semibold">Method</th>
                      <th className="px-4 py-4 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {(payload?.payments ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      (payload?.payments ?? []).map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-4 py-4">{payment.payment_date}</td>
                          <td className="px-4 py-4 capitalize">{payment.payment_method}</td>
                          <td className="px-4 py-4">₦ {Number(payment.amount ?? 0).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <SectionCard title="Add Payment">
              <div className="grid gap-4 md:grid-cols-6 md:items-end">
                <div className="space-y-2 md:col-span-2">
                  <Label>Date</Label>
                  <Input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Amount</Label>
                  <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label>Method</Label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="transfer">Transfer</option>
                    <option value="pos">POS</option>
                  </select>
                </div>
                <div className="md:col-span-1">
                  <Button className="h-11 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={submitPayment} disabled={submitting || !token}>
                    {submitting ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-500">Payments recorded: ₦ {paymentTotal.toLocaleString()}</p>
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
