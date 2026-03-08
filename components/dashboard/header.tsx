"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useSelector } from "react-redux";
import { selectUser } from "@/lib/userSlice";
import {
  MenuIcon,
  Moon,
  Sun,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onToggleSidebar: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
}

const titles: Record<string, string> = {
  "/dashboard": "Dashboard Overview",
  "/dashboard/settings": "Settings",
  "/dashboard/accounts": "Account Management",
  "/dashboard/supply": "Production Supply",
  "/dashboard/supply/new": "Add Production Supply",
  "/dashboard/production": "Production",
  "/dashboard/production/new": "Add Production",
  "/dashboard/production/[id]": "Production Batch",
  "/dashboard/production/[id]/edit": "Edit Production",
  "/dashboard/distribution": "Distribution",
  "/dashboard/distribution/distributors/new": "Add Distributor",
  "/dashboard/distribution/orders/new": "Add Distribution",
  "/dashboard/sales": "Sales",
  "/dashboard/monitoring": "Revenue Trend",
};

export default function Header({
  onToggleSidebar,
  isFullScreen,
  onToggleFullScreen,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const user = useSelector(selectUser);

  const title = useMemo(() => {
    if (/^\/dashboard\/production\/[^/]+\/edit$/.test(pathname)) {
      return "Edit Production";
    }
    if (/^\/dashboard\/production\/[^/]+$/.test(pathname)) {
      return "Production Batch";
    }
    if (/^\/dashboard\/distribution\/distributors\/[^/]+\/edit$/.test(pathname)) {
      return "Edit Distributor";
    }
    if (/^\/dashboard\/distribution\/orders\/[^/]+\/edit$/.test(pathname)) {
      return "Edit Distribution";
    }
    if (/^\/dashboard\/distribution\/orders\/[^/]+$/.test(pathname)) {
      return "Distribution Record";
    }
    if (/^\/dashboard\/sales\/[^/]+$/.test(pathname)) {
      return "Sales Record";
    }
    return titles[pathname] ?? "Amsal ERP";
  }, [pathname]);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-x-4 border-b bg-background px-4 shadow-sm">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onToggleSidebar}>
        <MenuIcon className="h-5 w-5" />
      </Button>

      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-x-4">
          <Button variant="ghost" size="icon" className="hidden md:flex" onClick={onToggleSidebar}>
            <MenuIcon className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground">
              Fermented milk ERP operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-x-3">
          <Button variant="ghost" size="icon" onClick={onToggleFullScreen} className="hidden md:flex">
            {isFullScreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <div className="rounded-full border p-1">
            <Avatar className="h-9 w-9">
              <AvatarFallback>
                {user?.full_name?.slice(0, 1)?.toUpperCase() ?? "A"}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </header>
  );
}
