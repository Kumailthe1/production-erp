const normalizeUrl = (value: string, fallback: string) => {
  const trimmed = (value || fallback).trim();
  return trimmed.replace(/\/+$/, "");
};

export const ERP_BACKEND_BASE_URL = normalizeUrl(
  process.env.NEXT_PUBLIC_ERP_BACKEND_BASE_URL || "",
  "http://127.0.0.1:8081"
);

export const ERP_API_BASE = `${ERP_BACKEND_BASE_URL}/api/v1`;
export const ERP_DOCS_URL = `${ERP_BACKEND_BASE_URL}/docs`;
