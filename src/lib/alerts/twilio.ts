// Send an SMS via Twilio's REST API using only fetch (no SDK). Requires:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (a Twilio number),
//   ALERT_TO (your phone, e.g. +16464621236)
// When any are missing, sending is a no-op that reports back why — so a
// misconfigured cron fails loud in logs instead of silently doing nothing.

export type SmsResult =
  | { ok: true; sid: string }
  | { ok: false; reason: string };

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM &&
      process.env.ALERT_TO,
  );
}

export async function sendSms(body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const to = process.env.ALERT_TO;
  if (!sid || !token || !from || !to) {
    return { ok: false, reason: "Twilio env vars not fully configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams({ To: to, From: from, Body: body });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const json = (await res.json()) as { sid?: string; message?: string };
    if (!res.ok) {
      return { ok: false, reason: json.message ?? `Twilio HTTP ${res.status}` };
    }
    return { ok: true, sid: json.sid ?? "sent" };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "send failed",
    };
  }
}
