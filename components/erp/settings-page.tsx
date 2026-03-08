"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useErpQuery } from "@/components/erp/use-erp-query";
import { ErpPageHeader } from "@/components/erp/ui";
import { ERP_API_BASE, ProductionParameter } from "@/lib/erp-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const emptyForm = {
  id: null as number | null,
  name: "",
  quantity_unit: "",
  unit_cost: "",
  default_quantity: "",
};

export default function SettingsPage() {
  const settings = useErpQuery<{ data: ProductionParameter[] }>("/production/settings");
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "create">("list");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredSettings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (settings.data?.data ?? []).filter((item) => {
      const searchMatches =
        query === "" ||
        item.name.toLowerCase().includes(query) ||
        item.quantity_unit.toLowerCase().includes(query);

      return searchMatches;
    });
  }, [search, settings.data]);

  const resetForm = (clearMessage = true) => {
    setForm(emptyForm);
    if (clearMessage) {
      setMessage(null);
    }
  };

  const startEdit = (item: ProductionParameter) => {
    setForm({
      id: item.id,
      name: item.name,
      quantity_unit: item.quantity_unit,
      unit_cost: String(item.unit_cost ?? 0),
      default_quantity: String(item.default_quantity ?? 0),
    });
    setView("create");
    setMessage(null);
  };

  const saveSetting = async () => {
    if (!settings.token) return;
    setSubmitting(true);
    setMessage(null);

    if (!form.name.trim()) {
      setMessage("Parameter name is required.");
      setSubmitting(false);
      return;
    }
    if (!form.quantity_unit.trim()) {
      setMessage("Quantity unit is required.");
      setSubmitting(false);
      return;
    }

    const payload = {
      name: form.name,
      parameter_kind: "input",
      quantity_unit: form.quantity_unit,
      unit_cost: Number(form.unit_cost || 0),
      default_quantity: Number(form.default_quantity || 0),
    };

    const endpoint = form.id
      ? `${ERP_API_BASE}/production/settings/${form.id}`
      : `${ERP_API_BASE}/production/settings`;
    const method = form.id ? "PATCH" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        const firstFieldError =
          result?.errors && typeof result.errors === "object"
            ? Object.values(result.errors).find(
                (value): value is string[] => Array.isArray(value) && value.length > 0
              )?.[0]
            : null;
        throw new Error(firstFieldError ?? result.message ?? "Could not save setting");
      }
      const successMessage = form.id ? "Parameter updated successfully." : "Parameter created successfully.";
      setMessage(successMessage);
      toast({
        title: "Success",
        description: successMessage,
      });
      resetForm(false);
      await settings.refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Request failed";
      setMessage(errorMessage);
      toast({
        title: "Save failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSetting = async (id: number) => {
    if (!settings.token) return;

    try {
      const response = await fetch(`${ERP_API_BASE}/production/settings/${id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${settings.token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Could not delete setting");
      }
      if (form.id === id) {
        resetForm();
      }
      const successMessage = "Parameter deleted successfully.";
      setMessage(successMessage);
      toast({
        title: "Deleted",
        description: successMessage,
      });
      await settings.refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Delete failed";
      setMessage(errorMessage);
      toast({
        title: "Delete failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title="Settings"
        description="Manage one clean list of production parameters used across supply and production."
      />

      <Tabs
        value={view}
        onValueChange={(value) => {
          setView(value as "list" | "create");
          setMessage(null);
        }}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl bg-stone-100">
          <TabsTrigger value="list">Parameter List</TabsTrigger>
          <TabsTrigger value="create">{form.id ? "Edit Parameter" : "Create Parameter"}</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "list" ? (
        <div className="max-w-7xl space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search parameter..."
              className="h-11 max-w-md rounded-xl"
            />
            <Button
              className="h-11 rounded-xl bg-slate-950 text-white hover:bg-slate-800"
              onClick={() => {
                resetForm();
                setView("create");
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Parameter
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Name</th>
                  <th className="px-4 py-4 font-semibold">Unit</th>
                  <th className="px-4 py-4 font-semibold">Default</th>
                  <th className="px-4 py-4 font-semibold">Cost</th>
                  <th className="px-4 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredSettings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No parameters found.
                    </td>
                  </tr>
                ) : (
                  filteredSettings.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-4">{item.quantity_unit}</td>
                      <td className="px-4 py-4">{item.default_quantity}</td>
                      <td className="px-4 py-4">₦ {Number(item.unit_cost ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSetting(item.id)}
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
        </div>
      ) : (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Quantity unit</Label>
            <Input value={form.quantity_unit} onChange={(e) => setForm({ ...form, quantity_unit: e.target.value })} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Default quantity</Label>
              <Input
                type="number"
                value={form.default_quantity}
                onChange={(e) => setForm({ ...form, default_quantity: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit cost</Label>
              <Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
            </div>
          </div>

          {message ? <p className="text-sm text-slate-500">{message}</p> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              className="rounded-xl bg-slate-950 text-white hover:bg-slate-800"
              onClick={saveSetting}
              disabled={submitting || !settings.token}
            >
              {submitting ? "Saving..." : form.id ? "Update Parameter" : "Save Parameter"}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => resetForm()}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
