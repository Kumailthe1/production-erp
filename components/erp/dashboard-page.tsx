"use client";

import { ReactNode, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  Boxes,
  CircleDollarSign,
} from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { useErpQuery } from "@/components/erp/use-erp-query";
import { ErpPageHeader } from "@/components/erp/ui";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardOverview, DashboardTrends } from "@/lib/erp-api";

const chartConfig = {
  productionCost: { label: "Production Cost", color: "#FF9852" },
  profit: { label: "Profit", color: "#A1A6FF" },
  target: { label: "Target", color: "#F099F0" },
} as const;

const periodOptions = [
  { key: "today", label: "Today" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "analytics", label: "Analytics" },
] as const;

type PeriodKey = (typeof periodOptions)[number]["key"];

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

function resolveOverviewPath(period: PeriodKey) {
  const today = new Date();
  const todayString = toLocalDateString(today);

  if (period === "today") {
    return `/dashboard/overview?date_from=${todayString}&date_to=${todayString}`;
  }

  if (period === "year") {
    const start = toLocalDateString(new Date(today.getFullYear(), 0, 1));
    return `/dashboard/overview?date_from=${start}&date_to=${todayString}`;
  }

  if (period === "analytics") {
    const start = toLocalDateString(new Date(today.getTime() - 89 * 86400000));
    return `/dashboard/overview?date_from=${start}&date_to=${todayString}`;
  }

  return "/dashboard/overview";
}

function DashboardWidget({
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
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border"
            style={{ borderColor: `${accent}66` }}
          >
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

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const overview = useErpQuery<DashboardOverview>(resolveOverviewPath(period));
  const trends = useErpQuery<DashboardTrends>("/dashboard/trends?days=366");

  const cards = overview.data?.cards;

  const monthlyRows = useMemo(() => {
    const map = new Map<
      string,
      { month: string; productionCost: number; totalRevenue: number; profit: number }
    >();

    const productionSeries = trends.data?.series.production ?? [];
    const distributionSeries = trends.data?.series.distribution ?? [];
    const retailSeries = trends.data?.series.retail ?? [];

    const ensure = (month: string) => {
      if (!map.has(month)) {
        map.set(month, { month, productionCost: 0, totalRevenue: 0, profit: 0 });
      }
      return map.get(month)!;
    };

    productionSeries.forEach((row) => {
      const month = String(row.period).slice(0, 7);
      const entry = ensure(month);
      entry.productionCost += Number(row.production_cost ?? 0);
    });

    distributionSeries.forEach((row) => {
      const month = String(row.period).slice(0, 7);
      const entry = ensure(month);
      entry.totalRevenue += Number(row.revenue ?? 0);
    });

    retailSeries.forEach((row) => {
      const month = String(row.period).slice(0, 7);
      const entry = ensure(month);
      entry.totalRevenue += Number(row.revenue ?? 0);
    });

    Array.from(map.values()).forEach((item) => {
      item.profit = item.totalRevenue - item.productionCost;
    });

    const highest = Array.from(map.values()).reduce(
      (max, item) => Math.max(max, item.totalRevenue, item.productionCost),
      0
    );
    const target = Math.max(2_000_000, highest);

    const endMonthSource = (overview.data?.range?.date_to as string | undefined) ?? toLocalDateString(new Date());
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
  }, [overview.data?.range?.date_to, trends.data]);

  const totals = useMemo(() => {
    const productionCost = monthlyRows.reduce((sum, row) => sum + Number(row.productionCost ?? 0), 0);
    const totalRevenue = monthlyRows.reduce((sum, row) => sum + Number(row.totalRevenue ?? 0), 0);
    const profit = totalRevenue - productionCost;
    return { productionCost, totalRevenue, profit };
  }, [monthlyRows]);

  const latestMonth = monthlyRows[monthlyRows.length - 1];
  const widgetRows = [
    {
      title: "Total Revenue",
      value: formatMoney(Number(cards?.gross_revenue ?? 0)),
      hint: `${Number(cards?.distribution?.orders_count ?? 0) + Number(cards?.retail?.sales_count ?? 0)} recorded transactions`,
      accent: "#2563eb",
      icon: <Banknote className="h-6 w-6" />,
    },
    {
      title: "Gross Profit",
      value: formatMoney(Number(cards?.gross_profit ?? 0)),
      hint: latestMonth ? `${formatMonth(latestMonth.month)} performance window` : "No monthly data yet",
      accent: "#fb923c",
      icon: <CircleDollarSign className="h-6 w-6" />,
    },
    {
      title: "Bottles Produced",
      value: Number(cards?.production?.bottles_produced ?? 0).toLocaleString(),
      hint: `${overview.data?.range?.date_from ?? ""} to ${overview.data?.range?.date_to ?? ""}`,
      accent: "#65a30d",
      icon: <Activity className="h-6 w-6" />,
    },
    {
      title: "Total Stock",
      value: formatMoney(Number(cards?.finished_stock?.stock_value ?? 0)),
      hint: `${Number(cards?.finished_stock?.bottles_available ?? 0).toLocaleString()} bottles available`,
      accent: "#0ea5e9",
      icon: <Boxes className="h-6 w-6" />,
    },
  ];

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title="ERP Overview"
        description="Executive dashboard for revenue, production output, and monthly business performance."
      />

      <Tabs value={period} onValueChange={(value) => setPeriod(value as PeriodKey)}>
        <TabsList className="grid w-full max-w-md grid-cols-4 rounded-xl bg-stone-100">
          {periodOptions.map((item) => (
            <TabsTrigger key={item.key} value={item.key}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-3 xl:grid-cols-4">
        {widgetRows.map((item) => (
          <DashboardWidget key={item.title} {...item} />
        ))}
      </div>

      <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Monthly History</p>
            <h2 className="mt-1 text-base font-semibold text-slate-950">Production cost vs profit</h2>
          </div>
          <div className="text-[11px] text-slate-500">
            {latestMonth ? `Latest month: ${formatMonth(latestMonth.month)}` : "Waiting for monthly data"}
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <ComposedChart data={monthlyRows} margin={{ left: 10, right: 14, top: 12, bottom: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={formatMonth} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCompactMoney(Number(value))}
              tick={{ fontSize: 11 }}
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
            <Bar yAxisId="right" dataKey="productionCost" stackId="perf" fill="var(--color-productionCost)" name="Production Cost" radius={[6, 6, 0, 0]} barSize={18} />
            <Bar yAxisId="right" dataKey="profit" stackId="perf" fill="var(--color-profit)" name="Profit" radius={[6, 6, 0, 0]} barSize={18} />
            <Line yAxisId="right" type="monotone" dataKey="target" stroke="var(--color-target)" name="Target" strokeWidth={1.8} strokeDasharray="6 4" dot={false} />
            <ReferenceLine yAxisId="right" y={monthlyRows[0]?.target ?? 2000000} stroke="var(--color-target)" strokeDasharray="4 4" />
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
    </div>
  );
}
