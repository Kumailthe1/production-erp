"use client";

import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Plus, Search } from "lucide-react";
import { selectToken } from "@/lib/userSlice";
import { registerUser } from "@/lib/erp-api";
import { useErpQuery } from "@/components/erp/use-erp-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErpPageHeader } from "@/components/erp/ui";

type AccountRow = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role: "admin" | "staff";
  status: string;
  created_at: string;
};

export default function AccountsPage() {
  const token = useSelector(selectToken);
  const [view, setView] = useState<"list" | "create">("list");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "staff">("all");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    role: "staff" as "admin" | "staff",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const query = `/auth/users${roleFilter !== "all" || search.trim() !== "" ? "?" : ""}${
    roleFilter !== "all" ? `role=${encodeURIComponent(roleFilter)}` : ""
  }${
    roleFilter !== "all" && search.trim() !== "" ? "&" : ""
  }${
    search.trim() !== "" ? `search=${encodeURIComponent(search.trim())}` : ""
  }`;

  const users = useErpQuery<{ data: AccountRow[] }>(query);

  const sortedUsers = useMemo(() => {
    return [...(users.data?.data ?? [])].sort((a, b) => b.id - a.id);
  }, [users.data]);

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title="Account Management"
        description="Switch between staff list and create new staff account."
      />

      <Tabs
        value={view}
        onValueChange={(value) => {
          setView(value as "list" | "create");
          setMessage(null);
        }}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl bg-stone-100">
          <TabsTrigger value="list">Staff List</TabsTrigger>
          <TabsTrigger value="create">Create Staff</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "list" ? (
        <div className="max-w-7xl space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="relative min-w-[18rem]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search staff..."
                  className="h-11 rounded-xl border-slate-200 pl-10"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as "all" | "admin" | "staff")}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <Button
              className="h-11 rounded-xl bg-slate-950 text-white hover:bg-slate-800"
              onClick={() => setView("create")}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Staff
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Full Name</th>
                  <th className="px-4 py-4 font-semibold">Email</th>
                  <th className="px-4 py-4 font-semibold">Phone</th>
                  <th className="px-4 py-4 font-semibold">Role</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {users.loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      Loading accounts...
                    </td>
                  </tr>
                ) : sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      No accounts found.
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{item.full_name}</td>
                      <td className="px-4 py-4">{item.email}</td>
                      <td className="px-4 py-4">{item.phone || "-"}</td>
                      <td className="px-4 py-4 capitalize">{item.role}</td>
                      <td className="px-4 py-4 capitalize">{item.status}</td>
                      <td className="px-4 py-4">{String(item.created_at || "").slice(0, 10)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <form
          className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!token) return;
            setSubmitting(true);
            setMessage(null);
            try {
              await registerUser(token, form);
              setMessage("Account created successfully.");
              setForm({ full_name: "", email: "", phone: "", password: "", role: "staff" });
              await users.refetch();
              setView("list");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Could not create account.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(value: "admin" | "staff") => setForm({ ...form, role: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {message ? <p className="text-sm text-slate-500">{message}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" disabled={submitting || !token}>
              {submitting ? "Creating..." : "Create account"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setForm({ full_name: "", email: "", phone: "", password: "", role: "staff" });
                setMessage(null);
              }}
            >
              Clear
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
