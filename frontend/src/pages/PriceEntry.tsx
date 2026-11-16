import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const UNITS = ["KG", "G", "L", "ML", "LBS", "OZ", "UNIT"] as const;
type Unit = (typeof UNITS)[number];

const CATEGORIES = [
  "DAIRY", "MEAT_SEAFOOD", "PRODUCE", "PANTRY",
  "FROZEN", "BEVERAGES", "HEALTH_BEAUTY", "HOUSEHOLD",
] as const;

const UNIT_LABEL: Record<Unit, string> = {
  KG: "kg", G: "g", L: "L", ML: "mL", LBS: "lbs", OZ: "oz", UNIT: "unit",
};

// Normalise to kg-equivalent for price/kg display
const TO_KG: Record<Unit, number> = {
  KG: 1, G: 0.001, LBS: 0.453592, OZ: 0.0283495,
  L: 1, ML: 0.001, UNIT: 1,
};

function calcPricePerKg(price: string, weight: string, unit: Unit): string {
  const p = parseFloat(price);
  const w = parseFloat(weight);
  if (!p || !w || w <= 0) return "—";
  const kg = w * TO_KG[unit];
  return `$${(p / kg).toFixed(2)} / ${unit === "UNIT" ? "unit" : "kg"}`;
}

const emptyNewItem = { productName: "", brand: "", category: "DAIRY" as string, barcodeSku: "" };

// ─── Component ───────────────────────────────────────────────────────────────

