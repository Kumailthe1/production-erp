import { ERP_API_BASE } from "@/lib/runtime-config";

export { ERP_API_BASE } from "@/lib/runtime-config";

export type ErpRole = "admin" | "staff";

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role: ErpRole;
  status: string;
}

export interface AuthSession {
  token: string;
  token_type: string;
  expires_at: string;
  user: AuthUser;
}

export interface ApiSuccess<T> {
  success: true;
  message?: string;
  data?: T;
  items?: unknown;
  summary?: unknown;
  cards?: unknown;
  range?: unknown;
  series?: unknown;
  top_distributors?: unknown;
  low_stock_parameters?: unknown;
  outstanding_distributor_orders?: unknown;
  outstanding_retail_sales?: unknown;
  finished_goods?: unknown;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface DashboardOverview {
  range: { date_from: string; date_to: string };
  cards: {
    production: Record<string, string | number>;
    supply: Record<string, string | number>;
    distribution: Record<string, string | number>;
    retail: Record<string, string | number>;
    raw_stock: Record<string, string | number>;
    finished_stock: Record<string, string | number>;
    gross_revenue: number;
    gross_profit: number;
    outstanding_receivables: number;
  };
}

export interface DashboardTrends {
  range: { date_from: string; date_to: string; days: number };
  series: Record<string, Array<Record<string, string | number>>>;
}

export interface DashboardAlerts {
  stock_threshold: number;
  low_stock_parameters: Array<Record<string, string | number>>;
  outstanding_distributor_orders: Array<Record<string, string | number>>;
  outstanding_retail_sales: Array<Record<string, string | number>>;
  finished_goods: Record<string, string | number>;
}

export interface ActivityFeed {
  data: Array<Record<string, string | number | null>>;
}

export interface ProductionParameter {
  id: number;
  name: string;
  code: string;
  parameter_kind: string;
  quantity_unit: string;
  unit_cost: number;
  default_quantity: number;
  notes?: string;
}

export interface SupplyReceipt {
  id: number;
  receipt_number: string;
  supply_date: string;
  supplier_name?: string | null;
  status: string;
  total_cost: number;
  notes?: string | null;
}

export interface ProductionBatch {
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
}

export interface Distributor {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
}

export interface DistributionOrder {
  id: number;
  order_number: string;
  distributor_id: number;
  selected_batch_id?: number;
  selected_batch_number?: string;
  distributor_name?: string;
  batch_sources?: string;
  sizes_summary?: string;
  order_date: string;
  bottles_issued: number;
  unit_price: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  gross_profit: number;
  status: string;
}

export interface RetailSale {
  id: number;
  sale_number: string;
  selected_batch_id?: number;
  selected_batch_number?: string;
  sale_date: string;
  batch_sources?: string;
  sizes_summary?: string;
  customer_name?: string | null;
  bottles_sold: number;
  unit_price: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  gross_profit: number;
  status: string;
}

export async function erpFetch<T>(
  path: string,
  options: RequestInit & { token?: string; json?: unknown } = {}
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Accept", "application/json");
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${ERP_API_BASE}${path}`, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    cache: "no-store",
  });

  const payload = (await response.json()) as ApiResponse<T> | T;
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String(payload.message)
        : "Request failed";
    throw new Error(message);
  }

  return payload as T;
}

export async function loginRequest(payload: { email?: string; phone?: string; password: string }) {
  const response = await erpFetch<ApiSuccess<AuthSession>>("/auth/login", {
    method: "POST",
    json: payload,
  });

  return response.data as AuthSession;
}

export async function registerUser(
  token: string,
  payload: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
    role: ErpRole;
  }
) {
  return erpFetch<ApiSuccess<{ id: number }>>("/auth/register", {
    method: "POST",
    token,
    json: payload,
  });
}
