"use client";

import { ReactNode, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Banknote, CircleDollarSign, PackageOpen } from "lucide-react";
import { useErpQuery } from "@/components/erp/use-erp-query";
import { ErpPageHeader } from "@/components/erp/ui";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const chartConfig = {
  productionCost: { label: "Production Cost", color: "#FF9852" },
  profit: { label: "Profit", color: "#A1A6FF" },
  target: { label: "Target", color: "#F099F0" },
} as const;

const PIE_COLORS = ["#33D9A0", "#A1A6FF", "#F099F0", "#FDEA69", "#FF9852"];

function formatMoney(value: number) {
  return `₦${Number(value ?? 0).toLocaleString()}`;
}

function formatCompactMoney(value: number) {
  const amount = Number(value ?? 0);
  if (amount >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(0)}K`;
  return `₦${amount.toLocaleString()}`;
}

function formatMonth(value: string) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [year, month] = value.split("-");
  const monthIndex = Number(month) - 1;
  if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return value;
  return `${monthNames[monthIndex]} ${year}`;
}

function toLocalDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toLocalYearMonth(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function buildTrailingMonthsFrom(endDate: string, count: number) {
  const [y, m] = endDate.slice(0, 7).split("-").map(Number);
  const now = Number.isFinite(y) && Number.isFinite(m) && y > 0 && m > 0
    ? new Date(y, m - 1, 1)
    : new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return toLocalYearMonth(date);
  });
}

function getDefaultRange() {
  const now = new Date();
  const today = toLocalDateString(now);
  const monthStart = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  return { today, monthStart };
}

function SummaryWidget({
  title,
  value,
  hint,
  accent,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed"
          style={{ borderColor: `${accent}55`, color: accent, backgroundColor: `${accent}0d` }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: `${accent}66` }}>
            {icon}
          </div>
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{title}</p>
          <p className="mt-0.5 text-[11px] text-emerald-600">{hint}</p>
        </div>
      </div>
    </section>
  );
}

export default function MonitoringPage() {
  const { today, monthStart } = getDefaultRange();
  const [preset, setPreset] = useState<"daily" | "monthly" | "yearly" | "analytics">("monthly");
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [appliedRange, setAppliedRange] = useState({ dateFrom: monthStart, dateTo: today });

  const overview = useErpQuery<any>(
    `/dashboard/overview?date_from=${appliedRange.dateFrom}&date_to=${appliedRange.dateTo}`
  );
  const trends = useErpQuery<any>(
    `/dashboard/trends?date_from=${appliedRange.dateFrom}&date_to=${appliedRange.dateTo}`
  );
  const alerts = useErpQuery<any>("/dashboard/alerts?stock_threshold=20");

  const cards = overview.data?.cards;
  const grossRevenue = Number(cards?.gross_revenue ?? 0);
  const grossProfit = Number(cards?.gross_profit ?? 0);
  const receivables = Number(cards?.outstanding_receivables ?? 0);
  const producedBottles = Number(cards?.production?.bottles_produced ?? 0);
  const finishedStock = Number(cards?.finished_stock?.bottles_available ?? 0);

  const dailyRows = useMemo(() => {
    const map = new Map<
      string,
      { period: string; productionCost: number; totalRevenue: number; profit: number }
    >();

    const ensure = (period: string) => {
      if (!map.has(period)) {
        map.set(period, { period, productionCost: 0, totalRevenue: 0, profit: 0 });
      }
      return map.get(period)!;
    };

    (trends.data?.series?.production ?? []).forEach((row: any) => {
      const entry = ensure(String(row.period));
      entry.productionCost += Number(row.production_cost ?? 0);
    });

    (trends.data?.series?.distribution ?? []).forEach((row: any) => {
      const entry = ensure(String(row.period));
      entry.totalRevenue += Number(row.revenue ?? 0);
    });

    (trends.data?.series?.retail ?? []).forEach((row: any) => {
      const entry = ensure(String(row.period));
      entry.totalRevenue += Number(row.revenue ?? 0);
    });

    Array.from(map.values()).forEach((row) => {
      row.profit = row.totalRevenue - row.productionCost;
    });

    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [trends.data]);

  const monthlyRows = useMemo(() => {
    const map = new Map<string, { month: string; productionCost: number; totalRevenue: number; profit: number }>();

    dailyRows.forEach((row) => {
      const month = row.period.slice(0, 7);
      if (!map.has(month)) {
        map.set(month, { month, productionCost: 0, totalRevenue: 0, profit: 0 });
      }
      const entry = map.get(month)!;
      entry.productionCost += row.productionCost;
      entry.totalRevenue += row.totalRevenue;
      entry.profit += row.profit;
    });

    const highest = Array.from(map.values()).reduce((max, item) => {
      return Math.max(max, item.totalRevenue, item.productionCost);
    }, 0);
    const target = Math.max(2_000_000, highest);

    const endMonthSource = (overview.data?.range?.date_to as string | undefined) ?? appliedRange.dateTo;
    return buildTrailingMonthsFrom(endMonthSource, 12).map((month) => {
      const row = map.get(month);
      return {
        month,
        productionCost: row?.productionCost ?? 0,
        totalRevenue: row?.totalRevenue ?? 0,
        profit: row?.profit ?? 0,
        target,
      };
    });
  }, [appliedRange.dateTo, dailyRows, overview.data?.range?.date_to]);

  const totals = useMemo(() => {
    const productionCost = monthlyRows.reduce((sum, row) => sum + Number(row.productionCost ?? 0), 0);
    const totalRevenue = monthlyRows.reduce((sum, row) => sum + Number(row.totalRevenue ?? 0), 0);
    const profit = totalRevenue - productionCost;
    return { productionCost, totalRevenue, profit };
  }, [monthlyRows]);

  const revenueMix = [
    { name: "Distribution", value: Number(cards?.distribution?.revenue ?? 0) },
    { name: "Retail", value: Number(cards?.retail?.revenue ?? 0) },
    { name: "Profit", value: grossProfit },
    { name: "Receivables", value: receivables },
  ].filter((item) => item.value > 0);

  const exposureRows = [
    ...(alerts.data?.outstanding_distributor_orders ?? []).slice(0, 3).map((item: any) => ({
      label: item.order_number,
      type: "Distributor balance",
      amount: formatMoney(Number(item.balance_due ?? 0)),
    })),
    ...(alerts.data?.outstanding_retail_sales ?? []).slice(0, 3).map((item: any) => ({
      label: item.sale_number,
      type: "Retail balance",
      amount: formatMoney(Number(item.balance_due ?? 0)),
    })),
    ...(alerts.data?.low_stock_parameters ?? []).slice(0, 4).map((item: any) => ({
      label: item.parameter_name,
      type: "Low stock",
      amount: `${Number(item.quantity_in_stock ?? 0).toLocaleString()} ${item.quantity_unit ?? ""}`.trim(),
    })),
  ];

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title="Revenue Trend"
        description="Presentation-ready revenue analysis across production, distribution, sales, profit, and unpaid balances."
      />

      <section className="px-0 py-0">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            value={preset}
            onValueChange={(value) => {
              const next = value as "daily" | "monthly" | "yearly" | "analytics";
              setPreset(next);
              if (next === "daily") {
                setDateFrom(today);
                setDateTo(today);
                setAppliedRange({ dateFrom: today, dateTo: today });
              } else if (next === "yearly") {
                const start = toLocalDateString(new Date(new Date().getFullYear(), 0, 1));
                setDateFrom(start);
                setDateTo(today);
                setAppliedRange({ dateFrom: start, dateTo: today });
              } else if (next === "analytics") {
                const start = toLocalDateString(new Date(Date.now() - 364 * 86400000));
                setDateFrom(start);
                setDateTo(today);
                setAppliedRange({ dateFrom: start, dateTo: today });
              } else {
                setDateFrom(monthStart);
                setDateTo(today);
                setAppliedRange({ dateFrom: monthStart, dateTo: today });
              }
            }}
          >
            <TabsList className="grid w-full max-w-md grid-cols-4 rounded-xl bg-stone-100">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="monthly">Month</TabsTrigger>
              <TabsTrigger value="yearly">Year</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] xl:w-[23rem]">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-lg text-xs" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-lg text-xs" />
            <div className="flex items-center">
              <Button
                className="h-9 rounded-lg bg-slate-950 px-3 text-xs text-white hover:bg-slate-800"
                onClick={() => setAppliedRange({ dateFrom, dateTo })}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-4">
        <SummaryWidget
          title="Total Revenue"
          value={formatMoney(grossRevenue)}
          hint={`${Number(cards?.distribution?.orders_count ?? 0) + Number(cards?.retail?.sales_count ?? 0)} transactions`}
          accent="#2563eb"
          icon={<Banknote className="h-6 w-6" />}
        />
        <SummaryWidget
          title="Gross Profit"
          value={formatMoney(grossProfit)}
          hint="Current range performance"
          accent="#fb923c"
          icon={<CircleDollarSign className="h-6 w-6" />}
        />
        <SummaryWidget
          title="Total Bottles"
          value={producedBottles.toLocaleString()}
          hint="Completed production output"
          accent="#65a30d"
          icon={<Activity className="h-6 w-6" />}
        />
        <SummaryWidget
          title="Available Stock"
          value={finishedStock.toLocaleString()}
          hint="Finished bottles waiting for sale"
          accent="#0ea5e9"
          icon={<PackageOpen className="h-6 w-6" />}
        />
      </div>

      <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Monthly History Analysis</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">Production cost vs profit</h2>
        </div>

        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ComposedChart data={monthlyRows} margin={{ left: 8, right: 18, top: 12, bottom: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={formatMonth} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCompactMoney(Number(value))}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-8">
                      <span className="text-slate-500">{String(name)}</span>
                      <span className="font-semibold text-slate-950">
                        {formatMoney(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Legend />
            <Bar yAxisId="right" dataKey="productionCost" stackId="perf" name="Production Cost" fill="var(--color-productionCost)" radius={[5, 5, 0, 0]} barSize={14} />
            <Bar yAxisId="right" dataKey="profit" stackId="perf" name="Profit" fill="var(--color-profit)" radius={[5, 5, 0, 0]} barSize={14} />
            <Line yAxisId="right" type="monotone" dataKey="target" name="Target" stroke="var(--color-target)" strokeWidth={1.6} strokeDasharray="6 4" dot={false} />
          </ComposedChart>
        </ChartContainer>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">Total Revenue</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(totals.totalRevenue)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Distribution + retail revenue in range</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">Production Cost</p>
            <p className="mt-1 text-sm font-semibold text-orange-600">{formatMoney(totals.productionCost)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Total production spend in range</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">Profit</p>
            <p className="mt-1 text-sm font-semibold text-indigo-600">{formatMoney(totals.profit)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Total revenue minus production cost</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-4">
        <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm xl:col-span-1">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Revenue Channel Analysis</p>
            <h3 className="mt-1 text-base font-semibold text-slate-950">Revenue split</h3>
          </div>

          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <PieChart>
              <Pie data={revenueMix} dataKey="value" nameKey="name" innerRadius={38} outerRadius={64} paddingAngle={3}>
                {revenueMix.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Legend />
            </PieChart>
          </ChartContainer>
        </section>

        <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm xl:col-span-3">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Recovery Snapshot</p>
            <h3 className="mt-1 text-base font-semibold text-slate-950">Revenue, profit and unpaid balance</h3>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Gross Revenue</p>
              <p className="mt-1 text-lg font-semibold text-blue-700">{formatMoney(grossRevenue)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Profit</p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">{formatMoney(grossProfit)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Receivables</p>
              <p className="mt-1 text-lg font-semibold text-rose-600">{formatMoney(receivables)}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {exposureRows.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No urgent exposure in the current snapshot.
              </div>
            ) : (
              exposureRows.map((item, index) => (
                <div key={`${item.label}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.type}</p>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <p className="font-medium text-slate-900">{item.label}</p>
                    <p className="text-sm font-semibold text-slate-700">{item.amount}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
