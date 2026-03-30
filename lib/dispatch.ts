import "server-only";

import { Resend } from "resend";
import twilio from "twilio";

import { serverEnv } from "@/lib/env/server";

export interface DispatchJob {
  id: number;
  channel: "email" | "sms";
  destination: string;
  ticket_link: string;
  attempts: number;
  guest_first_name: string;
  guest_last_name: string;
  event_name: string;
  event_date: string;
  event_location: string;
}

export interface DispatchResult {
  ok: boolean;
  error?: string;
}

const resendClient = serverEnv.RESEND_API_KEY
  ? new Resend(serverEnv.RESEND_API_KEY)
  : null;

const twilioClient =
  serverEnv.TWILIO_ACCOUNT_SID && serverEnv.TWILIO_AUTH_TOKEN
    ? twilio(serverEnv.TWILIO_ACCOUNT_SID, serverEnv.TWILIO_AUTH_TOKEN)
    : null;

function formatDate(dateString: string): string {
  const value = new Date(dateString);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

async function sendEmail(job: DispatchJob): Promise<DispatchResult> {
  if (!resendClient || !serverEnv.RESEND_FROM_EMAIL) {
    return {
      ok: false,
      error:
        "Email provider not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
    };
  }

  const eventDate = formatDate(job.event_date);

  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Your Ticket for ${job.event_name}</h2>
      <p>Hello ${job.guest_first_name} ${job.guest_last_name},</p>
      <p>Your event ticket is ready. Open your ticket link below to display your QR code at the venue.</p>
      <p><strong>Event:</strong> ${job.event_name}<br/>
         <strong>Date:</strong> ${eventDate || "TBD"}<br/>
         <strong>Location:</strong> ${job.event_location}</p>
      <p><a href="${job.ticket_link}">${job.ticket_link}</a></p>
      <p>Please keep this link private.</p>
    </div>
  `;

  const { error } = await resendClient.emails.send({
    from: serverEnv.RESEND_FROM_EMAIL,
    to: [job.destination],
    subject: `${job.event_name} Ticket`,
    html: emailBody,
  });

  if (error) {
    return {
      ok: false,
      error: typeof error.message === "string" ? error.message : "Email send failed.",
    };
  }

  return { ok: true };
}

async function sendSms(job: DispatchJob): Promise<DispatchResult> {
  if (!twilioClient || !serverEnv.TWILIO_FROM_NUMBER) {
    return {
      ok: false,
      error:
        "SMS provider not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.",
    };
  }

  const eventDate = formatDate(job.event_date);

  try {
    await twilioClient.messages.create({
      from: serverEnv.TWILIO_FROM_NUMBER,
      to: job.destination,
      body:
        `${job.event_name} ticket for ${job.guest_first_name} ${job.guest_last_name}. ` +
        `${eventDate ? `Date: ${eventDate}. ` : ""}` +
        `Ticket link: ${job.ticket_link}`,
    });

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SMS send failed with unknown error.";

    return {
      ok: false,
      error: message,
    };
  }
}

export async function dispatchTicket(job: DispatchJob): Promise<DispatchResult> {
  if (job.channel === "email") {
    return sendEmail(job);
  }

  return sendSms(job);
}
