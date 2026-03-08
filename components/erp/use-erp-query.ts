"use client";

import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { selectToken } from "@/lib/userSlice";
import { ERP_API_BASE } from "@/lib/erp-api";

export function useErpQuery<T>(path: string) {
  const token = useSelector(selectToken);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${ERP_API_BASE}${path}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Request failed");
      }
      setData(payload as T);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [path, token]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, token };
}
