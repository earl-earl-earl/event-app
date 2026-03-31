"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Breadcrumb } from "@/components/dashboard/Breadcrumb";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface DashboardShellProps {
  canManageUsers: boolean;
  children: React.ReactNode;
}

export function DashboardShell({ canManageUsers, children }: DashboardShellProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      const supabase = getBrowserSupabase();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background overflow-x-hidden">
      <Sidebar
        canManageUsers={canManageUsers}
        onSignOut={handleSignOut}
        isSigningOut={isSigningOut}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main content area - offset by sidebar width */}
      <main
        className={`flex-1 transition-all duration-300 min-w-0 ${
          isCollapsed ? "ml-22" : "ml-22 lg:ml-65"
        }`}
      >
        <div className="max-w-350 mx-auto px-6 py-6 page-content">
          <Breadcrumb />
          {children}
        </div>
      </main>
    </div>
  );
}
