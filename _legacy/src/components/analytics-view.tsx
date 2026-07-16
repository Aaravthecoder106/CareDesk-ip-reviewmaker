import {
  ResponsiveContainer, YAxis, XAxis, Tooltip,
  PieChart, Pie, Cell, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { format } from "date-fns";
import { Activity, Pill, AlertTriangle, HeartPulse } from "lucide-react";

const PIE_COLORS = [
  "hsl(190 80% 30%)",
  "hsl(190 60% 50%)",
  "hsl(200 40% 65%)",
  "hsl(220 20% 75%)",
  "hsl(30 60% 60%)",
  "hsl(340 60% 60%)",
];

export type Palette = { key: string; label: string; base: string; light: string };
const PALETTES: Record<string, Palette> = {
  sugar:   { key: "sugar",   label: "Blood Sugar",    base: "#EF4444", light: "#FCA5A5" },
  lipid:   { key: "lipid",   label: "Lipid Profile",  base: "#3B82F6", light: "#93C5FD" },
  liver:   { key: "liver",   label: "Liver Function", base: "#10B981", light: "#6EE7B7" },
  kidney:  { key: "kidney",  label: "Kidney",         base: "#8B5CF6", light: "#C4B5FD" },
  cbc:     { key: "cbc",     label: "CBC",            base: "#F97316", light: "#FDBA74" },
  vitamin: { key: "vitamin", label: "Vitamins",       base: "#EAB308", light: "#FDE68A" },
  thyroid: { key: "thyroid", label: "Thyroid",        base: "#EC4899", light: "#F9A8D4" },
  other:   { key: "other",   label: "Other",          base: "#0EA5E9", light: "#7DD3FC" },
};

function categorize(name: string): Palette {
  const n = name.toLowerCase();
  if (/(glucose|sugar|hba1c|fasting|hbaic|insulin)/.test(n)) return PALETTES.sugar;
  if (/(cholesterol|ldl|hdl|triglyc|lipid|vldl)/.test(n)) return PALETTES.lipid;
  if (/(alt|ast|sgot|sgpt|bilirub|alk.*phos|alp|albumin|ggt|liver)/.test(n)) return PALETTES.liver;
  if (/(creatinine|urea|bun|egfr|uric|kidney|renal)/.test(n)) return PALETTES.kidney;
  if (/(hemoglobin|haemoglob|hgb|hct|hematocrit|wbc|rbc|platelet|mch|mcv|neutro|lympho|cbc)/.test(n)) return PALETTES.cbc;
  if (/(vitamin|vit\.?\s?(d|b12|b6|a)|folate|iron|ferritin|calcium|magnes)/.test(n)) return PALETTES.vitamin;
  if (/(tsh|t3|t4|thyroid)/.test(n)) return PALETTES.thyroid;
  return PALETTES.other;
}

type TooltipItem = { value?: number | string; payload?: { unit?: string | null; date?: string } };
function LabTooltip({ active, payload, label, color }: { active?: boolean; payload?: TooltipItem[]; label?: string | number; color: string }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const unit = item.payload?.unit ?? "";
  return (
    <div className="rounded-xl border border-border bg-surface/95 backdrop-blur px-3 py-2 shadow-lg">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-bold" style={{ color }}>
        {item.value} {unit ? <span className="text-muted-foreground font-normal ml-1">{unit}</span> : null}
      </p>
    </div>
  );
}

export type SnapshotShape = {
  labs?: Record<string, Array<{ date: string; value: number; unit: string | null }>>;
  conditions?: string[];
  medications?: string[];
  flags?: Array<{ text: string; report: string; date: string }>;
  report_count?: number;
  updated_at?: string;
  summary?: string;
};

export type ReportSummary = {
  id: string;
  title: string;
  ai_summary: string | null;
  created_at: string;
};

export function AnalyticsView({
  snap,
  reports,
  emptyLabel,
}: {
  snap: SnapshotShape | null | undefined;
  reports?: ReportSummary[];
  emptyLabel?: string;
}) {
  const s = (snap ?? {}) as SnapshotShape;
  const labs = s.labs ?? {};
  const conditions = Array.isArray(s.conditions) ? s.conditions : [];
  const meds = Array.isArray(s.medications) ? s.medications : [];
  const flags = Array.isArray(s.flags) ? s.flags : [];

  const conditionData = conditions.slice(0, 6).map((c, i) => ({
    name: c, value: 1, fill: PIE_COLORS[i % PIE_COLORS.length],
  }));
  const medBarData = meds.slice(0, 8).map((m) => ({
    name: m.length > 22 ? m.slice(0, 20) + "…" : m, full: m, value: 1,
  }));
  const labNames = Object.keys(labs);
  const labCount = labNames.length;
  const reportCount = typeof s.report_count === "number" ? s.report_count : 0;

  const findingsByMonth = (() => {
    const map = new Map<string, number>();
    for (const f of flags) {
      const key = format(new Date(f.date), "MMM yy");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map, ([month, count]) => ({ month, count }));
  })();

  const hasAny = labCount > 0 || conditions.length > 0 || meds.length > 0 || flags.length > 0;

  if (!hasAny) {
    return (
      <div className="p-10 sm:p-16 bg-surface ring-1 ring-dashed ring-border rounded-3xl text-center">
        <div className="mx-auto size-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <HeartPulse className="size-6 text-primary" />
        </div>
        <p className="font-display text-lg font-bold mb-1">{emptyLabel ?? "Upload your medical report"}</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Analytics only show data extracted from uploaded reports — nothing is inferred or made up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi icon={<HeartPulse className="size-4" />} label="Reports" value={String(reportCount)} />
        <Kpi icon={<Activity className="size-4" />} label="Tracked labs" value={String(labCount)} />
        <Kpi icon={<Pill className="size-4" />} label="Medications" value={String(meds.length)} />
        <Kpi icon={<AlertTriangle className="size-4" />} label="Findings" value={String(flags.length)} tone={flags.length ? "warn" : undefined} />
      </div>

      {s.summary && (
        <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 p-5 sm:p-6 rounded-2xl shadow-sm">
          <h3 className="font-display font-bold mb-2 text-sm sm:text-base">AI health summary</h3>
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{s.summary}</p>
        </div>
      )}

      {conditionData.length > 0 && (
        <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 p-5 sm:p-6 rounded-2xl">
          <h3 className="font-display font-bold mb-4 text-sm sm:text-base">Conditions across reports</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-center">
            <div className="h-48 sm:h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={conditionData} dataKey="value" innerRadius="55%" outerRadius="90%" paddingAngle={2}>
                    {conditionData.map((c, i) => <Cell key={i} fill={c.fill} />)}
                  </Pie>
                  <Tooltip formatter={(_v, n) => [n as string, "condition"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 min-w-0">
              {conditionData.map((c) => (
                <li key={c.name} className="flex items-center gap-2 min-w-0 text-sm">
                  <span className="size-3 rounded-full shrink-0" style={{ background: c.fill }} />
                  <span className="truncate">{c.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(medBarData.length > 0 || findingsByMonth.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {medBarData.length > 0 && (
            <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 p-5 sm:p-6 rounded-2xl shadow-sm">
              <h3 className="font-display font-bold mb-4 text-sm sm:text-base">Active medications</h3>
              <div style={{ height: Math.max(160, medBarData.length * 34) }}>
                <ResponsiveContainer>
                  <BarChart data={medBarData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="medGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#7DD3FC" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <Tooltip
                      cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, boxShadow: "0 10px 30px -12px rgba(0,0,0,0.2)" }}
                      formatter={(_v, _n, p) => [(p?.payload as { full: string })?.full ?? "", "medication"]}
                    />
                    <Bar dataKey="value" radius={[6, 6, 6, 6]} fill="url(#medGrad)" animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {findingsByMonth.length > 0 && (
            <PremiumBarCard
              title="Findings per month"
              data={findingsByMonth.map((d) => ({ label: d.month, value: d.count, unit: null }))}
              palette={PALETTES.other}
              height={220}
            />
          )}
        </div>
      )}

      {labCount > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-3 sm:mb-4">
            <h2 className="font-display text-base sm:text-lg font-bold">Lab trends</h2>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hidden sm:block">
              Hover a bar for details
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {Array.from(new Set(labNames.map((n) => categorize(n).key))).map((k) => {
              const p = PALETTES[k];
              return (
                <span key={k} className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-full px-2.5 py-1">
                  <span className="size-2 rounded-full" style={{ background: p.base }} />
                  {p.label}
                </span>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {Object.entries(labs).map(([name, series]) => {
              const palette = categorize(name);
              const data = series.map((p) => ({
                label: format(new Date(p.date), "MMM d"), value: p.value, unit: p.unit,
              }));
              const unit = series[0]?.unit ?? "";
              const last = series[series.length - 1]?.value;
              const first = series[0]?.value;
              const delta = typeof last === "number" && typeof first === "number" ? last - first : 0;
              const deltaPct = first ? (delta / first) * 100 : 0;
              const trendUp = delta > 0;
              return (
                <LabBarCard
                  key={name}
                  title={name} unit={unit} last={last}
                  deltaPct={deltaPct} trendUp={trendUp}
                  showTrend={series.length > 1}
                  palette={palette} data={data}
                />
              );
            })}
          </div>
        </div>
      )}

      {flags.length > 0 && (
        <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 p-5 sm:p-6 rounded-2xl shadow-sm">
          <h3 className="font-display font-bold mb-4 text-sm sm:text-base">Findings timeline</h3>
          <ul className="space-y-3">
            {flags.slice().reverse().map((f, i) => (
              <li key={i} className="grid grid-cols-[70px_minmax(0,1fr)] sm:grid-cols-[90px_minmax(0,1fr)] gap-3 text-sm">
                <span className="text-[10px] font-mono uppercase text-muted-foreground pt-1">{format(new Date(f.date), "MMM d")}</span>
                <div className="min-w-0">
                  <p className="text-foreground/90 break-words">{f.text}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">from {f.report}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reports && reports.length > 0 && (
        <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 p-5 sm:p-6 rounded-2xl shadow-sm">
          <h3 className="font-display font-bold mb-4 text-sm sm:text-base">Latest uploaded reports</h3>
          <ul className="divide-y divide-border">
            {reports.slice(0, 8).map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold truncate">{r.title}</p>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground shrink-0">
                    {format(new Date(r.created_at), "MMM d, yyyy")}
                  </span>
                </div>
                {r.ai_summary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.ai_summary}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LabBarCard({
  title, unit, last, deltaPct, trendUp, showTrend, palette, data,
}: {
  title: string; unit: string; last: number | undefined; deltaPct: number; trendUp: boolean;
  showTrend: boolean; palette: Palette;
  data: Array<{ label: string; value: number; unit: string | null }>;
}) {
  const gradId = `lab-grad-${palette.key}-${title.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="group bg-surface ring-1 ring-black/5 dark:ring-white/5 p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-baseline justify-between gap-3 mb-4 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="size-2 rounded-full shrink-0" style={{ background: palette.base }} />
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground truncate">{palette.label}</p>
          </div>
          <h3 className="font-display font-bold truncate">{title}</h3>
          <p className="text-[10px] font-mono uppercase text-muted-foreground">{unit || "—"}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl sm:text-2xl font-display font-bold">{last}</p>
          {showTrend && (
            <p className={`text-[10px] font-mono ${trendUp ? "text-amber-600" : "text-emerald-600"}`}>
              {trendUp ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%
            </p>
          )}
        </div>
      </div>
      <div className="h-36 sm:h-40">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.base} stopOpacity={0.95} />
                <stop offset="100%" stopColor={palette.light} stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" domain={["auto", "auto"]} width={32} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: palette.base, opacity: 0.08 }} content={<LabTooltip color={palette.base} />} />
            <Bar dataKey="value" fill={`url(#${gradId})`} radius={[8, 8, 2, 2]} animationDuration={700} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PremiumBarCard({
  title, data, palette, height = 200,
}: {
  title: string;
  data: Array<{ label: string; value: number; unit: string | null }>;
  palette: Palette;
  height?: number;
}) {
  const gradId = `pc-grad-${palette.key}-${title.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="bg-surface ring-1 ring-black/5 dark:ring-white/5 p-5 sm:p-6 rounded-2xl shadow-sm">
      <h3 className="font-display font-bold mb-4 text-sm sm:text-base">{title}</h3>
      <div style={{ height }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.base} stopOpacity={0.95} />
                <stop offset="100%" stopColor={palette.light} stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" allowDecimals={false} width={28} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: palette.base, opacity: 0.08 }} content={<LabTooltip color={palette.base} />} />
            <Bar dataKey="value" fill={`url(#${gradId})`} radius={[8, 8, 2, 2]} animationDuration={700} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="p-4 sm:p-5 bg-surface ring-1 ring-black/5 dark:ring-white/5 rounded-2xl min-w-0 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <span className={tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : ""}>{icon}</span>
        <p className="text-[10px] font-mono uppercase tracking-widest truncate">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl font-display font-bold">{value}</p>
    </div>
  );
}

export function healthScoreFrom(snap: SnapshotShape | null | undefined): number | null {
  if (!snap) return null;
  const flags = Array.isArray(snap.flags) ? snap.flags.length : 0;
  const reports = typeof snap.report_count === "number" ? snap.report_count : 0;
  if (reports === 0) return null;
  const score = Math.max(30, Math.min(100, 100 - flags * 6));
  return score;
}
