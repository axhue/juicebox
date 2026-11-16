import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Item {
  id: string;
  productName: string;
  brand: string;
  category: string;
  barcodeSku: string | null;
}

interface StoreLocation {
  id: string;
  storeName: string;
  storeGroup: string;
  address: string;
  city: string;
  province: string;
}

interface CompareEntry {
  id: string;
  price: number | string;
  weight: number | string;
  unit: string;
  price_per_kg: number | string | null;
  datetime: string;
  location: StoreLocation;
}

interface HistoryEntry {
  price: number | string;
  pricePerKg: number | string | null;
  datetime: string;
  locationId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  DAIRY: "🥛",
  MEAT_SEAFOOD: "🥩",
  PRODUCE: "🥦",
  PANTRY: "🥫",
  FROZEN: "🧊",
  BEVERAGES: "🧃",
  HEALTH_BEAUTY: "💊",
  HOUSEHOLD: "🧹",
};

const CATEGORY_LABEL: Record<string, string> = {
  DAIRY: "Dairy",
  MEAT_SEAFOOD: "Meat & Seafood",
  PRODUCE: "Produce",
  PANTRY: "Pantry",
  FROZEN: "Frozen",
  BEVERAGES: "Beverages",
  HEALTH_BEAUTY: "Health & Beauty",
  HOUSEHOLD: "Household",
};

const UNIT_ABBR: Record<string, string> = {
  KG: "kg", G: "g", L: "L", ML: "mL", LBS: "lbs", OZ: "oz", UNIT: "",
};

function fmtWeight(weight: number | string, unit: string) {
  const w = parseFloat(String(weight));
  const abbr = UNIT_ABBR[unit] ?? unit.toLowerCase();
  if (unit === "UNIT") return "";
  return `${w % 1 === 0 ? w : w}${abbr}`;
}

