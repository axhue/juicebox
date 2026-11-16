import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreLocation {
  id: string;
  storeName: string;
  storeGroup: string;
  city: string;
  province: string;
}

interface PriceEntry {
  id: string;
  price: number | string;
  pricePerKg: number | string | null;
  weight: number | string;
  unit: string;
  datetime: string;
  item: { id: string; productName: string; brand: string };
  location: { id: string; storeName: string; city: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UNIT_ABBR: Record<string, string> = {
  KG: "kg", G: "g", L: "L", ML: "mL", LBS: "lbs", OZ: "oz", UNIT: "",
};

function fmtWeight(weight: number, unit: string) {
  const abbr = UNIT_ABBR[unit] ?? unit.toLowerCase();
  const w = unit === "UNIT" ? "" : `${weight % 1 === 0 ? weight : weight}${abbr}`;
  return w;
}

function fmtPricePerKg(pricePerKg: number | string | null, unit: string) {
  const val = pricePerKg != null ? parseFloat(String(pricePerKg)) : NaN;
  if (!val || isNaN(val)) return null;
  const label = unit === "L" || unit === "ML" ? "/L" : unit === "UNIT" ? "/unit" : "/kg";
  return `$${val.toFixed(2)}${label}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [entries, setEntries] = useState<PriceEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesPage, setEntriesPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const ENTRIES_LIMIT = 5;

  useEffect(() => {
    apiFetch<{ data: { location: StoreLocation }[] }>("/api/users/stores?limit=6", token)
      .then((r) => setStores(r.data.map((us) => us.location)))
      .catch(() => {})
      .finally(() => setStoresLoading(false));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setEntriesLoading(true);
      try {
        const r = await apiFetch<{ data: PriceEntry[]; pagination: { hasNextPage: boolean } }>(
          `/api/prices?page=${entriesPage}&limit=${ENTRIES_LIMIT}`,
          token
        );
        if (!cancelled) {
          setEntries((prev) => (entriesPage === 1 ? r.data : [...prev, ...r.data]));
          setHasMore(r.pagination.hasNextPage);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setEntriesLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, entriesPage]);

  return (
    <>
    <div className="max-w-lg mx-auto pb-32">

      {/* ── MY STORES ───────────────────────────────────────────────────── */}
      <section className="px-4 pt-6 pb-2">
        <p className="text-xs font-semibold tracking-widest text-base-content/40 uppercase mb-3">
          My Stores
        </p>

        {storesLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <div className="text-sm text-base-content/40 py-4">
            No stores saved yet.{" "}
            <Link to="/stores" className="text-orange-500 font-medium">Find stores →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {stores.slice(0, 6).map((store) => (
              <button
                key={store.id}
                className="text-left bg-base-100 border border-base-200 rounded-xl px-4 py-3 hover:border-orange-200 transition-colors"
                onClick={() => navigate("/stores")}
              >
                <p className="font-semibold text-sm leading-tight">{store.storeName}</p>
                <p className="text-xs text-base-content/40 mt-0.5 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  {store.city}
                </p>
              </button>
            ))}
          </div>
        )}

        <Link
          to="/stores/explore"
          className="inline-flex items-center gap-1 text-sm font-medium text-orange-500 mt-3 hover:text-orange-600"
        >
          + Explore All Stores →
        </Link>
      </section>

      <div className="divider mx-4 my-2" />

      {/* ── RECENT COMMUNITY ENTRIES ─────────────────────────────────────── */}
      <section className="px-4 pb-4">
        <p className="text-xs font-semibold tracking-widest text-base-content/40 uppercase mb-3">
          Recent Community Entries
        </p>

        {entriesLoading && entriesPage === 1 ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-base-content/40 py-6 text-center">
            No price entries yet. Be the first to{" "}
            <Link to="/add" className="text-orange-500 font-medium">add one!</Link>
          </div>
        ) : (
          <ul className="divide-y divide-base-200 border border-base-200 rounded-xl overflow-hidden">
            {entries.map((entry) => {
              const weightStr = fmtWeight(parseFloat(String(entry.weight)), entry.unit);
              const perKg = fmtPricePerKg(entry.pricePerKg, entry.unit);
              return (
                <li key={entry.id} className="bg-base-100 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight">
                        {entry.item.productName}
                        {weightStr ? ` ${weightStr}` : ""}
                      </p>
                      <p className="text-xs text-base-content/50 mt-0.5">
                        {entry.location.storeName} – {entry.location.city}
                      </p>
                      <p className="mt-1.5 flex items-baseline gap-2">
                        <span className="text-orange-500 font-bold text-base">
                          ${parseFloat(String(entry.price)).toFixed(2)}
                        </span>
                        {perKg && (
                          <span className="text-base-content/40 text-xs">{perKg}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-base-content/30 shrink-0 flex items-center gap-1 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      {timeAgo(entry.datetime)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* See More / loading */}
        {entries.length > 0 && (
          <div className="mt-3">
            {entriesLoading && entriesPage > 1 ? (
              <div className="flex justify-center py-2">
                <span className="loading loading-spinner loading-sm text-orange-400" />
              </div>
            ) : hasMore ? (
              <button
                className="text-sm font-medium text-orange-500 hover:text-orange-600 flex items-center gap-1"
                onClick={() => setEntriesPage((p) => p + 1)}
              >
                See More Entries →
              </button>
            ) : null}
          </div>
        )}
      </section>

    </div>

    {/* ── ADD PRICE CTA — fixed above dock ────────────────────────────── */}
    <div className="fixed bottom-16 inset-x-0 px-4 pb-2 pt-3 bg-gradient-to-t from-base-200/90 to-transparent pointer-events-none">
      <button
        className="w-full max-w-lg mx-auto block btn bg-orange-500 hover:bg-orange-600 text-neutral-900 border-none rounded-xl text-base font-semibold h-14 pointer-events-auto shadow-lg"
        onClick={() => navigate("/add")}
      >
        + Add Price
      </button>
    </div>
  </>
  );
}
