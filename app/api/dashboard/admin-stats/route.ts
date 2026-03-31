import { NextResponse } from "next/server";

import { requireAdminGuard } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { getServiceSupabase } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdminGuard();
  if ("response" in guard) {
    return guard.response;
  }

  const supabase = getServiceSupabase();

  const [eventsResponse, guestsResponse, profilesResponse] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, date, location, created_at")
      .order("date", { ascending: true }),
    supabase.from("guests").select("id, event_id, checked_in"),
    supabase
      .from("profiles")
      .select("id, role, full_name, is_active, created_at, updated_at")
      .order("created_at", { ascending: false }),
  ]);

  if (eventsResponse.error) {
    return jsonError(eventsResponse.error.message, 500, "admin_stats_events_fetch_failed");
  }

  if (guestsResponse.error) {
    return jsonError(guestsResponse.error.message, 500, "admin_stats_guests_fetch_failed");
  }

  if (profilesResponse.error) {
    return jsonError(profilesResponse.error.message, 500, "admin_stats_profiles_fetch_failed");
  }

  const events = eventsResponse.data;
  const guests = guestsResponse.data;
  const profiles = profilesResponse.data;

  const attendanceByEvent = new Map<string, { totalGuests: number; checkedInGuests: number }>();
  let checkedInGuests = 0;

  for (const guest of guests) {
    const existing = attendanceByEvent.get(guest.event_id) ?? {
      totalGuests: 0,
      checkedInGuests: 0,
    };

    existing.totalGuests += 1;

    if (guest.checked_in) {
      existing.checkedInGuests += 1;
      checkedInGuests += 1;
    }

    attendanceByEvent.set(guest.event_id, existing);
  }

  const eventAttendance = events.map((event) => {
    const aggregate = attendanceByEvent.get(event.id) ?? {
      totalGuests: 0,
      checkedInGuests: 0,
    };

    const totalGuests = aggregate.totalGuests;
    const checkedIn = aggregate.checkedInGuests;
    const remainingGuests = Math.max(totalGuests - checkedIn, 0);

    return {
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
      location: event.location,
      totalGuests,
      checkedInGuests: checkedIn,
      remainingGuests,
      checkInRatePercent: totalGuests === 0 ? 0 : Math.round((checkedIn / totalGuests) * 100),
    };
  });

  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  });

  const eventVolumeByMonthMap = new Map<string, number>();

  for (const event of events) {
    const parsedDate = new Date(event.date);
    if (Number.isNaN(parsedDate.getTime())) {
      continue;
    }

    const monthKey = `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, "0")}`;
    eventVolumeByMonthMap.set(monthKey, (eventVolumeByMonthMap.get(monthKey) ?? 0) + 1);
  }

  const eventVolumeByMonth = [...eventVolumeByMonthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => {
      const labelDate = new Date(`${month}-01T00:00:00.000Z`);

      return {
        month,
        label: monthFormatter.format(labelDate),
        count,
      };
    });

  let adminCount = 0;
  let organizerCount = 0;
  let activeAdminCount = 0;
  let inactiveAdminCount = 0;
  let activeOrganizerCount = 0;
  let suspendedOrganizerCount = 0;

  for (const profile of profiles) {
    if (profile.role === "admin") {
      adminCount += 1;
      if (profile.is_active) {
        activeAdminCount += 1;
      } else {
        inactiveAdminCount += 1;
      }
      continue;
    }

    organizerCount += 1;
    if (profile.is_active) {
      activeOrganizerCount += 1;
    } else {
      suspendedOrganizerCount += 1;
    }
  }

  const totalGuests = guests.length;
  const totalEvents = events.length;

  return NextResponse.json({
    success: true,
    totals: {
      totalEvents,
      totalGuests,
      checkedInGuests,
      remainingGuests: Math.max(totalGuests - checkedInGuests, 0),
      checkInRatePercent: totalGuests === 0 ? 0 : Math.round((checkedInGuests / totalGuests) * 100),
    },
    accounts: {
      admins: adminCount,
      organizers: organizerCount,
      activeAdmins: activeAdminCount,
      inactiveAdmins: inactiveAdminCount,
      activeOrganizers: activeOrganizerCount,
      suspendedOrganizers: suspendedOrganizerCount,
    },
    eventAttendance,
    eventVolumeByMonth,
    recentAccounts: profiles.slice(0, 6).map((profile) => ({
      id: profile.id,
      role: profile.role,
      fullName: profile.full_name,
      isActive: profile.is_active,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    })),
  });
}
