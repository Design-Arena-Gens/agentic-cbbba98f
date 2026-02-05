"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { clsx } from "clsx";

const callRequestSchema = z.object({
  contactName: z.string().min(2, "Contact name is required"),
  phoneNumber: z
    .string()
    .regex(
      /^\+?[1-9]\d{7,14}$/,
      "Provide a valid E.164 formatted number (e.g. +15551234567)"
    ),
  objective: z.string().min(3, "Share a brief objective for the call"),
  scriptStyle: z.enum(["friendly", "direct", "consultative"]),
  scheduledAt: z.string().optional(),
  notes: z.string().optional()
});

type CallRequest = z.infer<typeof callRequestSchema>;

type CallLog = CallRequest & {
  id: string;
  status: "queued" | "in-progress" | "completed" | "failed";
  createdAt: string;
  message?: string;
  confirmationSid?: string;
};

const stylePresets: Record<
  CallRequest["scriptStyle"],
  { heading: string; tone: string; closing: string }
> = {
  friendly: {
    heading: "Warm introduction",
    tone: "Conversational tone, emphasize rapport building and value.",
    closing:
      "Thank them for their time and confirm next steps with a positive note."
  },
  direct: {
    heading: "Concise opener",
    tone: "To-the-point delivery, focus on clear ROI and decision making.",
    closing:
      "Ask directly for commitment and provide a clear channel for follow-up."
  },
  consultative: {
    heading: "Insight-led opening",
    tone: "Empathetic, question-driven tone highlighting tailored insights.",
    closing:
      "Summarize diagnosed needs and recommend a collaborative next step."
  }
};

