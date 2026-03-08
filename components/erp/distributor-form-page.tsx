"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { ErpPageHeader, SectionCard } from "@/components/erp/ui";
import { ERP_API_BASE } from "@/lib/erp-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectToken } from "@/lib/userSlice";

type DistributorFormPageProps = {
  distributorId?: string;
};

export default function DistributorFormPage({ distributorId }: DistributorFormPageProps) {
  const token = useSelector(selectToken);
  const router = useRouter();
  const isEditMode = Boolean(distributorId);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    status: "active",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!distributorId || !token) return;

    let active = true;
    setLoading(true);
    fetch(`${ERP_API_BASE}/distributors/${distributorId}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message ?? "Could not load distributor");
        }
        return result;
      })
      .then((result) => {
        if (!active) return;
        setForm({
          name: result.data.name ?? "",
          phone: result.data.phone ?? "",
          email: result.data.email ?? "",
          address: result.data.address ?? "",
          status: result.data.status ?? "active",
        });
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
  }, [distributorId, token]);

  const submit = async () => {
    if (!token) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(
        isEditMode ? `${ERP_API_BASE}/distributors/${distributorId}` : `${ERP_API_BASE}/distributors`,
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? `Could not ${isEditMode ? "update" : "create"} distributor`);
      }
      router.push("/dashboard/distribution");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title={isEditMode ? "Edit Distributor" : "Add Distributor"}
        description="Create or update the distributor profile, then return to the distribution list."
        action={
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/dashboard/distribution">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Distribution
            </Link>
          </Button>
        }
      />

      <SectionCard
        title={isEditMode ? "Distributor Details" : "New Distributor"}
        description="Keep only the contact and address details needed for distribution follow-up."
      >
        {loading ? <p className="mb-4 text-sm text-slate-500">Loading distributor...</p> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={submit} disabled={submitting || loading || !token}>
            {submitting ? "Saving..." : isEditMode ? "Update Distributor" : "Save Distributor"}
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/dashboard/distribution">Cancel</Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