function fmtPerKg(val: number | string | null, unit: string) {
  const n = val != null ? parseFloat(String(val)) : NaN;
  if (!n || isNaN(n)) return null;
  const label = unit === "L" || unit === "ML" ? "/L" : unit === "UNIT" ? "/unit" : "/kg";
  return `$${n.toFixed(2)}${label}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

// ─── Price Chart ─────────────────────────────────────────────────────────────

function PriceChart({ history }: { history: HistoryEntry[] }) {
  if (history.length < 2) return null;

  const W = 320;
  const H = 80;
  const values = history.map((h) => parseFloat(String(h.pricePerKg ?? h.price)));
  const PAD = { top: 10, right: 8, bottom: 22, left: 12 + `$${Math.max(...values).toFixed(2)}`.length * 4.5 };
  const dates  = history.map((h) => new Date(h.datetime).getTime());

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const rangeV = maxV - minV || 1;
  const minD = Math.min(...dates);
  const maxD = Math.max(...dates);
  const rangeD = maxD - minD || 1;

  const cx = (d: number) => PAD.left + ((d - minD) / rangeD) * (W - PAD.left - PAD.right);
  const cy = (v: number) => PAD.top + (1 - (v - minV) / rangeV) * (H - PAD.top - PAD.bottom);

  const points = history.map((_, i) => `${cx(dates[i])},${cy(values[i])}`).join(" ");

  // Y-axis ticks (3)
  const yTicks = [minV, (minV + maxV) / 2, maxV];

  // X-axis ticks: first, last, and up to one middle
  const xTickIdxs = history.length <= 2
    ? [0, history.length - 1]
    : [0, Math.floor((history.length - 1) / 2), history.length - 1];

  // Filled area path
  const areaPath = [
    `M ${cx(dates[0])} ${H - PAD.bottom}`,
    ...history.map((_, i) => `L ${cx(dates[i])} ${cy(values[i])}`),
    `L ${cx(dates[history.length - 1])} ${H - PAD.bottom}`,
    "Z",
  ].join(" ");

  return (
    <div className="mt-4 bg-base-100 border border-base-200 rounded-xl p-3 overflow-hidden">
      <p className="text-xs font-semibold tracking-widest text-base-content/40 uppercase mb-2">Price History</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 88 }}>
        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={PAD.left} y1={cy(v)}
            x2={W - PAD.right} y2={cy(v)}
            stroke="currentColor" strokeOpacity={0.07} strokeWidth={1}
          />
        ))}

        {/* Area fill */}
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#f97316"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots */}
        {history.map((_, i) => (
          <circle key={i} cx={cx(dates[i])} cy={cy(values[i])} r={2.5}
            fill="#f97316" stroke="white" strokeWidth={1}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v, i) => (
          <text
            key={i}
            x={PAD.left - 4} y={cy(v) + 3.5}
            textAnchor="end"
            fontSize={8}
            fill="currentColor"
            fillOpacity={0.4}
          >
            ${v.toFixed(2)}
          </text>
        ))}

        {/* X-axis labels */}
        {xTickIdxs.map((idx) => (
          <text
            key={idx}
            x={cx(dates[idx])}
            y={H - 4}
            textAnchor={idx === 0 ? "start" : idx === history.length - 1 ? "end" : "middle"}
            fontSize={8}
            fill="currentColor"
            fillOpacity={0.35}
          >
            {fmtDate(history[idx].datetime)}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  // "default" key = page was opened directly, so there is no in-app page to go back to
  const cameFromApp = useLocation().key !== "default";

  const [item, setItem] = useState<Item | null>(null);
  const [entries, setEntries] = useState<CompareEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [itemRes, pricesRes, historyRes] = await Promise.all([
          apiFetch<{ data: Item }>(`/api/items/${id}`, token),
          apiFetch<{ data: CompareEntry[] }>(`/api/prices/item/${id}/compare`, token),
          apiFetch<{ data: HistoryEntry[] }>(`/api/prices/item/${id}/history?limit=100`, token),
        ]);
        if (!cancelled) {
          setItem(itemRes.data);
          setEntries(pricesRes.data);
          setHistory(historyRes.data);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load item");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, token]);

  const cheapest = entries[0]; // already sorted cheapest-first by backend

  return (
    <div className="max-w-lg mx-auto pb-28">

      {/* Back button */}
      <div className="px-4 pt-5 pb-2">
        <button
          className="flex items-center gap-1.5 text-sm text-base-content/50 hover:text-base-content transition-colors"
          onClick={() => (cameFromApp ? navigate(-1) : navigate("/items"))}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      {loading ? (
        <div className="px-4 flex flex-col gap-3 mt-2">
          <div className="skeleton h-8 w-2/3 rounded-xl" />
          <div className="skeleton h-5 w-1/3 rounded-xl" />
          <div className="skeleton h-24 w-full rounded-xl mt-2" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="px-4 mt-4">
          <div role="alert" className="alert alert-error text-sm">{error}</div>
        </div>
      ) : item ? (
        <>
          {/* Item header */}
          <div className="px-4 mb-5">
            <div className="flex items-start gap-3">
              <div className="bg-base-200 rounded-xl size-14 flex items-center justify-center text-3xl shrink-0 mt-1">
                {CATEGORY_EMOJI[item.category] ?? "📦"}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-tight">{item.productName}</h1>
                <p className="text-sm text-base-content/50 mt-0.5">
                  {item.brand && `${item.brand} · `}{CATEGORY_LABEL[item.category] ?? item.category}
                </p>
                {item.barcodeSku && (
                  <p className="text-xs text-base-content/30 mt-1 font-mono">{item.barcodeSku}</p>
                )}
              </div>
            </div>

            {/* Best price banner */}
            {cheapest && (
              <div className="mt-4 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide mb-0.5">Best Price</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ${parseFloat(String(cheapest.price)).toFixed(2)}
                  </p>
                  {fmtPerKg(cheapest.price_per_kg, cheapest.unit) && (
                    <p className="text-xs text-orange-400/80">
                      {fmtPerKg(cheapest.price_per_kg, cheapest.unit)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{cheapest.location.storeName}</p>
                  <p className="text-xs text-base-content/40">{cheapest.location.city}</p>
                  <p className="text-xs text-base-content/30 mt-0.5">{timeAgo(cheapest.datetime)}</p>
                </div>
              </div>
            )}

            {/* Price history chart */}
            <PriceChart history={history} />
          </div>

          {/* Price at every store */}
          <div className="px-4">
            <p className="text-xs font-semibold tracking-widest text-base-content/40 uppercase mb-3">
              {entries.length === 0 ? "No prices yet" : `Prices at ${entries.length} store${entries.length === 1 ? "" : "s"}`}
            </p>

            {entries.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 text-center">
                <span className="text-4xl">🏷️</span>
                <p className="text-base-content/50 text-sm">No one has logged a price for this item yet.</p>
                <button
                  className="btn btn-sm bg-orange-500 hover:bg-orange-600 text-neutral-900 border-none rounded-xl"
                  onClick={() => navigate(`/add?itemId=${item.id}&itemName=${encodeURIComponent(item.productName)}`)}
                >
                  Be the first to add one
                </button>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {entries.map((entry, i) => {
                  const weightLabel = fmtWeight(entry.weight, entry.unit);
                  const perKg = fmtPerKg(entry.price_per_kg, entry.unit);
                  const isCheapest = i === 0;

                  return (
                    <li key={entry.id} className={`rounded-xl border px-4 py-3 bg-base-100 ${isCheapest ? "border-orange-300" : "border-base-200"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate">{entry.location.storeName}</p>
                            {isCheapest && (
                              <span className="badge badge-sm bg-orange-500/15 text-orange-500 border-orange-500/30 shrink-0">
                                Cheapest
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-base-content/40 truncate mt-0.5">
                            {entry.location.address}, {entry.location.city}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-base text-orange-500">
                            ${parseFloat(String(entry.price)).toFixed(2)}
                            {weightLabel ? <span className="text-xs font-normal text-base-content/40 ml-0.5">/{weightLabel}</span> : ""}
                          </p>
                          {perKg && <p className="text-xs text-base-content/40">{perKg}</p>}
                          <p className="text-xs text-base-content/30 mt-0.5">{timeAgo(entry.datetime)}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Log a price CTA */}
            {entries.length > 0 && (
              <button
                className="mt-4 w-full btn btn-outline border-orange-300 text-orange-500 hover:bg-orange-500 hover:border-orange-500 hover:text-neutral-900 rounded-xl"
                onClick={() => navigate(`/add?itemId=${item.id}&itemName=${encodeURIComponent(item.productName)}`)}
              >
                + Log a Price for This Item
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
