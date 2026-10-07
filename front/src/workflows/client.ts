import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FileRecord, WorkspaceView } from "./types";
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init.method && init.method !== "GET" ? { "X-Request-Id": crypto.randomUUID() } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    let body: { message?: string } = {};
    try {
      body = await response.json();
    } catch {
      /* Keep a readable error if upstream is unavailable. */
    }
    throw new Error(body.message || "Impossible de sauvegarder. Votre saisie est conservée.");
  }
  return response.json();
}
export const workspaceKey = ["workspace"];
export function useWorkspace() {
  return useQuery({
    queryKey: workspaceKey,
    queryFn: () => api<WorkspaceView>("/api/v2/workspace"),
    staleTime: 5000,
    retry: 1,
    refetchInterval: (query) =>
      query.state.data?.flow.campaigns.some((c) => ["running", "scheduled"].includes(c.status))
        ? 4000
        : false,
  });
}
export function useAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, payload }: { type: string; payload: Record<string, unknown> }) =>
      api<{ entityId: string; message: string }>("/api/v2/actions", {
        method: "POST",
        body: JSON.stringify({ type, payload }),
      }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
export function useFileUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; [key: string]: unknown }) =>
      api<FileRecord>(`/api/v2/files/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKey }),
  });
}
export const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
export const datetime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
    : "—";
export const shortDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("fr-FR") : "—";
export const localInput = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
export function downloadCSV(name: string, rows: unknown[][]) {
  const escaped = rows
    .map((row) =>
      row
        .map((v) => {
          let value = String(v ?? "");
          if (/^[-=+@]/.test(value)) value = "'" + value;
          return '"' + value.replace(/"/g, '""') + '"';
        })
        .join(";"),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + escaped], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
