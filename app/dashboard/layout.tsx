"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {  useSelector } from "react-redux";
import { selectAuth, selectUser } from "@/lib/userSlice";
import Sidebar from "@/components/dashboard/sidebar";
import Header from "@/components/dashboard/header";
import ProtectedRoute from "@/components/ProtectedRoute";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useSelector(selectAuth);
  const user = useSelector(selectUser);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Check if user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    if (user.role !== "staff") {
      return;
    }

    const blockedExact = ["/dashboard"];
    const blockedPrefixes = ["/dashboard/supply", "/dashboard/settings", "/dashboard/accounts", "/dashboard/monitoring"];
    const blockedEditRoutes = /^\/dashboard\/(production\/[^/]+\/edit|distribution\/orders\/[^/]+\/edit|distribution\/distributors\/.*)$/;

    if (
      blockedExact.includes(pathname) ||
      blockedPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
      blockedEditRoutes.test(pathname)
    ) {
      router.push("/dashboard/production");
    }
  }, [isAuthenticated, pathname, router, user]);

  // Handle fullscreen toggle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  // Handle sidebar toggle
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // If not authenticated, don't render the layout
  if (!isAuthenticated) {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar open={sidebarOpen} onToggle={toggleSidebar} />
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          <Header 
            onToggleSidebar={toggleSidebar} 
            isFullScreen={isFullScreen}
            onToggleFullScreen={toggleFullScreen}
          />
          <main className="relative flex-1 overflow-y-auto focus:outline-none p-6">
            <div className="py-2">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
    
  );
}
