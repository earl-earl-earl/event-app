import "server-only";

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

const smsEnabled = Boolean(
  serverEnv.TWILIO_ACCOUNT_SID &&
    serverEnv.TWILIO_AUTH_TOKEN &&
    serverEnv.TWILIO_FROM_NUMBER,
);

const twilioClient = smsEnabled
  ? twilio(serverEnv.TWILIO_ACCOUNT_SID!, serverEnv.TWILIO_AUTH_TOKEN!)
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
  if (!serverEnv.BREVO_API_KEY || !serverEnv.BREVO_FROM_EMAIL) {
    return {
      ok: false,
      error:
        "Email provider not configured. Set BREVO_API_KEY and BREVO_FROM_EMAIL.",
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

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": serverEnv.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          email: serverEnv.BREVO_FROM_EMAIL,
          name: serverEnv.BREVO_FROM_NAME || job.event_name,
        },
        to: [{ email: job.destination, name: `${job.guest_first_name} ${job.guest_last_name}` }],
        subject: `${job.event_name} Ticket`,
        htmlContent: emailBody,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `Brevo API error: ${response.status} - ${errorText}`,
      };
    }

    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      error: typeof error.message === "string" ? error.message : "Email send failed.",
    };
  }
}

async function sendSms(job: DispatchJob): Promise<DispatchResult> {
  if (!smsEnabled || !twilioClient) {
    return { ok: true };
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