export default function PriceEntry() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const newItemModalRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Step state — keeps the form feeling simple
  // 1: pick item  2: pick store  3: enter price
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Item search
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Item[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [recentItems, setRecentItems] = useState<Item[]>([]);

  // Store selection
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreLocation | null>(null);
  const [allStores, setAllStores] = useState<StoreLocation[]>([]);
  const [storeQuery, setStoreQuery] = useState("");
  const [savingStore, setSavingStore] = useState<string | null>(null);

  // Price fields
  const [price, setPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<Unit>("KG");
  // "perWeight": price for an amount of a weight unit (e.g. $25 per 100 g) — same shape as a shelf price
  const [pricingMode, setPricingMode] = useState<"shelf" | "perWeight">("shelf");
  const [notes, setNotes] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Set after the first save so "Edit" re-submits as an update instead of a new entry
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  // New item modal
  const [newItem, setNewItem] = useState(emptyNewItem);
  const [newItemError, setNewItemError] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);

  // ─── Item search (debounced 300 ms) ────────────────────────────────────────
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await apiFetch<{ data: Item[] }>(`/api/items/search?q=${encodeURIComponent(query)}`, token);
        setSuggestions(res.data);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, token]);

  // ─── Recently used items (from the user's own entries, deduped) ────────────
  useEffect(() => {
    apiFetch<{ data: { item: Item }[] }>("/api/prices?mine=1&limit=30", token)
      .then((res) => {
        const seen = new Set<string>();
        setRecentItems(res.data.map((e) => e.item).filter((i) => !seen.has(i.id) && seen.add(i.id)).slice(0, 5));
      })
      .catch(() => setRecentItems([]));
  }, [token, success]);

  // ─── Load user's saved stores when entering step 2 ─────────────────────────
  useEffect(() => {
    if (step !== 2) return;
    setStoresLoading(true);
    Promise.all([
      apiFetch<{ data: { location: StoreLocation }[] }>("/api/users/stores?limit=100", token),
      apiFetch<{ data: StoreLocation[] }>("/api/stores?limit=100", token),
    ])
      .then(([saved, all]) => { setStores(saved.data.map((us) => us.location)); setAllStores(all.data); })
      .catch(() => { setStores([]); setAllStores([]); })
      .finally(() => setStoresLoading(false));
  }, [step, token]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const selectItem = useCallback((item: Item) => {
    setSelectedItem(item);
    setQuery("");
    setSuggestions([]);
    setStep(2);
  }, []);

  // ─── Preselect item when arriving from an item page (/add?itemId=…) ───────
  useEffect(() => {
    const itemId = searchParams.get("itemId");
    if (!itemId) return;
    apiFetch<{ data: Item }>(`/api/items/${itemId}`, token).then((res) => selectItem(res.data)).catch(() => {});
  }, [searchParams, token, selectItem]);

  // Save a store to the user's list and select it in one tap
  const handleSaveStore = async (store: StoreLocation) => {
    setSavingStore(store.id);
    setError(null);
    try {
      await apiFetch("/api/users/stores", token, { method: "POST", body: JSON.stringify({ locationId: store.id }) });
      setStores((prev) => [store, ...prev]);
      setSelectedStore(store);
      setStoreQuery("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save store");
    } finally {
      setSavingStore(null);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingItem(true);
    setNewItemError(null);
    try {
      const res = await apiFetch<{ data: Item }>("/api/items", token, {
        method: "POST",
        body: JSON.stringify({
          productName: newItem.productName.trim(),
          brand: newItem.brand.trim() || (newItem.category === "MEAT_SEAFOOD" ? "" : undefined),
          category: newItem.category,
          barcodeSku: newItem.barcodeSku.trim() || undefined,
        }),
      });
      newItemModalRef.current?.close();
      selectItem(res.data);
    } catch (err: unknown) {
      setNewItemError(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setCreatingItem(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !selectedStore) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: { id: string } }>(savedEntryId ? `/api/prices/${savedEntryId}` : "/api/prices", token, {
        method: savedEntryId ? "PUT" : "POST",
        body: JSON.stringify({
          itemId: selectedItem.id,
          locationId: selectedStore.id,
          price: parseFloat(price),
          weight: parseFloat(weight),
          unit,
          notes: notes.trim() || undefined,
        }),
      });
      setSavedEntryId(res.data.id);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save price entry");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(1); setSelectedItem(null); setSelectedStore(null);
    setPrice(""); setWeight(""); setUnit("KG"); setNotes(""); setPricingMode("shelf");
    setError(null); setSuccess(false); setQuery(""); setSavedEntryId(null);
  };

  // ─── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-5 text-center">
        <div className="text-6xl">✅</div>
        <h2 className="text-xl font-bold">Price saved!</h2>
        <p className="text-base-content/50 text-sm">
          {selectedItem?.productName} at {selectedStore?.storeName}
        </p>
        <div className="flex gap-3 mt-2">
          <button className="btn btn-ghost rounded-xl" onClick={() => { setSuccess(false); setStep(3); }}>
            Edit
          </button>
          <button className="btn btn-outline rounded-xl" onClick={reset}>
            Add Another
          </button>
          <button
            className="btn bg-orange-500 hover:bg-orange-600 text-neutral-900 border-none rounded-xl"
            onClick={() => navigate("/dashboard")}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">

      {/* Header */}
      <h1 className="text-2xl font-bold tracking-tight uppercase mb-1">Add Price</h1>
      <p className="text-base-content/50 text-sm mb-6">Log a grocery price you spotted</p>

      {/* Step indicator */}
      <ul className="steps w-full mb-8 text-xs">
        <li className={`step ${step >= 1 ? "step-primary" : ""}`}>Item</li>
        <li className={`step ${step >= 2 ? "step-primary" : ""}`}>Store</li>
        <li className={`step ${step >= 3 ? "step-primary" : ""}`}>Price</li>
      </ul>

      {/* ── STEP 1: Pick item ──────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <label className="form-control">
            <div className="label"><span className="label-text font-medium">Search for an item</span></div>
            <label className="input input-bordered flex items-center gap-2">
              {searchLoading
                ? <span className="loading loading-spinner loading-xs text-base-content/40" />
                : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                )}
              <input
                ref={searchRef}
                type="text"
                className="grow"
                placeholder="e.g. Natrel Milk, Eggs..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              {query && (
                <button onClick={() => { setQuery(""); setSuggestions([]); }} className="text-base-content/30">✕</button>
              )}
            </label>
          </label>

          {/* Recently used items — shown until the user starts typing */}
          {!query && recentItems.length > 0 && (
            <div>
              <p className="label-text font-medium mb-2">Recently used</p>
              <ul className="menu w-full bg-base-100 border border-base-200 rounded-box shadow-sm p-1">
                {recentItems.map((item) => (
                  <li key={item.id}>
                    <button className="w-full flex flex-col items-start gap-0 py-3" onClick={() => selectItem(item)}>
                      <span className="font-medium text-sm">{item.productName}</span>
                      <span className="text-xs text-base-content/50">{item.brand} · {item.category}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <ul className="menu bg-base-100 border border-base-200 rounded-box shadow-sm p-1">
              {suggestions.map((item) => (
                <li key={item.id}>
                  <button className="flex flex-col items-start gap-0 py-3" onClick={() => selectItem(item)}>
                    <span className="font-medium text-sm">{item.productName}</span>
                    <span className="text-xs text-base-content/50">{item.brand} · {item.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* No results hint */}
          {query.length >= 2 && !searchLoading && suggestions.length === 0 && (
            <div className="text-sm text-base-content/40 text-center py-2">
              No items found for "{query}"
            </div>
          )}

          {/* Create new item CTA */}
          <div className="divider text-xs text-base-content/30">Can't find it?</div>
          <button
            className="btn btn-outline w-full rounded-xl border-orange-400 text-orange-500 hover:bg-orange-500 hover:border-orange-500 hover:text-neutral-900"
            onClick={() => {
              setNewItem({ ...emptyNewItem, productName: query });
              setNewItemError(null);
              newItemModalRef.current?.showModal();
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create New Item
          </button>
        </div>
      )}

      {/* ── STEP 2: Pick store ─────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          {/* Selected item chip */}
          <div className="flex items-center gap-3 rounded-xl border bg-orange-500/10 border-orange-500/30 text-sm px-4 py-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{selectedItem?.productName}</p>
              <p className="text-xs text-base-content/50 truncate">{selectedItem?.brand}</p>
            </div>
            <button className="btn btn-ghost btn-xs shrink-0" onClick={() => { setSelectedItem(null); setStep(1); }}>Change</button>
          </div>

          <p className="font-medium text-sm">Which store did you find this at?</p>

          {storesLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : stores.length === 0 ? (
            <div className="card bg-base-200">
              <div className="card-body items-center text-center py-10 gap-3">
                <p className="text-base-content/50 text-sm">No saved stores yet</p>
                <button className="btn btn-sm btn-outline" onClick={() => navigate("/stores")}>
                  Add Stores
                </button>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {stores.map((store) => (
                <li key={store.id}>
                  <button
                    className={`w-full text-left p-4 rounded-xl border transition-colors flex items-center gap-3 ${
                      selectedStore?.id === store.id
                        ? "border-orange-400 bg-orange-500/10"
                        : "border-base-200 bg-base-100 hover:border-base-300"
                    }`}
                    onClick={() => setSelectedStore(store)}
                  >
                    <div className="bg-orange-500/15 text-orange-500 rounded-lg p-2 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{store.storeName}</p>
                      <p className="text-xs text-base-content/50 truncate">{store.address}, {store.city}</p>
                    </div>
                    {selectedStore?.id === store.id && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-orange-500 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Save another store to My Stores without leaving the flow */}
          <div className="divider text-xs text-base-content/30">Not in your stores?</div>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="Search all stores by name or city"
            value={storeQuery}
            onChange={(e) => setStoreQuery(e.target.value)}
          />
          {storeQuery.length >= 2 && (
            <ul className="menu w-full bg-base-100 border border-base-200 rounded-box shadow-sm p-1">
              {allStores
                .filter((s) => !stores.some((saved) => saved.id === s.id))
                .filter((s) => `${s.storeName} ${s.city}`.toLowerCase().includes(storeQuery.toLowerCase()))
                .slice(0, 5)
                .map((s) => (
                  <li key={s.id}>
                    <button className="flex items-center gap-3 py-3" disabled={savingStore === s.id} onClick={() => handleSaveStore(s)}>
                      <div className="flex flex-col items-start gap-0 grow min-w-0">
                        <span className="font-medium text-sm">{s.storeName}</span>
                        <span className="text-xs text-base-content/50">{s.address}, {s.city}</span>
                      </div>
                      {savingStore === s.id
                        ? <span className="loading loading-spinner loading-xs" />
                        : <span className="text-xs font-medium text-orange-500 shrink-0">+ Save</span>}
                    </button>
                  </li>
                ))}
            </ul>
          )}
          {error && step === 2 && (
            <div role="alert" className="alert alert-error text-sm py-2"><span>{error}</span></div>
          )}

          <button
            className="btn bg-orange-500 hover:bg-orange-600 text-neutral-900 border-none rounded-xl mt-2"
            disabled={!selectedStore}
            onClick={() => setStep(3)}
          >
            Continue
          </button>
        </div>
      )}

      {/* ── STEP 3: Enter price ────────────────────────────────────────────── */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Item + store summary */}
          <div className="bg-base-200 rounded-xl px-4 py-3 text-sm flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-base-content/50">Item</span>
              <span className="font-medium">{selectedItem?.productName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-base-content/50">Store</span>
              <span className="font-medium">{selectedStore?.storeName}</span>
            </div>
          </div>

          {/* Shelf price vs price per weight (meat counters) */}
          <div role="tablist" className="tabs tabs-box">
            <button type="button" role="tab" className={`tab flex-1 ${pricingMode === "shelf" ? "tab-active" : ""}`} onClick={() => setPricingMode("shelf")}>
              Shelf price
            </button>
            <button type="button" role="tab" className={`tab flex-1 ${pricingMode === "perWeight" ? "tab-active" : ""}`} onClick={() => { setPricingMode("perWeight"); if (!weight) setWeight("1"); if (unit === "UNIT" || unit === "L" || unit === "ML") setUnit("KG"); }}>
              Price per weight
            </button>
          </div>

          {/* Price */}
          <label className="form-control">
            <div className="label"><span className="label-text font-medium">{pricingMode === "shelf" ? "Shelf price ($)" : "Price ($)"}</span></div>
            <label className="input input-bordered flex items-center gap-2">
              <span className="text-base-content/40 font-medium">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="grow"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                autoFocus
              />
            </label>
          </label>

          {/* Weight + unit */}
          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <div className="label"><span className="label-text font-medium">{pricingMode === "shelf" ? "Size / Weight" : "Per amount"}</span></div>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                className="input input-bordered w-full"
                placeholder={pricingMode === "shelf" ? "e.g. 2" : "e.g. 100"}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </label>
            <label className="form-control">
              <div className="label"><span className="label-text font-medium">Unit</span></div>
              <select
                className="select select-bordered w-full"
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
              >
                {UNITS.filter((u) => pricingMode === "shelf" || ["KG", "G", "LBS", "OZ"].includes(u)).map((u) => (
                  <option key={u} value={u}>{UNIT_LABEL[u]}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Live price/kg calculation */}
          {price && weight && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-base-content/60">Price per unit</span>
              <span className="font-bold text-orange-600 text-lg">{calcPricePerKg(price, weight, unit)}</span>
            </div>
          )}

          {/* Notes */}
          <label className="form-control">
            <div className="label">
              <span className="label-text font-medium">Notes</span>
              <span className="label-text-alt text-base-content/30">Optional</span>
            </div>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="e.g. On sale, clearance, organic..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {/* Error */}
          {error && (
            <div role="alert" className="alert alert-error text-sm py-2">
              <span>{error}</span>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setError(null)}>✕</button>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button type="button" className="btn btn-ghost flex-1 rounded-xl" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              type="submit"
              className="btn bg-orange-500 hover:bg-orange-600 text-neutral-900 border-none flex-1 rounded-xl"
              disabled={submitting}
            >
              {submitting ? <span className="loading loading-spinner loading-sm" /> : savedEntryId ? "Update Price" : "Save Price"}
            </button>
          </div>
        </form>
      )}

      {/* ── Create New Item modal ───────────────────────────────────────────── */}
      <dialog ref={newItemModalRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-1">Create New Item</h3>
          <p className="text-sm text-base-content/50 mb-4">Add a product to the JuiceBox database</p>

          {newItemError && (
            <div role="alert" className="alert alert-error mb-4 text-sm py-2">
              <span>{newItemError}</span>
            </div>
          )}

          <form onSubmit={handleCreateItem} className="flex flex-col gap-3">
            <label className="form-control">
              <div className="label"><span className="label-text">Product Name</span></div>
              <input
                className="input input-bordered w-full"
                placeholder="e.g. Partly Skimmed Milk 2%"
                value={newItem.productName}
                onChange={(e) => setNewItem((f) => ({ ...f, productName: e.target.value }))}
                required
              />
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text">Brand</span>
                {newItem.category === "MEAT_SEAFOOD" && (
                  <span className="label-text-alt text-base-content/30">Optional for meat &amp; seafood</span>
                )}
              </div>
              <input
                className="input input-bordered w-full"
                placeholder={newItem.category === "MEAT_SEAFOOD" ? "e.g. Store brand (optional)" : "e.g. Natrel"}
                value={newItem.brand}
                onChange={(e) => setNewItem((f) => ({ ...f, brand: e.target.value }))}
                required={newItem.category !== "MEAT_SEAFOOD"}
              />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Category</span></div>
              <select
                className="select select-bordered w-full"
                value={newItem.category}
                onChange={(e) => setNewItem((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace("_", " ")}</option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text">Barcode / SKU</span>
                <span className="label-text-alt text-base-content/30">Optional</span>
              </div>
              <input
                className="input input-bordered w-full"
                placeholder="e.g. 056732123456"
                value={newItem.barcodeSku}
                onChange={(e) => setNewItem((f) => ({ ...f, barcodeSku: e.target.value }))}
              />
            </label>

            <div className="modal-action mt-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => newItemModalRef.current?.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn bg-orange-500 hover:bg-orange-600 text-neutral-900 border-none"
                disabled={creatingItem}
              >
                {creatingItem ? <span className="loading loading-spinner loading-sm" /> : "Create & Select"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>
    </div>
  );
}
