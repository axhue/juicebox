const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function apiFetch<T>(
  path: string,
  token: string | null,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Guard against HTML error pages (e.g. Express default 404, server not running)
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Server error (${res.status}): expected JSON but received ${contentType || "unknown content type"}`);
  }

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error?.message ?? "API request failed");
  }

  return json as T;
}
