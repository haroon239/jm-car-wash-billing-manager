const JSON_HEADERS = { "Content-Type": "application/json" };

export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: options?.body ? { ...JSON_HEADERS, ...options.headers } : options?.headers,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message ?? "Request failed");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
