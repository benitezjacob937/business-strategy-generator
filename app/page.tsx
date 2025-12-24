"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Inputs = {
  targetCustomer?: string;
  coreOffer?: string;
  differentiator?: string;
  pricePoint?: string;
  geography?: string;
  goal14Day?: string;
  notes?: string;
};

type Step = {
  title: string;
  summary: string;
  whatThisDoes: string[];
  howTo: string[];
  output: string;
};

type Plan = {
  id: string;
  createdAt: string;
  idea: string;
  inputs: Inputs;
  steps: Step[];
};

const LS_PLAN_KEY = "bsg_latest_plan_v1";

function safeStr(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function toStrArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => safeStr(x)).filter(Boolean);

  if (typeof v === "string")
    return v
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => x.replace(/^\s*[-•\d.)]+\s*/, "").trim());

  return [];
}

function coercePlan(raw: any, ideaFallback: string, inputsFallback: Inputs): Plan {
  const id =
    safeStr(raw?.id) || `plan_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const createdAt = safeStr(raw?.createdAt) || new Date().toISOString();
  const idea = safeStr(raw?.idea) || ideaFallback;

  const inputsRaw = raw?.inputs && typeof raw.inputs === "object" ? raw.inputs : {};
  const inputs: Inputs = {
    targetCustomer:
      safeStr(inputsRaw?.targetCustomer) ||
      safeStr((raw as any)?.targetCustomer) ||
      inputsFallback.targetCustomer,
    coreOffer:
      safeStr(inputsRaw?.coreOffer) ||
      safeStr((raw as any)?.coreOffer) ||
      inputsFallback.coreOffer,
    differentiator:
      safeStr(inputsRaw?.differentiator) ||
      safeStr((raw as any)?.differentiator) ||
      inputsFallback.differentiator,
    pricePoint:
      safeStr(inputsRaw?.pricePoint) ||
      safeStr((raw as any)?.pricePoint) ||
      inputsFallback.pricePoint,
    geography:
      safeStr(inputsRaw?.geography) ||
      safeStr((raw as any)?.geography) ||
      inputsFallback.geography,
    goal14Day:
      safeStr(inputsRaw?.goal14Day) ||
      safeStr((raw as any)?.goal14Day) ||
      inputsFallback.goal14Day,
    notes:
      safeStr(inputsRaw?.notes) ||
      safeStr((raw as any)?.notes) ||
      inputsFallback.notes,
  };

  const stepsRaw = Array.isArray(raw?.steps) ? raw.steps : [];
  const steps: Step[] = stepsRaw.slice(0, 3).map((s: any, i: number) => ({
    title: safeStr(s?.title) || `Step ${i + 1}`,
    summary: safeStr(s?.summary) || "",
    whatThisDoes: toStrArray(s?.whatThisDoes ?? s?.what ?? s?.explain),
    howTo: toStrArray(s?.howTo ?? s?.how_to ?? s?.checklist),
    output: safeStr(s?.output ?? s?.deliverable) || "",
  }));

  while (steps.length < 3) {
    steps.push({
      title: `Step ${steps.length + 1}`,
      summary: "",
      whatThisDoes: [],
      howTo: [],
      output: "",
    });
  }

  return { id, createdAt, idea, inputs, steps: steps.slice(0, 3) };
}

function planToText(plan: Plan): string {
  const lines: string[] = [];
  lines.push("ProfitBot — AI Business Plan Generator");
  lines.push(`Idea: ${plan.idea}`);
  lines.push(`Generated: ${new Date(plan.createdAt).toLocaleString()}`);
  lines.push("");

  const i = plan.inputs || {};
  const inputLines = [
    i.targetCustomer ? `Target customer: ${i.targetCustomer}` : "",
    i.coreOffer ? `Core offer: ${i.coreOffer}` : "",
    i.differentiator ? `Differentiator: ${i.differentiator}` : "",
    i.pricePoint ? `Price point: ${i.pricePoint}` : "",
    i.geography ? `Geography: ${i.geography}` : "",
    i.goal14Day ? `14-day goal: ${i.goal14Day}` : "",
    i.notes ? `Notes: ${i.notes}` : "",
  ].filter(Boolean);

  if (inputLines.length) {
    lines.push("Inputs");
    inputLines.forEach((x) => lines.push(`- ${x}`));
    lines.push("");
  }

  plan.steps.forEach((s, idx) => {
    lines.push(`Step ${idx + 1}: ${s.title}`);
    if (s.summary) lines.push(s.summary);
    lines.push("");

    if (s.whatThisDoes?.length) {
      lines.push("What this step does:");
      s.whatThisDoes.forEach((b) => lines.push(`- ${b}`));
      lines.push("");
    }

    if (s.howTo?.length) {
      lines.push("How to do it (checklist):");
      s.howTo.forEach((b) => lines.push(`- ${b}`));
      lines.push("");
    }

    if (s.output) {
      lines.push(`Output: ${s.output}`);
      lines.push("");
    }

    lines.push("--------------------------------------------------");
    lines.push("");
  });

  return lines.join("\n");
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

export default function Page() {
  const router = useRouter();

  const [idea, setIdea] = useState("");
  const [inputs, setInputs] = useState<Inputs>({
    targetCustomer: "",
    coreOffer: "",
    differentiator: "",
    pricePoint: "",
    geography: "",
    goal14Day: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);

  const canGoCalendar = useMemo(() => !!plan, [plan]);

  async function onGenerate() {
    setError("");
    const ideaTrimmed = idea.trim();
    if (!ideaTrimmed) {
      setError("Type a business idea first.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: ideaTrimmed,
          targetCustomer: inputs.targetCustomer || "",
          coreOffer: inputs.coreOffer || "",
          differentiator: inputs.differentiator || "",
          pricePoint: inputs.pricePoint || "",
          geography: inputs.geography || "",
          goal14Day: inputs.goal14Day || "",
          notes: inputs.notes || "",
        }),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data) {
        setError(data?.error || `Generate failed (${resp.status})`);
        return;
      }

      const nextPlan = coercePlan(data, ideaTrimmed, inputs);
      setPlan(nextPlan);
      localStorage.setItem(LS_PLAN_KEY, JSON.stringify(nextPlan));
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setIdea("");
    setInputs({
      targetCustomer: "",
      coreOffer: "",
      differentiator: "",
      pricePoint: "",
      geography: "",
      goal14Day: "",
      notes: "",
    });
    setPlan(null);
    setError("");
    localStorage.removeItem(LS_PLAN_KEY);
  }

  function goCalendar() {
    router.push("/calendar");
  }

  function onCopyPlan() {
    if (!plan) return;
    copyText(planToText(plan));
  }

  function onPrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
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

      <div className="print-wrap mx-auto max-w-4xl px-6 py-10">
        {/* top tags */}
        <div className="no-print mb-6 flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Generator
          </div>

          {/* brand label */}
          <div className="text-sm font-semibold text-zinc-300">ProfitBot</div>
        </div>

        {/* headline */}
        <h1 className="text-4xl font-extrabold tracking-tight">
          AI Business Plan Generator
        </h1>
        <p className="mt-3 text-zinc-300">
          Generate a 3-step plan with detailed how-to checklists, then use the 14-day
          calendar.
        </p>

        {/* INPUTS */}
        <div className="no-print mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <label className="text-sm font-medium text-zinc-200">Business idea</label>
          <textarea
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm outline-none focus:border-emerald-500/60"
            rows={4}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Example: Mobile car detailing for busy parents in Austin"
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Field
              label="Target customer"
              value={inputs.targetCustomer || ""}
              onChange={(v) => setInputs((p) => ({ ...p, targetCustomer: v }))}
            />
            <Field
              label="Core offer"
              value={inputs.coreOffer || ""}
              onChange={(v) => setInputs((p) => ({ ...p, coreOffer: v }))}
            />
            <Field
              label="Differentiator"
              value={inputs.differentiator || ""}
              onChange={(v) => setInputs((p) => ({ ...p, differentiator: v }))}
            />
            <Field
              label="Price point"
              value={inputs.pricePoint || ""}
              onChange={(v) => setInputs((p) => ({ ...p, pricePoint: v }))}
            />
            <Field
              label="Geography / market"
              value={inputs.geography || ""}
              onChange={(v) => setInputs((p) => ({ ...p, geography: v }))}
            />
            <Field
              label="14-day goal"
              value={inputs.goal14Day || ""}
              onChange={(v) => setInputs((p) => ({ ...p, goal14Day: v }))}
            />
          </div>

          <label className="mt-4 block text-sm font-medium text-zinc-200">
            Notes (optional)
          </label>
          <textarea
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm outline-none focus:border-emerald-500/60"
            rows={3}
            value={inputs.notes || ""}
            onChange={(e) => setInputs((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Budget, constraints, timeline, what you’ve tried..."
          />

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={onGenerate}
              disabled={loading}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
            >
              {loading ? "Generating..." : "Generate 3-Step Plan"}
            </button>

            <button
              onClick={clearAll}
              className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-sm font-semibold hover:border-zinc-700"
            >
              Clear / New idea
            </button>

            <button
              onClick={goCalendar}
              disabled={!canGoCalendar}
              className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-sm font-semibold hover:border-zinc-700 disabled:opacity-50"
            >
              Go to 14-Day Calendar
            </button>

            <button
              onClick={onCopyPlan}
              disabled={!plan}
              className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-sm font-semibold hover:border-zinc-700 disabled:opacity-50"
            >
              Copy plan
            </button>

            <button
              onClick={onPrint}
              disabled={!plan}
              className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-sm font-semibold hover:border-zinc-700 disabled:opacity-50"
            >
              Print
            </button>
          </div>

          {error ? (
            <div className="mt-3 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        {/* OUTPUT */}
        {plan ? (
          <div className="mt-8 space-y-4">
            <div className="print-card rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="text-xs text-zinc-400 print-muted">
                Plan ID: {plan.id}
              </div>
              <div className="mt-1 text-xl font-bold">{plan.idea}</div>
              <div className="mt-1 text-xs text-zinc-500 print-muted">
                Generated: {new Date(plan.createdAt).toLocaleString()}
              </div>
            </div>

            {plan.steps.map((s, idx) => (
              <div
                key={idx}
                className="print-card rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5"
              >
                <div className="text-xs font-semibold text-emerald-300 no-print">
                  STEP {idx + 1}
                </div>
                <div className="text-lg font-extrabold">
                  Step {idx + 1}: {s.title}
                </div>

                {s.summary ? (
                  <div className="print-muted mt-2 text-sm text-zinc-300">
                    {s.summary}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3">
                  <Section title="What this step does" bullets={s.whatThisDoes} />
                  <Section
                    title="How to do it (checklist)"
                    bullets={s.howTo}
                    checkboxStyle
                  />
                  {s.output ? (
                    <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 print-card">
                      <div className="text-sm font-semibold text-zinc-200">
                        Output
                      </div>
                      <div className="print-muted mt-2 text-sm text-zinc-300">
                        {s.output}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-200">{label}</label>
      <input
        className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm outline-none focus:border-emerald-500/60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="(optional)"
      />
    </div>
  );
}

function Section({
  title,
  bullets,
  checkboxStyle,
}: {
  title: string;
  bullets: string[];
  checkboxStyle?: boolean;
}) {
  const items = (bullets || []).filter(Boolean);

  return (
    <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 print-card">
      <div className="text-sm font-semibold text-zinc-200">{title}</div>

      {items.length ? (
        <ul className="print-muted mt-2 space-y-2 text-sm text-zinc-300">
          {items.map((b, i) => (
            <li key={i} className="leading-relaxed">
              {checkboxStyle ? `□ ${b}` : `• ${b}`}
            </li>
          ))}
        </ul>
      ) : (
        <div className="print-muted mt-2 text-sm text-zinc-500">
          No details returned for this section.
        </div>
      )}
    </div>
  );
}