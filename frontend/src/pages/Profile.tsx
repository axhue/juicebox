import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

interface MyEntry {
  id: string;
  price: string;
  weight: string;
  unit: string;
  pricePerKg: string;
  datetime: string;
  item: { id: string; productName: string };
  location: { storeName: string; city: string };
}

const UNIT_ABBR: Record<string, string> = { KG: "kg", G: "g", L: "L", ML: "mL", LBS: "lbs", OZ: "oz", UNIT: "" };

export default function Profile() {
  const { user, token, signOut } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<MyEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: MyEntry[]; pagination: { hasNextPage: boolean } }>(`/api/prices?mine=1&page=${page}&limit=10`, token)
      .then((r) => { setEntries((prev) => (page === 1 ? r.data : [...prev, ...r.data])); setHasMore(r.pagination.hasNextPage); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page]);

  if (!user) return null;

  const rows = [
    ["Email", user.email],
    ["Location", user.location ?? "Not set"],
    ["Member since", new Date(user.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "long" })],
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold tracking-tight uppercase mb-1">Profile</h1>
      <p className="text-base-content/50 text-sm mb-6">Your JuiceBox account</p>

      <div className="flex items-center gap-4 mb-6">
        <div className="size-16 rounded-full bg-orange-500/15 text-orange-500 flex items-center justify-center text-2xl font-bold">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-lg font-semibold">{user.name}</p>
          <span className="badge badge-sm badge-ghost">{user.role}</span>
        </div>
      </div>

      <div className="bg-base-200 rounded-xl px-4 py-3 text-sm flex flex-col gap-2 mb-6">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <span className="text-base-content/50">{label}</span>
            <span className="font-medium text-right">{value}</span>
          </div>
        ))}
      </div>

      <p className="text-xs font-semibold tracking-widest text-base-content/40 uppercase mb-3">My Entries</p>
      {loading ? (
        <div className="flex flex-col gap-2 mb-6">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-base-content/40 py-4 mb-6">You haven't logged any prices yet.</p>
      ) : (
        <ul className="divide-y divide-base-200 border border-base-200 rounded-xl overflow-hidden mb-3">
          {entries.map((e) => (
            <li key={e.id}>
              <button className="w-full text-left bg-base-100 px-4 py-3 flex items-center justify-between gap-3" onClick={() => navigate(`/items/${e.item.id}`)}>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{e.item.productName}</p>
                  <p className="text-xs text-base-content/50 truncate">{e.location.storeName} · {e.location.city}</p>
                  <p className="text-xs text-base-content/40">{new Date(e.datetime).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-orange-500">${Number(e.price).toFixed(2)}</p>
                  <p className="text-xs text-base-content/40">{Number(e.weight)}{UNIT_ABBR[e.unit] ?? ""} · ${Number(e.pricePerKg).toFixed(2)}/{e.unit === "L" || e.unit === "ML" ? "L" : e.unit === "UNIT" ? "unit" : "kg"}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <button className="text-sm font-medium text-orange-500 hover:text-orange-600 mb-6" onClick={() => setPage((p) => p + 1)}>
          Load more →
        </button>
      )}

      <button
        className="btn btn-outline w-full rounded-xl border-orange-400 text-orange-500 hover:bg-orange-500 hover:border-orange-500 hover:text-neutral-900 mt-3"
        onClick={() => signOut().then(() => navigate("/login"))}
      >
        Sign out
      </button>
    </div>
  );
}
