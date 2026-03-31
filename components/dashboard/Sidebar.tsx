"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Tooltip } from "react-tooltip";

/* ─── SVG Icon Components ─── */

function IconDashboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="7" height="8" rx="1.5" />
      <rect x="11" y="2" width="7" height="5" rx="1.5" />
      <rect x="2" y="12" width="7" height="6" rx="1.5" />
      <rect x="11" y="9" width="7" height="9" rx="1.5" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="16" height="15" rx="2" />
      <line x1="2" y1="8" x2="18" y2="8" />
      <line x1="6" y1="1" x2="6" y2="5" />
      <line x1="14" y1="1" x2="14" y2="5" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="6" r="3" />
      <path d="M1 17c0-3 2.7-5 6-5s6 2 6 5" />
      <circle cx="14.5" cy="7" r="2" />
      <path d="M14.5 12c2.5 0 4.5 1.5 4.5 4" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 1.5L3 4.5v5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5v-5L10 1.5z" />
      <path d="M7.5 10l2 2 3.5-4" />
    </svg>
  );
}

function IconUserCog() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="6" r="3" />
      <path d="M2 17c0-3 2.7-5 6-5" />
      <circle cx="15" cy="14" r="2" />
      <path d="M15 10.5v1.5M15 16v1.5M12.5 12.5l1 1M16.5 16.5l1 1M12.5 15.5l1-1M16.5 12.5l1-1M11.5 14h1.5M16.5 14h2" />
    </svg>
  );
}


function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17H4a1 1 0 01-1-1V4a1 1 0 011-1h3" />
      <polyline points="11 14 15 10 11 6" />
      <line x1="15" y1="10" x2="7" y2="10" />
    </svg>
  );
}

function IconChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${direction === "left" ? "rotate-180" : ""}`}
    >
      <polyline points="6 4 10 8 6 12" />
    </svg>
  );
}

/* ─── Types ─── */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

interface SidebarProps {
  canManageUsers: boolean;
  onSignOut: () => void;
  isSigningOut: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

/* ─── Sidebar Component ─── */

export function Sidebar({ canManageUsers, onSignOut, isSigningOut, isCollapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: <IconDashboard />, exact: true },
    { href: "/dashboard/events", label: "Events", icon: <IconCalendar /> },
    { href: "/dashboard/guests", label: "Guests", icon: <IconUsers /> },
  ];

  if (canManageUsers) {
    navItems.push(
      { href: "/dashboard/admins", label: "Admins", icon: <IconShield /> },
      { href: "/dashboard/organizers", label: "Organizers", icon: <IconUserCog /> },
    );
  }

  function isActive(item: NavItem): boolean {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  }

  return (
    <>
      <aside
        className={`fixed top-0 left-0 z-40 h-screen flex flex-col transition-all duration-300 overflow-x-hidden border-r ${
          isCollapsed ? "w-22" : "w-65"
        }`}
        style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}
      >
      {/* Logo / Brand */}
      <div
        className="flex items-center gap-3 px-4 h-16 border-b"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="11" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="11" width="6" height="6" rx="1" />
            <rect x="11" y="11" width="6" height="6" rx="1" opacity="0.5" />
          </svg>
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">QR Check-In</p>
            <p className="text-[11px] text-slate-500 whitespace-nowrap">Admin Console</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!isCollapsed && (
          <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.15em] font-semibold text-slate-500">
            Navigation
          </p>
        )}
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              } ${isCollapsed ? "justify-center" : ""}`}
              data-tooltip-id="sidebar-tooltip"
              data-tooltip-content={isCollapsed ? item.label : ""}
            >
              <span
                className={`shrink-0 flex items-center justify-center ${
                  active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                } ${isCollapsed ? "w-full" : ""}`}
              >
                {item.icon}
              </span>
              {!isCollapsed && <span>{item.label}</span>}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-5 rounded-r-full bg-blue-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom area: collapse + sign out */}
      <div
        className="px-3 py-3 border-t space-y-1"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`sidebar-item group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all duration-150 ${
            isCollapsed ? "justify-center" : ""
          }`}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-tooltip-id="sidebar-tooltip"
          data-tooltip-content={isCollapsed ? "Expand sidebar" : ""}
        >
          <span className={`shrink-0 flex items-center justify-center text-slate-400 group-hover:text-slate-600 ${isCollapsed ? "w-full" : ""}`}>
            <IconChevron direction={isCollapsed ? "right" : "left"} />
          </span>
          {!isCollapsed && <span>Collapse</span>}
        </button>

        <button
          type="button"
          onClick={onSignOut}
          disabled={isSigningOut}
          className={`sidebar-item group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all duration-150 disabled:opacity-50 ${
            isCollapsed ? "justify-center" : ""
          }`}
          data-tooltip-id="sidebar-tooltip"
          data-tooltip-content={isCollapsed ? (isSigningOut ? "Signing out..." : "Sign Out") : ""}
        >
          <span className={`shrink-0 flex items-center justify-center text-slate-400 group-hover:text-slate-600 ${isCollapsed ? "w-full" : ""}`}>
            <IconLogout />
          </span>
          {!isCollapsed && <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>}
        </button>
      </div>
    </aside>
    {isCollapsed && (
      <Tooltip id="sidebar-tooltip" place="right" positionStrategy="fixed" style={{ zIndex: 9999, fontSize: "0.75rem", backgroundColor: '#1e293b' }} />
    )}
    </>
  );
}
