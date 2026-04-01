# End-User System Documentation

## 1. System Purpose

This platform is used to run events with QR-based tickets and check-in.

It helps teams:
- create events,
- add and manage guest lists,
- send ticket links to guests,
- scan tickets at the venue,
- monitor check-in progress in real time.

It also helps guests:
- open their ticket online,
- show a QR code at entry,
- track whether they are already checked in.

## 2. Who Uses the System

There are 3 end-user roles:

1. Admin
- Manages admin and organizer accounts.
- Monitors overall system and event performance.
- Has read-only visibility for events and guests.

2. Organizer
- Creates and manages events.
- Imports and manages guests.
- Runs ticket dispatch.
- Operates the check-in scanner.

3. Guest (Event Attendee)
- Receives a ticket link by email and/or SMS.
- Opens a personal ticket page with QR code.
- Shows QR code for venue check-in.

## 3. Role-Based Functionalities

### Admin
- Sign in by password or magic link.
- Open dashboard overview with high-level metrics.
- View event attendance progress.
- View account distribution and recent accounts.
- Open account center.
- Create admin or organizer accounts.
- Edit account details.
- Suspend, reactivate, or delete accounts.

### Organizer
- Sign in by password or magic link.
- Open dashboard with event-focused overview.
- Select active event and view real-time guest stats.
- Create new events.
- View events list.
- Open guests page for a selected event.
- Upload guests via CSV.
- Add guests manually.
- Edit or delete guest records.
- Add custom guest metadata fields.
- Run dispatch worker to send queued tickets.
- Requeue event email jobs.
- Open scanner and verify guest entries.

### Guest
- Open ticket page from link.
- View event details, personal details, and QR code.
- View entry usage count (for example, 1/1 or 1/2).
- Download ticket as PNG or PDF.

## 4. Primary User Flows

## Flow A: Organizer Event Setup and Guest Onboarding

1. Organizer signs in.
2. Organizer opens Dashboard.
3. Organizer goes to Events and creates a new event.
4. Organizer goes to Guests and selects the event.
5. Organizer uploads guest CSV or adds guests manually.
6. System creates each guest record and ticket token.
7. System queues dispatch jobs (email, and SMS if enabled).
8. Organizer optionally clicks Run Dispatch to process queued sends.
9. Guests receive ticket links.

## Flow B: Guest Ticket Experience

1. Guest receives ticket link.
2. Guest opens ticket page.
3. Guest sees:
- event name/date/location,
- guest name/email,
- QR code,
- entries used count,
- current status (ready or already checked in).
4. Guest presents QR code at the venue.

## Flow C: Venue Check-In Experience

1. Organizer opens Check-In Scanner page.
2. Camera starts and scanner becomes live.
3. Staff scans guest QR code (or manually enters token).
4. System verifies token and guest eligibility.
5. Screen shows result:
- Success: entry allowed with entry counter update.
- Error: clear reason (invalid token, already checked in, entry limit, etc.).
6. Scan history list is updated.

## Flow D: Admin Account Management

1. Admin signs in.
2. Admin opens dashboard and account-related pages.
3. Admin views Admins and Organizers lists.
4. Admin can create, edit, suspend/reactivate, or delete accounts.
5. System prevents dangerous self-actions (for example, self-delete).

## 5. User-Facing Behaviors and Rules

### Authentication and Access
- Dashboard, check-in, and management APIs require sign-in.
- Only management roles can access dashboard pages.
- Only organizers can do event/guest modifications and scanner operations.
- Only admins can manage admin and organizer accounts.

### Ticket and Entry Rules
- Ticket links contain a signed token.
- Invalid, malformed, or expired tokens are rejected.
- Each guest has max entries.
- When max entries is reached, further scans are denied.
- For single-entry guests, second scans return "already checked in".

### Check-In Safety and Concurrency
- If two devices scan the same ticket at the same time, the system still processes safely.
- Only the valid allowed scan succeeds.
- Every scan attempt is logged.

### Rate Limiting
- Scanner verification is rate limited to protect the system.
- If too many scans happen quickly, users see a "Please slow down" style error.

### Real-Time Updates
- Dashboard event stats update in real time.
- Guest management stats and lists update in real time.
- Current known limitation: ticket page itself does not auto-refresh after check-in; guest may need to reload page.

## 6. End-User Navigation Map

### Public Pages
- / : Landing page
- /login : Staff login page (password or magic link)
- /ticket?token=... : Guest ticket page

### Organizer and Admin Dashboard Area
- /dashboard : Main dashboard
- /dashboard/events : Event management
- /dashboard/guests : Guest management

### Admin-Only Account Area
- /dashboard/admins : Admin account list
- /dashboard/admins/create : Create admin
- /dashboard/admins/edit : Edit admin
- /dashboard/admins/suspend-delete : Suspend/delete admin
- /dashboard/organizers : Organizer account list
- /dashboard/organizers/create : Create organizer
- /dashboard/organizers/edit : Edit organizer
- /dashboard/organizers/suspend-delete : Suspend/delete organizer
- /dashboard/users : Privileged account overview

### Organizer-Only Check-In Area
- /check-in : QR scanner and manual verify screen

## 7. Common End-User Outcomes

### Success Outcomes
- Event created successfully.
- Guests imported successfully.
- Guest created or updated successfully.
- Dispatch jobs processed and tickets sent.
- Check-in accepted with updated entry count.

### Common Error Outcomes
- Invalid credentials during sign in.
- Missing/invalid CSV format.
- Event mismatch during check-in.
- Invalid or expired ticket token.
- Entry limit reached.
- Rate limit reached while scanning too quickly.
- Insufficient permissions for attempted action.

## 8. Practical Usage Notes for Teams

1. For event setup, always create event first before guest import.
2. If many tickets are pending, run dispatch from Guests page.
3. Use search and status filters in Guests page to quickly find attendees.
4. For busy entrances, keep scanner open and stable on one active event workflow.
5. If guests ask why ticket still says "Ready" after successful entry, advise them to refresh the ticket page.

## 9. Summary

The system supports a complete event lifecycle for end users:
- admins manage people and oversight,
- organizers manage events, guests, dispatch, and check-in,
- guests receive and present QR tickets for entry.

The core user experience is optimized for fast venue operations, clear role separation, and real-time attendance monitoring.