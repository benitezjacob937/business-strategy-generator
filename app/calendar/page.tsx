"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Step = {
  title?: string;
  summary?: string;
  whatThisDoes?: string[] | string;
  howTo?: string[] | string;
  output?: string;
};

type Plan = {
  id?: string;
  createdAt?: string;
  idea?: string;
  inputs?: Record<string, any>;
  steps?: Step[];
};

type Day = {
  day: number;
  dateLabel: string;
  focus: string;
  tasks: string[];
};

const PLAN_KEY = "bsg_latest_plan_v1";

function safeJsonParse<T = any>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeBullets(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof v === "string")
    return v
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => x.replace(/^\s*[-•\d.)]+\s*/, "").trim());
  return [];
}

function planId(plan: Plan | null): string {
  const base = plan?.id || plan?.idea || "latest";
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `plan_${(h >>> 0).toString(16)}`;
}

function checksKey(id: string) {
  return `bsg_calendar_checks_v1_${id}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function chunkEvenly(items: string[], buckets: number): string[][] {
  const out: string[][] = Array.from({ length: buckets }, () => []);
  if (!items.length) return out;
  for (let i = 0; i < items.length; i++) out[i % buckets].push(items[i]);
  return out;
}

function buildDays(plan: Plan | null): Day[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const steps = Array.isArray(plan?.steps) ? plan!.steps! : [];

  const step1 = steps[0];
  const step2 = steps[1];
  const step3 = steps[2];

  const s1Bullets = [...normalizeBullets(step1?.howTo), ...normalizeBullets(step1?.whatThisDoes)];
  const s2Bullets = [...normalizeBullets(step2?.howTo), ...normalizeBullets(step2?.whatThisDoes)];
  const s3Bullets = [...normalizeBullets(step3?.howTo), ...normalizeBullets(step3?.whatThisDoes)];

  const fallback1 = [
    "Write your one-liner (who + outcome + why you).",
    "Draft landing page: headline + 3 bullets + proof + CTA.",
    "Write FAQs for top objections.",
    "Clarify pricing/packaging and a single CTA.",
  ];
  const fallback2 = [
    "Pick ONE channel for the 14-day sprint.",
    "Create 3 hooks (pain/outcome/differentiator).",
    "Do today’s outreach/content block (30–60 min).",
    "Improve based on responses and iterate hooks.",
    "Follow up within 24 hours.",
    "Track: views → leads → conversions.",
  ];
  const fallback3 = [
    "Collect proof (testimonial/screenshot/case study) and publish it.",
    "Improve activation/onboarding to value fast.",
    "Add a referral ask script and use it.",
    "Review metrics and lock the next sprint.",
  ];

  const block = [
    { title: step1?.title?.trim() || "Step 1: Positioning", days: 4, bullets: s1Bullets.length ? s1Bullets : fallback1 },
    { title: step2?.title?.trim() || "Step 2: Acquisition Sprint", days: 6, bullets: s2Bullets.length ? s2Bullets : fallback2 },
    { title: step3?.title?.trim() || "Step 3: Retention & Proof", days: 4, bullets: s3Bullets.length ? s3Bullets : fallback3 },
  ];

  const days: Day[] = [];
  let n = 1;

  for (const b of block) {
    const buckets = chunkEvenly(b.bullets, b.days);
    for (let i = 0; i < b.days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + (n - 1));
      days.push({
        day: n,
        dateLabel: formatDate(d),
        focus: b.title,
        tasks: buckets[i].length ? buckets[i] : ["Execute the next best action from this step."],
      });
      n++;
    }
  }

  return days.slice(0, 14);
}

async function copyText(txt: string) {
  try {
    await navigator.clipboard.writeText(txt);
    alert("Copied. Paste into Google Docs/Word/Notes and print.");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    alert("Copied. Paste into Google Docs/Word/Notes and print.");
  }
}

export default function CalendarPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pid, setPid] = useState<string>("latest");
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const p = safeJsonParse<Plan>(localStorage.getItem(PLAN_KEY));
    setPlan(p);
    const id = planId(p);
    setPid(id);

    const savedChecks = safeJsonParse<Record<string, boolean>>(localStorage.getItem(checksKey(id)));
    setChecks(savedChecks || {});
  }, []);

  useEffect(() => {
    localStorage.setItem(checksKey(pid), JSON.stringify(checks));
  }, [checks, pid]);

  const days = useMemo(() => buildDays(plan), [plan]);
  const title = plan?.idea?.trim() || "Your plan";
  const createdAt = plan?.createdAt ? new Date(plan.createdAt) : new Date();

  function toggle(day: number, idx: number) {
    const key = `d${day}_t${idx}`;
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function resetChecks() {
    setChecks({});
    localStorage.removeItem(checksKey(pid));
    alert("Calendar checks reset.");
  }

  function calendarToText(): string {
    const lines: string[] = [];
    lines.push("14-Day Marketing Calendar");
    lines.push(`Plan: ${title}`);
    lines.push(`Generated: ${createdAt.toLocaleString()}`);
    lines.push("");

    days.forEach((d) => {
      lines.push(`Day ${d.day} — ${d.dateLabel}`);
      lines.push(`Focus: ${d.focus}`);
      d.tasks.forEach((t) => lines.push(`- ${t}`));
      lines.push("");
    });

    return lines.join("\n");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .print-wrap {
            color: #111 !important;
            background: white !important;
          }
          .print-card {
            border: 1px solid #ddd !important;
            background: white !important;
          }
          .print-muted {
            color: #444 !important;
          }
        }
      `}</style>

      <div className="print-wrap mx-auto max-w-4xl px-4 py-8">
        <div className="no-print flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm font-semibold hover:bg-zinc-900"
          >
            ← Back
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => copyText(calendarToText())}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm font-semibold hover:bg-zinc-900"
            >
              Copy calendar
            </button>

            <button
              onClick={resetChecks}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm font-semibold hover:bg-zinc-900"
            >
              Reset checks
            </button>

            <button
              onClick={() => window.print()}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-105"
            >
              Print
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h1 className="text-3xl font-extrabold tracking-tight">14-Day Marketing Calendar</h1>
          <p className="print-muted mt-2 text-sm text-zinc-400">
            Copy it into Google Docs/Notes and print when you’re ready.
          </p>
        </div>

        {!plan ? (
          <div className="print-card mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="text-sm text-zinc-200">
              <b>No saved plan found.</b>
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              Go back, generate a plan, then return here.
            </div>
          </div>
        ) : (
          <div className="print-card mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Calendar for</div>
            <div className="mt-1 text-xl font-bold">{title}</div>
            <div className="print-muted mt-1 text-xs text-zinc-500">
              Generated: {createdAt.toLocaleString()}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {days.map((d) => (
            <div key={d.day} className="print-card rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-extrabold">Day {d.day}</div>
                  <div className="print-muted mt-1 text-sm text-zinc-400">Focus: {d.focus}</div>
                </div>
                <div className="print-muted text-xs text-zinc-500">{d.dateLabel}</div>
              </div>

              {/* interactive checkboxes (screen) */}
              <div className="no-print mt-3 space-y-2">
                {d.tasks.map((t, idx) => (
                  <label
                    key={idx}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 hover:bg-zinc-950/50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-emerald-500"
                      checked={!!checks[`d${d.day}_t${idx}`]}
                      onChange={() => toggle(d.day, idx)}
                    />
                    <span className={checks[`d${d.day}_t${idx}`] ? "text-zinc-500 line-through" : "text-zinc-200"}>
                      {t}
                    </span>
                  </label>
                ))}
              </div>

              {/* print version (no checkboxes) */}
              <div className="hidden print:block mt-3">
                <ul className="ml-5 list-disc">
                  {d.tasks.map((t, idx) => (
                    <li key={idx} className="text-sm text-zinc-900">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}