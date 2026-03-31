"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ─── Segment label map ─── */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  admins: "Admins",
  organizers: "Organizers",
  events: "Events",
  guests: "Guests",
  users: "Users",
  "check-in": "Check-In",
  view: "View",
  create: "Create",
  edit: "Edit",
  "suspend-delete": "Suspend / Delete",
};

function labelFor(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

/* ─── Chevron icon ─── */
function ChevronRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="5 3 9 7 5 11" />
    </svg>
  );
}

/* ─── Breadcrumb Component ─── */

export function Breadcrumb() {
  const pathname = usePathname();

  // Build segments — skip empty strings from leading "/"
  const segments = pathname.split("/").filter(Boolean);

  // If we're at the top-level dashboard page, don't render breadcrumbs
  if (segments.length <= 1) return null;

  // Build cumulative paths for each segment
  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = labelFor(segment);
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {index > 0 && (
              <span className="text-slate-300" aria-hidden="true">
                <ChevronRight />
              </span>
            )}
            {crumb.isLast ? (
              <span className="font-semibold text-slate-800" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-slate-400 hover:text-accent-600 transition-colors duration-150"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
