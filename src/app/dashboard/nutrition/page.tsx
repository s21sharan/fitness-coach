"use client";

import { useEffect, useState } from "react";

type ParsedFood = {
  source: "nutritionix";
  source_id: string | null;
  name: string;
  brand: string | null;
  serving_qty: number;
  serving_unit: string;
  serving_grams: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
};

type Entry = {
  id: string;
  logged_at: string;
  meal_slot: string | null;
  description: string | null;
  servings: number;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

type Today = {
  date: string;
  entries: Entry[];
  totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  expenditure: {
    wearable_kcal: number | null;
    estimated_kcal: number | null;
    tdee_kcal: number | null;
    correction_k: number | null;
    source: string;
  } | null;
  energy_balance: number | null;
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
};

export default function NutritionPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState<Today | null>(null);
  const [query, setQuery] = useState("");
  const [parsed, setParsed] = useState<ParsedFood[]>([]);
  const [busy, setBusy] = useState(false);
  const [weight, setWeight] = useState("");

  async function refresh() {
    const res = await fetch(`/api/nutrition/today?date=${today}`);
    setData(await res.json());
  }

  useEffect(() => { refresh(); }, []);

  async function parse() {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/nutrition/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      setParsed(json.foods ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function logParsed() {
    if (parsed.length === 0) return;
    await fetch("/api/nutrition/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: parsed.map((f) => ({ food: f, servings: 1, source: "search", description: f.name })),
      }),
    });
    setQuery("");
    setParsed([]);
    refresh();
  }

  async function logManual(form: FormData) {
    const payload = {
      description: String(form.get("description") || "manual"),
      calories: Number(form.get("calories") || 0),
      protein: Number(form.get("protein") || 0),
      carbs: Number(form.get("carbs") || 0),
      fat: Number(form.get("fat") || 0),
      source: "manual" as const,
    };
    await fetch("/api/nutrition/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    refresh();
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/nutrition/log?id=${id}`, { method: "DELETE" });
    refresh();
  }

  async function submitWeight() {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) return;
    await fetch("/api/weigh-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight_lbs: w, date: today }),
    });
    setWeight("");
  }

  const totals = data?.totals;
  const tdee = data?.expenditure?.tdee_kcal ?? data?.expenditure?.wearable_kcal ?? null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Nutrition</h1>

      {/* Daily totals */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Today — {today}</h2>
          {tdee != null && (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              TDEE {Math.round(Number(tdee))} kcal
              {data?.expenditure?.correction_k != null && ` (k=${Number(data.expenditure.correction_k).toFixed(2)})`}
            </div>
          )}
        </div>
        {totals && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
            <Stat label="Calories" value={`${Math.round(totals.calories)}`} sub={tdee != null ? `${Math.round(Number(tdee) - totals.calories)} left` : undefined} />
            <Stat label="Protein" value={`${Math.round(totals.protein)}g`} />
            <Stat label="Carbs" value={`${Math.round(totals.carbs)}g`} />
            <Stat label="Fat" value={`${Math.round(totals.fat)}g`} />
          </div>
        )}
      </div>

      {/* NL log */}
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Log food</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && parse()}
            placeholder="e.g. 200g chicken breast and a cup of rice"
            style={{ flex: 1, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8 }}
          />
          <button onClick={parse} disabled={busy} style={btn}>{busy ? "…" : "Parse"}</button>
        </div>
        {parsed.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {parsed.map((f, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
                  <span>{f.serving_qty} {f.serving_unit} {f.name}</span>
                  <span style={{ color: "#6b7280" }}>{Math.round(f.calories || 0)} kcal · P{Math.round(f.protein || 0)} C{Math.round(f.carbs || 0)} F{Math.round(f.fat || 0)}</span>
                </li>
              ))}
            </ul>
            <button onClick={logParsed} style={{ ...btn, marginTop: 8 }}>Log all</button>
          </div>
        )}
      </div>

      {/* Manual entry */}
      <details style={card}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Manual entry</summary>
        <form
          onSubmit={(e) => { e.preventDefault(); logManual(new FormData(e.currentTarget)); (e.currentTarget as HTMLFormElement).reset(); }}
          style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 12 }}
        >
          <input name="description" placeholder="Description" style={input} />
          <input name="calories" type="number" placeholder="kcal" style={input} />
          <input name="protein" type="number" placeholder="P" style={input} />
          <input name="carbs" type="number" placeholder="C" style={input} />
          <input name="fat" type="number" placeholder="F" style={input} />
          <button type="submit" style={{ ...btn, gridColumn: "span 5" }}>Add</button>
        </form>
      </details>

      {/* Weigh-in */}
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Weigh-in</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" placeholder="lbs" style={{ ...input, flex: 1 }} />
          <button onClick={submitWeight} style={btn}>Save</button>
        </div>
      </div>

      {/* Entries */}
      <div style={card}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Today's entries</h2>
        {data?.entries.length === 0 && <div style={{ color: "#6b7280" }}>No entries yet.</div>}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {data?.entries.map((e) => (
            <li key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
              <span>{e.description || "—"}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center", color: "#6b7280" }}>
                {Math.round(e.calories || 0)} kcal
                <button onClick={() => deleteEntry(e.id)} style={{ ...btn, padding: "2px 8px" }}>×</button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af" }}>{sub}</div>}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #0F1B22",
  background: "#0F1B22",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const input: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
};
