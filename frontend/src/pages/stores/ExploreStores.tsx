import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

interface StoreLocation {
  id: string;
  storeName: string;
  storeGroup: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
}

interface StoresApiResponse {
  data: StoreLocation[];
}

interface UserStoresApiResponse {
  data: { locationId: string }[];
}

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

const emptyForm = { storeName: "", storeGroup: "", address: "", city: "", province: "ON", postalCode: "" };

const StoreIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72" />
  </svg>
);

export default function ExploreStores() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDialogElement>(null);

  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New store form
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const openModal = () => {
    setForm(emptyForm);
    setFormError(null);
    modalRef.current?.showModal();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const res = await apiFetch<{ data: StoreLocation }>("/api/stores", token, {
        method: "POST",
        body: JSON.stringify(form),
      });
      // Optimistically add new store to the list and refresh groups
      setStores((prev) => [...prev, res.data]);
      if (!groups.includes(res.data.storeGroup)) {
        setGroups((prev) => [...prev, res.data.storeGroup].sort());
      }
      modalRef.current?.close();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create store");
    } finally {
      setCreating(false);
    }
  };

  // Load all stores, groups, and current user's saved stores in parallel
  useEffect(() => {
    Promise.all([
      apiFetch<StoresApiResponse>("/api/stores?limit=100", token),
      apiFetch<{ data: string[] }>("/api/stores/groups", token),
      apiFetch<UserStoresApiResponse>("/api/users/stores?limit=200", token),
    ])
      .then(([storesRes, groupsRes, userStoresRes]) => {
        setStores(storesRes.data);
        setGroups(groupsRes.data);
        setSavedIds(new Set(userStoresRes.data.map((us) => us.locationId)));
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load stores")
      )
      .finally(() => setLoading(false));
  }, [token]);

  const handleAdd = async (locationId: string) => {
    setAdding(locationId);
    try {
      await apiFetch("/api/users/stores", token, {
        method: "POST",
        body: JSON.stringify({ locationId }),
      });
      setSavedIds((prev) => new Set([...prev, locationId]));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add store");
    } finally {
      setAdding(null);
    }
  };

  // Client-side filter (data is small, no need to re-fetch)
  const filtered = stores.filter((s) => {
    const matchesSearch =
      !search ||
      s.storeName.toLowerCase().includes(search.toLowerCase()) ||
      s.city.toLowerCase().includes(search.toLowerCase());
    const matchesGroup =
      !activeGroup ||
      s.storeGroup.toLowerCase().includes(activeGroup.toLowerCase());
    return matchesSearch && matchesGroup;
  });

  // Group the filtered list by storeGroup
  const grouped = filtered.reduce<Record<string, StoreLocation[]>>((acc, s) => {
    if (!acc[s.storeGroup]) acc[s.storeGroup] = [];
    acc[s.storeGroup].push(s);
    return acc;
  }, {});

  const handleGroupToggle = useCallback((group: string) => {
    setActiveGroup((prev) => (prev === group ? null : group));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button
          className="btn btn-ghost btn-sm btn-circle"
          onClick={() => navigate("/stores")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-lg font-bold flex-1">Explore Stores</h1>
        <button
          className="btn btn-sm btn-outline rounded-lg border-orange-400 text-orange-500 hover:bg-orange-500 hover:border-orange-500 hover:text-neutral-900 gap-1"
          onClick={openModal}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Store
        </button>
      </div>

      {/* Add Store modal */}
      <dialog ref={modalRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Add a New Store</h3>
          {formError && (
            <div role="alert" className="alert alert-error mb-4 text-sm py-2">
              <span>{formError}</span>
            </div>
          )}
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <label className="form-control">
              <div className="label"><span className="label-text">Store Name</span></div>
              <input
                className="input input-bordered w-full"
                placeholder="e.g. No Frills"
                value={form.storeName}
                onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
                required
              />
            </label>
            <label className="form-control">
              <div className="label"><span className="label-text">Store Group / Banner</span></div>
              <input
                className="input input-bordered w-full"
                placeholder="e.g. Loblaws Group"
                value={form.storeGroup}
                onChange={(e) => setForm((f) => ({ ...f, storeGroup: e.target.value }))}
                required
              />
            </label>
            <label className="form-control">
              <div className="label"><span className="label-text">Street Address</span></div>
              <input
                className="input input-bordered w-full"
                placeholder="e.g. 123 Main St"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-control">
                <div className="label"><span className="label-text">City</span></div>
                <input
                  className="input input-bordered w-full"
                  placeholder="Toronto"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  required
                />
              </label>
              <label className="form-control">
                <div className="label"><span className="label-text">Province</span></div>
                <select
                  className="select select-bordered w-full"
                  value={form.province}
                  onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                >
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="form-control">
              <div className="label"><span className="label-text">Postal Code</span></div>
              <input
                className="input input-bordered w-full"
                placeholder="M1A 1A1"
                value={form.postalCode}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                required
              />
            </label>
            <div className="modal-action mt-2">
              <button type="button" className="btn btn-ghost" onClick={() => modalRef.current?.close()}>Cancel</button>
              <button
                type="submit"
                className="btn bg-orange-500 hover:bg-orange-600 text-neutral-900 border-none"
                disabled={creating}
              >
                {creating ? <span className="loading loading-spinner loading-sm" /> : "Add Store"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>

      {/* Error */}
      {error && (
        <div role="alert" className="alert alert-error mx-4 mb-3 text-sm">
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Search */}
      <div className="px-4 mb-4">
        <label className="input input-bordered flex items-center gap-2 w-full">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            className="grow"
            placeholder="Search stores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-base-content/30 hover:text-base-content">✕</button>
          )}
        </label>
      </div>

      {/* Group filter chips */}
      {groups.length > 0 && (
        <div className="px-4 mb-1">
          <p className="text-xs text-base-content/40 font-medium uppercase tracking-wide mb-2">
            Filter by Store Group
          </p>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => handleGroupToggle(g)}
                className={`btn btn-sm rounded-full border ${
                  activeGroup === g
                    ? "btn-primary border-primary"
                    : "btn-ghost border-base-300 bg-base-100"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty search result */}
      {Object.keys(grouped).length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-base-content/30">
          <StoreIcon className="size-10" />
          <p className="text-sm">No stores match your search</p>
        </div>
      )}

      {/* Grouped store list */}
      <div className="mt-4">
        {Object.entries(grouped).map(([group, groupStores]) => (
          <div key={group}>
            {/* Section header */}
            <div className="px-4 py-2 bg-base-200">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/50">
                {group}
              </p>
            </div>

            {/* Stores in group */}
            <ul className="divide-y divide-base-200">
              {groupStores.map((store) => {
                const isSaved = savedIds.has(store.id);
                const isAdding = adding === store.id;
                return (
                  <li key={store.id} className="flex gap-3 px-4 py-4 items-center bg-base-100">
                    {/* Icon */}
                    <div className="bg-orange-500/15 text-orange-500 rounded-xl p-2.5 flex-shrink-0">
                      <StoreIcon className="size-5" />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{store.storeName}</p>
                      <p className="text-xs text-base-content/50 mt-0.5">{store.address}</p>
                      <p className="text-xs text-base-content/50">{store.city}, {store.province}</p>
                    </div>

                    {/* Action */}
                    <div className="flex-shrink-0">
                      {isSaved ? (
                        <button className="btn btn-sm rounded-lg border-green-500/40 text-green-500 bg-green-500/10 hover:bg-green-500/10 cursor-default" disabled>
                          ✓ Added
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-outline rounded-lg border-orange-400 text-orange-500 hover:bg-orange-500 hover:border-orange-500 hover:text-neutral-900"
                          onClick={() => handleAdd(store.id)}
                          disabled={isAdding}
                        >
                          {isAdding
                            ? <span className="loading loading-spinner loading-xs" />
                            : "+ Add"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
