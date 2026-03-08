"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Factory,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Truck,
  UserCog,
  X,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { clearSession, selectUser } from "@/lib/userSlice";
import { useRouter } from "next/navigation";
import logo from "@/assets/logo.jpg";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const navigationGroups = [
  {
    title: "Dashboard",
    items: [{ href: "/dashboard", title: "Overview", icon: LayoutDashboard }],
  },
  {
    title: "Production",
    items: [
      { href: "/dashboard/supply", title: "Production Supply", icon: Store },
      { href: "/dashboard/production", title: "Production", icon: Factory }
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/dashboard/distribution", title: "Distribution", icon: Truck },
      { href: "/dashboard/sales", title: "Sales", icon: ShoppingBag },
      { href: "/dashboard/monitoring", title: "Revenue Trend", icon: PackageSearch },
    ],
  },
  
  {
    title: "Management",
    items: [
      { href: "/dashboard/settings", title: "Settings", icon: SlidersHorizontal },
      { href: "/dashboard/accounts", title: "Accounts", icon: UserCog },
      
    ],
  },
];

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const visibleGroups = navigationGroups
    .map((group) => {
      if (isAdmin) {
        return group;
      }

      if (group.title === "Dashboard") {
        return { ...group, items: [] };
      }
      if (group.title === "Production") {
        return { ...group, items: group.items.filter((item) => item.href !== "/dashboard/supply") };
      }
      if (group.title === "Sales") {
        return { ...group, items: group.items.filter((item) => item.href !== "/dashboard/monitoring") };
      }
      if (group.title === "Management") {
        return { ...group, items: [] };
      }

      return group;
    })
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-20 flex w-72 flex-col border-r bg-[#17182a] text-slate-100 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src={logo}
            alt="Amsal ERP"
            width={44}
            height={44}
            className="h-11 w-11 rounded-xl object-cover"
          />
          <div>
            <p className="text-base font-semibold leading-tight">Amsal ERP</p>
            <p className="text-xs text-slate-400">
              {user?.full_name ?? "ERP Operator"}
            </p>
          </div>
        </Link>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onToggle}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 py-4 mt-6">
        <div className="space-y-6">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {group.title}
              </div>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-slate-800 text-white"
                          : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-slate-800 p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white"
          onClick={() => {
            dispatch(clearSession());
            router.push("/");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
