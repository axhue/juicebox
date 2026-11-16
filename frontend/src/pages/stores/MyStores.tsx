import { useEffect, useState } from "react";
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
  createdAt: string;
}

interface UserStore {
  id: string;
  userId: string;
  locationId: string;
  createdAt: string;
  location: StoreLocation;
}

interface ApiResponse {
  data: UserStore[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

const StoreIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72" />
  </svg>
);

export default function MyStores() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [userStores, setUserStores] = useState<UserStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ApiResponse>("/api/users/stores", token)
      .then((res) => setUserStores(res.data))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load stores")
      )
      .finally(() => setLoading(false));
  }, [token]);

  const handleRemove = async (userStoreId: string) => {
    setRemoving(userStoreId);
    try {
      await apiFetch(`/api/users/stores/${userStoreId}`, token, { method: "DELETE" });
      setUserStores((prev) => prev.filter((s) => s.id !== userStoreId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove store");
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">

      {/* Page header */}
      <h1 className="text-2xl font-bold tracking-tight uppercase mb-1">My Stores</h1>
      <p className="text-base-content/50 text-sm mb-5">
        {userStores.length} {userStores.length === 1 ? "store" : "stores"} saved
      </p>

      {/* Error alert */}
      {error && (
        <div role="alert" className="alert alert-error mb-4 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Empty state */}
      {userStores.length === 0 && !error && (
        <div className="card bg-base-200 shadow-none">
          <div className="card-body items-center text-center py-16 gap-3">
            <StoreIcon className="size-12 text-base-content/20" />
            <p className="text-base-content/40 text-sm">No stores saved yet</p>
          </div>
        </div>
      )}

      {/* Store list */}
      {userStores.length > 0 && (
        <ul className="list bg-base-100 rounded-box shadow-sm border border-base-200">
          {userStores.map((userStore, index) => {
            const loc = userStore.location;
            const isLast = index === userStores.length - 1;
            return (
              <li key={userStore.id} className={`list-row items-center py-4 ${!isLast ? "border-b border-base-200" : ""}`}>

                {/* Store icon */}
                <div className="bg-orange-500/15 text-orange-500 rounded-xl p-2.5 flex-shrink-0">
                  <StoreIcon className="size-5" />
                </div>

                {/* Store details */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm leading-snug">{loc.storeName}</p>
                  <p className="text-xs text-base-content/50 mt-0.5">{loc.address}</p>
                  <p className="text-xs text-base-content/50">{loc.city}, {loc.province}</p>

                  {/* Meta badges */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <div className="badge badge-ghost badge-sm gap-1 text-base-content/40">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                      </svg>
                      {loc.city}
                    </div>
                    <div className="badge badge-ghost badge-sm gap-1 text-base-content/40">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                      </svg>
                      Added {new Date(userStore.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <button
                    className="btn btn-ghost btn-xs text-base-content/30 hover:text-error"
                    onClick={() => handleRemove(userStore.id)}
                    disabled={removing === userStore.id}
                  >
                    {removing === userStore.id
                      ? <span className="loading loading-spinner loading-xs" />
                      : "Remove"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Find Stores button — always visible at bottom */}
      <button
        className="btn btn-outline w-full rounded-xl border-orange-400 text-orange-500 hover:bg-orange-500 hover:border-orange-500 hover:text-neutral-900 mt-5"
        onClick={() => navigate("/stores/explore")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        Find Stores
      </button>
    </div>
  );
}
