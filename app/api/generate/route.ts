import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Inputs = {
  targetCustomer?: string;
  coreOffer?: string;
  differentiator?: string;
  pricePoint?: string;
  geography?: string;
  goal14Day?: string;
  notes?: string;
};

type PlanStep = {
  title: string;
  summary: string;
  whatThisDoes: string[]; // explanation bullets (or short paragraphs)
  howTo: string[];        // checklist bullets
  output: string;         // tangible deliverable
};

type CalendarDay = {
  day: number;            // 1..14
  title: string;
  tasks: string[];
};

type PlanObject = {
  id: string;
  createdAt: string;
  idea: string;
  inputs: Inputs;
  steps: PlanStep[];
  calendarDays: CalendarDay[];
};

function uid() {
  return "plan_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function cleanStr(x: unknown) {
  return typeof x === "string" ? x.trim() : "";
}

function ensureArrayOfStrings(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
}

function coercePlan(raw: any, idea: string, inputs: Inputs): PlanObject {
  const stepsRaw = Array.isArray(raw?.steps) ? raw.steps : [];
  const steps: PlanStep[] = stepsRaw.slice(0, 3).map((s: any, i: number) => ({
    title: cleanStr(s?.title) || `Step ${i + 1}`,
    summary: cleanStr(s?.summary) || "",
    whatThisDoes: ensureArrayOfStrings(s?.whatThisDoes),
    howTo: ensureArrayOfStrings(s?.howTo),
    output: cleanStr(s?.output) || "",
  }));

  // fallback if model returns weak structure
  while (steps.length < 3) {
    steps.push({
      title: `Step ${steps.length + 1}`,
      summary: "",
      whatThisDoes: [],
      howTo: [],
      output: "",
    });
  }

  const calRaw = Array.isArray(raw?.calendarDays) ? raw.calendarDays : [];
  const calendarDays: CalendarDay[] = calRaw
    .filter((d: any) => typeof d === "object" && d)
    .slice(0, 14)
    .map((d: any, idx: number) => ({
      day: typeof d?.day === "number" ? d.day : idx + 1,
      title: cleanStr(d?.title) || `Day ${idx + 1}`,
      tasks: ensureArrayOfStrings(d?.tasks),
    }));

  while (calendarDays.length < 14) {
    const n = calendarDays.length + 1;
    calendarDays.push({
      day: n,
      title: `Day ${n}`,
      tasks: ["Do 30–60 minutes of execution based on your Step plan."],
    });
  }

  return {
    id: cleanStr(raw?.id) || uid(),
    createdAt: cleanStr(raw?.createdAt) || new Date().toISOString(),
    idea: cleanStr(raw?.idea) || idea,
    inputs: typeof raw?.inputs === "object" && raw?.inputs ? raw.inputs : inputs,
    steps,
    calendarDays,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const idea = cleanStr(body?.idea);

    const inputs: Inputs = {
      targetCustomer: cleanStr(body?.targetCustomer),
      coreOffer: cleanStr(body?.coreOffer),
      differentiator: cleanStr(body?.differentiator),
      pricePoint: cleanStr(body?.pricePoint),
      geography: cleanStr(body?.geography),
      goal14Day: cleanStr(body?.goal14Day),
      notes: cleanStr(body?.notes),
    };

    if (!idea) {
      return NextResponse.json({ error: "Missing business idea" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const system = `
You are a senior growth strategist.
Return ONLY valid JSON. No markdown. No extra commentary.

Goal:
- Create a 3-step plan where EACH step includes:
  - title
  - summary (1–2 sentences)
  - whatThisDoes (2–5 explanation bullets, practical)
  - howTo (6–10 actionable checklist bullets with specifics)
  - output (one concrete deliverable)

Also return a 14-day calendar that adapts to the plan.
Each day includes:
- day (1..14)
- title
- tasks (2–4 tasks, specific and doable)

IMPORTANT: Make the plan and calendar specific to the business idea and the optional inputs.
`;

    const user = `
Business idea: ${idea}

Optional inputs:
- Target customer: ${inputs.targetCustomer || "(not provided)"}
- Core offer: ${inputs.coreOffer || "(not provided)"}
- Differentiator: ${inputs.differentiator || "(not provided)"}
- Price point: ${inputs.pricePoint || "(not provided)"}
- Geography / market: ${inputs.geography || "(not provided)"}
- 14-day goal: ${inputs.goal14Day || "(not provided)"}
- Extra notes: ${inputs.notes || "(not provided)"}

Return JSON in this exact shape:
{
  "id": "string",
  "createdAt": "ISO string",
  "idea": "string",
  "inputs": {
    "targetCustomer": "string",
    "coreOffer": "string",
    "differentiator": "string",
    "pricePoint": "string",
    "geography": "string",
    "goal14Day": "string",
    "notes": "string"
  },
  "steps": [
    {
      "title": "string",
      "summary": "string",
      "whatThisDoes": ["string"],
      "howTo": ["string"],
      "output": "string"
    }
  ],
  "calendarDays": [
    { "day": 1, "title": "string", "tasks": ["string"] }
  ]
}
`;

    // Use Chat Completions with strict JSON object output
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system.trim() },
          { role: "user", content: user.trim() },
        ],
      }),
    });

    if (!resp.ok) {
      const raw = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `OpenAI request failed (${resp.status})`, raw },
        { status: 500 }
      );
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? "";

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Model did not return valid JSON. Try again.", raw: String(text).slice(0, 2000) },
        { status: 500 }
      );
    }

    const plan = coercePlan(parsed, idea, inputs);
    return NextResponse.json(plan);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}