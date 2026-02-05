import { NextResponse } from "next/server";
import { z } from "zod";
import twilio from "twilio";

const requestSchema = z.object({
  contactName: z.string().min(1),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{7,14}$/),
  objective: z.string().min(1),
  scriptStyle: z.enum(["friendly", "direct", "consultative"]),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional()
});

const styleSignOff: Record<"friendly" | "direct" | "consultative", string> = {
  friendly:
    "Thanks again for taking the time today. Looking forward to connecting soon!",
  direct:
    "Please confirm if we can proceed, or let me know the best decision maker to engage.",
  consultative:
    "I appreciate your insights. Let's align on the best path forward together."
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid payload"
      },
      { status: 400 }
    );
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Twilio credentials are missing. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER."
      },
      { status: 500 }
    );
  }

  const { contactName, objective, phoneNumber, scriptStyle, scheduledAt, notes } = parsed.data;
  const now = Date.now();
  const scheduleTime = scheduledAt ? Date.parse(scheduledAt) : undefined;

  if (scheduleTime && Number.isNaN(scheduleTime)) {
    return NextResponse.json(
      { success: false, message: "scheduledAt must be a valid ISO date string." },
      { status: 400 }
    );
  }

  const delaySeconds =
    scheduleTime && scheduleTime > now ? Math.floor((scheduleTime - now) / 1000) : 0;

  if (delaySeconds > 600) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Scheduling more than 10 minutes ahead is not supported by this serverless worker."
      },
      { status: 422 }
    );
  }

  const scriptSegments = [
    `Hi ${contactName}, this is your automated outreach agent calling from our team.`,
    `Objective for today: ${objective}.`,
    notes ? `Notes from the team: ${notes}.` : undefined,
    styleSignOff[scriptStyle]
  ].filter(Boolean) as string[];

  const twiml = buildTwiml(scriptSegments, delaySeconds);
  const client = twilio(accountSid, authToken);

  try {
    const call = await client.calls.create({
      to: phoneNumber,
      from: fromNumber,
      twiml,
      machineDetection: "Enable",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallback: process.env.TWILIO_STATUS_WEBHOOK_URL
    });

    return NextResponse.json({
      success: true,
      message: delaySeconds
        ? `Call scheduled in ${delaySeconds} seconds.`
        : "Call initiated successfully.",
      callSid: call.sid,
      status: delaySeconds ? "queued" : "in-progress"
    });
  } catch (error) {
    console.error("[call-agent] Failed to create call", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? `Twilio error: ${error.message}`
            : "Unknown error while creating Twilio call."
      },
      { status: 502 }
    );
  }
}

function buildTwiml(lines: string[], delaySeconds: number) {
  const voice = "Polly.Joanna";
  const pause = delaySeconds
    ? `<Pause length="${Math.min(delaySeconds, 600)}" />`
    : "";
  const sayBlocks = lines
    .map(line => `<Say voice="${voice}">${escapeForTwiml(line)}</Say>`)
    .join("");

  return `<Response>${pause}${sayBlocks}<Hangup/></Response>`;
}

function escapeForTwiml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
