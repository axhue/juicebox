import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  "DAIRY",
  "MEAT_SEAFOOD",
  "PRODUCE",
  "PANTRY",
  "FROZEN",
  "BEVERAGES",
  "HEALTH_BEAUTY",
  "HOUSEHOLD",
] as const;

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

const LIMIT = 20;

// ─── Component ───────────────────────────────────────────────────────────────

export default function Items() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Debounce search input 300 ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [debouncedSearch, activeCategory]);

  // Fetch
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (activeCategory) params.set("category", activeCategory);

        const res = await apiFetch<{
          data: Item[];
          pagination: { hasNextPage: boolean; total: number };
        }>(`/api/items?${params}`, token);

        if (!cancelled) {
          setItems((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
          setHasMore(res.pagination.hasNextPage);
          setTotal(res.pagination.total);
        }
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, page, debouncedSearch, activeCategory]);

  const clearSearch = () => {
    setSearch("");
    searchRef.current?.focus();
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-28">

      {/* Header */}
      <h1 className="text-2xl font-bold tracking-tight uppercase mb-1">Items</h1>
      <p className="text-base-content/50 text-sm mb-4">Browse the JuiceBox product catalogue</p>

      {/* Search */}
      <label className="input input-bordered flex items-center gap-2 mb-4">
        {loading && (debouncedSearch || activeCategory) ? (
          <span className="loading loading-spinner loading-xs text-base-content/40" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-base-content/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        )}
        <input
          ref={searchRef}
          type="text"
          className="grow text-sm"
          placeholder="Search by name or brand…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={clearSearch} className="text-base-content/30 hover:text-base-content/60">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </label>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
        <button
          className={`btn btn-sm rounded-full shrink-0 ${activeCategory === null ? "bg-orange-500 text-neutral-900 border-none" : "btn-outline border-base-300"}`}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`btn btn-sm rounded-full shrink-0 ${activeCategory === cat ? "bg-orange-500 text-neutral-900 border-none" : "btn-outline border-base-300"}`}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
          >
            {CATEGORY_EMOJI[cat]} {CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      {/* Result count */}
      {!loading && (
        <p className="text-xs text-base-content/40 mb-3">
          {total === 0 ? "No items found" : `${total} item${total === 1 ? "" : "s"}`}
          {activeCategory ? ` in ${CATEGORY_LABEL[activeCategory]}` : ""}
          {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
        </p>
      )}

      {/* Item list */}
      {loading && page === 1 ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <span className="text-4xl">🔍</span>
          <p className="text-base-content/50 text-sm">No items match your search.</p>
          {(search || activeCategory) && (
            <button
              className="btn btn-sm btn-outline rounded-xl"
              onClick={() => { setSearch(""); setActiveCategory(null); }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-base-200 border border-base-200 rounded-xl overflow-hidden">
          {items.map((item) => (
            <li key={item.id}>
              <button
                className="w-full text-left bg-base-100 hover:bg-base-50 px-4 py-3 flex items-center gap-3 transition-colors"
                onClick={() => navigate(`/items/${item.id}`)}
              >
                {/* Category emoji badge */}
                <div className="bg-base-200 rounded-lg size-10 flex items-center justify-center text-lg shrink-0">
                  {CATEGORY_EMOJI[item.category] ?? "📦"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm leading-tight truncate">{item.productName}</p>
                  <p className="text-xs text-base-content/50 mt-0.5">
                    {item.brand ? `${item.brand} · ` : ""}{CATEGORY_LABEL[item.category] ?? item.category}
                  </p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-base-content/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Load more */}
      {items.length > 0 && (
        <div className="mt-4 flex justify-center">
          {loading && page > 1 ? (
            <span className="loading loading-spinner loading-sm text-orange-400" />
          ) : hasMore ? (
            <button
              className="btn btn-outline btn-sm rounded-xl border-base-300"
              onClick={() => setPage((p) => p + 1)}
            >
              Load more
            </button>
          ) : (
            <p className="text-xs text-base-content/30">All {total} items loaded</p>
          )}
        </div>
      )}
    </div>
  );
}