export default function HomePage() {
  const [form, setForm] = useState<CallRequest>({
    contactName: "",
    phoneNumber: "",
    objective: "",
    scriptStyle: "consultative",
    scheduledAt: "",
    notes: ""
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CallRequest, string>>>({});
  const [script, setScript] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [callLog, setCallLog] = useState<CallLog[]>([]);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; message: string }>();

  useEffect(() => {
    const saved = window.localStorage.getItem("calling-agent:log");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CallLog[];
        setCallLog(parsed);
      } catch {
        window.localStorage.removeItem("calling-agent:log");
      }
    }
  }, []);

  useEffect(() => {
    if (callLog.length) {
      window.localStorage.setItem("calling-agent:log", JSON.stringify(callLog));
    }
  }, [callLog]);

  useEffect(() => {
    setScript(generateScript(form));
  }, [form]);

  const scheduledLabel = useMemo(() => {
    if (!form.scheduledAt) return "Send immediately";
    const time = new Date(form.scheduledAt);
    if (Number.isNaN(time.getTime())) return "Send immediately";
    return `Scheduled for ${time.toLocaleString()}`;
  }, [form.scheduledAt]);

  const handleChange = <K extends keyof CallRequest>(key: K, value: CallRequest[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setBanner(undefined);
    const result = callRequestSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CallRequest, string>> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as keyof CallRequest] = issue.message;
        }
      }
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    const payload: CallRequest = {
      ...form,
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      notes: form.notes?.trim() ? form.notes.trim() : undefined
    };

    try {
      const response = await fetch("/api/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as {
        success: boolean;
        message: string;
        callSid?: string;
        status?: CallLog["status"];
      };

      const logItem: CallLog = {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: data.status ?? (data.success ? "queued" : "failed"),
        message: data.message,
        confirmationSid: data.callSid
      };

      setCallLog(prev => [logItem, ...prev].slice(0, 20));
      setBanner({
        tone: data.success ? "success" : "error",
        message: data.message
      });
      if (data.success) {
        setForm(prev => ({
          ...prev,
          notes: "",
          objective: prev.objective,
          scheduledAt: ""
        }));
      }
    } catch (error) {
      console.error(error);
      setBanner({
        tone: "error",
        message:
          "We could not reach the calling service. Confirm your environment variables and network access."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="space-y-3 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
          Live outreach orchestrator
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Launch calls with an AI-powered agent
        </h1>
        <p className="mx-auto max-w-2xl text-base text-slate-300">
          Craft a goal-oriented script, schedule or trigger an outbound call, and maintain a
          timeline of outreach history without leaving the dashboard.
        </p>
      </header>

      {banner && (
        <div
          className={clsx(
            "rounded-xl border px-4 py-3 text-sm shadow-lg",
            banner.tone === "success"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/50 bg-rose-500/10 text-rose-200"
          )}
        >
          {banner.message}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-5">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl"
        >
          <div className="space-y-6 p-6">
            <div className="space-y-1">
              <label htmlFor="contactName" className="text-xs uppercase text-slate-400">
                Contact name
              </label>
              <input
                id="contactName"
                value={form.contactName}
                onChange={event => handleChange("contactName", event.target.value)}
                placeholder="Jane Smith"
                className={inputClass(errors.contactName)}
              />
              {errors.contactName && <p className="text-xs text-rose-400">{errors.contactName}</p>}
            </div>

            <div className="space-y-1">
              <label htmlFor="phoneNumber" className="text-xs uppercase text-slate-400">
                Phone number
              </label>
              <input
                id="phoneNumber"
                value={form.phoneNumber}
                onChange={event => handleChange("phoneNumber", event.target.value)}
                placeholder="+15551234567"
                className={inputClass(errors.phoneNumber)}
              />
              {errors.phoneNumber && <p className="text-xs text-rose-400">{errors.phoneNumber}</p>}
            </div>

            <div className="space-y-1">
              <label htmlFor="objective" className="text-xs uppercase text-slate-400">
                Call objective
              </label>
              <textarea
                id="objective"
                value={form.objective}
                onChange={event => handleChange("objective", event.target.value)}
                placeholder="Confirm availability for a product discovery session."
                className={clsx(inputClass(errors.objective), "min-h-[120px]")}
              />
              {errors.objective && <p className="text-xs text-rose-400">{errors.objective}</p>}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs uppercase text-slate-400">Script style</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(stylePresets).map(([style, meta]) => (
                  <label
                    key={style}
                    className={clsx(
                      "cursor-pointer rounded-xl border px-4 py-3 text-left text-sm transition",
                      form.scriptStyle === style
                        ? "border-slate-400 bg-slate-800/80"
                        : "border-transparent bg-slate-900/60 hover:border-slate-700"
                    )}
                  >
                    <input
                      type="radio"
                      name="scriptStyle"
                      value={style}
                      checked={form.scriptStyle === style}
                      onChange={() =>
                        handleChange("scriptStyle", style as CallRequest["scriptStyle"])
                      }
                      className="sr-only"
                    />
                    <p className="font-medium capitalize text-slate-100">{style}</p>
                    <p className="text-xs text-slate-400">{meta.tone}</p>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="scheduledAt" className="text-xs uppercase text-slate-400">
                  Schedule (optional)
                </label>
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={event => handleChange("scheduledAt", event.target.value)}
                  className={inputClass()}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-xs text-slate-500">{scheduledLabel}</p>
              </div>

              <div className="space-y-1">
                <label htmlFor="notes" className="text-xs uppercase text-slate-400">
                  Internal notes
                </label>
                <textarea
                  id="notes"
                  value={form.notes ?? ""}
                  onChange={event => handleChange("notes", event.target.value)}
                  placeholder="Context, CRM link, or fallback instructions."
                  className={clsx(inputClass(), "min-h-[96px]")}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/80 px-6 py-4">
            <div className="text-xs text-slate-400">
              {form.scheduledAt ? "Scheduled call" : "Instant call"} • {scheduledLabel}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {loading ? "Queueing..." : "Deploy agent call"}
            </button>
          </div>
        </form>

        <aside className="lg:col-span-2 flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl">
            <header className="space-y-1">
              <p className="text-xs uppercase text-slate-400">{stylePresets[form.scriptStyle].heading}</p>
              <h2 className="text-xl font-semibold">Suggested conversation flow</h2>
              <p className="text-sm text-slate-400">
                Review and adapt before launch. Perfect for handing over to a human agent or
                confirming the AI prompt.
              </p>
            </header>
            <pre className="mt-4 max-h-[320px] overflow-auto rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-relaxed text-slate-200">
              {script}
            </pre>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl">
            <header className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent launches</h2>
              <button
                className="text-xs text-slate-400 underline decoration-dotted underline-offset-4 transition hover:text-slate-200"
                onClick={() => setCallLog([])}
              >
                Clear
              </button>
            </header>
            <div className="mt-4 space-y-4">
              {callLog.length === 0 && (
                <p className="text-sm text-slate-400">
                  Calls launched from this dashboard will appear here with delivery status.
                </p>
              )}

              {callLog.map(log => (
                <article
                  key={log.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200"
                >
                  <header className="flex items-center justify-between text-xs text-slate-400">
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                    <StatusBadge status={log.status} />
                  </header>
                  <div className="mt-2 font-medium text-slate-100">
                    {log.contactName} · {log.phoneNumber}
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{log.objective}</p>
                  {log.notes && (
                    <p className="mt-2 rounded-lg bg-slate-900/80 p-2 text-xs text-slate-400">
                      Notes: {log.notes}
                    </p>
                  )}
                  {log.message && (
                    <p className="mt-2 text-xs text-slate-400">Agent: {log.message}</p>
                  )}
                  {log.confirmationSid && (
                    <p className="mt-2 text-xs text-slate-500">Call SID: {log.confirmationSid}</p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function inputClass(hasError?: string) {
  return clsx(
    "w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 placeholder:text-slate-500",
    hasError && "border-rose-500 focus:border-rose-400 focus:ring-rose-500/40"
  );
}

function generateScript(form: CallRequest) {
  const segments = [
    `👋 Intro\n"Hi ${form.contactName || "there"}, this is your outreach agent calling on behalf of our team. Do you have a quick minute to talk?"`,
    `🎯 Objective\n"${form.objective || "I'd love to share why I'm reaching out and explore how we can collaborate."}"`,
    `🧠 Tone\n${stylePresets[form.scriptStyle].tone}`,
    `🗺️ Flow\n1. Establish rapport and confirm context.\n2. Share key value proposition tailored to the contact.\n3. Ask one high-impact question to surface needs.\n4. Offer next step aligned with the objective.\n5. Confirm best follow-up channel and availability.`,
    `✅ Closing\n${stylePresets[form.scriptStyle].closing}`,
    form.notes ? `📝 Notes from you\n${form.notes}` : undefined
  ].filter(Boolean);

  return segments.join("\n\n");
}

function StatusBadge({ status }: { status: CallLog["status"] }) {
  const palette = {
    queued: "bg-sky-500/10 text-sky-300 border-sky-500/40",
    "in-progress": "bg-amber-500/10 text-amber-300 border-amber-500/40",
    completed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
    failed: "bg-rose-500/10 text-rose-300 border-rose-500/40"
  } as const;

  return (
    <span className={clsx("rounded-full border px-2 py-1 uppercase tracking-wide", palette[status])}>
      {status.replace("-", " ")}
    </span>
  );
}
