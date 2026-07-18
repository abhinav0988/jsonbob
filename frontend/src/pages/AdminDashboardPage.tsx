import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  adminDeleteDocument,
  getAdminAnalytics,
  listAdminDocuments,
  listAdminUsers,
  patchAdminUser,
} from "../api/analytics";
import { useAuthStore } from "../store/authStore";

export function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: getAdminAnalytics,
    enabled: user?.role === "admin",
  });
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdminUsers,
    enabled: user?.role === "admin",
  });
  const { data: docs } = useQuery({
    queryKey: ["admin-docs", search],
    queryFn: () => listAdminDocuments(search || undefined),
    enabled: user?.role === "admin",
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "free" | "premium" | "admin" }) =>
      patchAdminUser(id, { role }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: adminDeleteDocument,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-docs"] });
      void qc.invalidateQueries({ queryKey: ["admin-analytics"] });
    },
  });

  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl">Admin</h1>
      <p className="mt-1 text-sm text-[var(--color-slate)]">Platform overview and controls</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Users" value={String(stats?.totalUsers ?? "—")} />
        <Stat label="Documents" value={String(stats?.totalDocuments ?? "—")} />
        <Stat label="Storage" value={`${stats?.storageUsedBytes ?? 0} B`} />
        <Stat label="API requests" value={String(stats?.apiRequestCount ?? "—")} />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Users</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-[var(--color-slate)]">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {users?.items.map((u) => (
                <tr key={u.id} className="border-t border-[var(--color-mist)] dark:border-[var(--color-line)]">
                  <td className="py-2">{u.name}</td>
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">{u.role}</td>
                  <td className="py-2">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        roleMutation.mutate({
                          id: u.id,
                          role: e.target.value as "free" | "premium" | "admin",
                        })
                      }
                      className="rounded border border-[var(--color-mist)] bg-transparent px-2 py-1 dark:border-[var(--color-line)] dark:bg-[var(--color-panel)]"
                    >
                      <option value="free">free</option>
                      <option value="premium">premium</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Documents</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="rounded-md border border-[var(--color-mist)] bg-transparent px-3 py-1.5 text-sm dark:border-[var(--color-line)]"
          />
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {docs?.items.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-mist)] px-3 py-2 dark:border-[var(--color-line)]"
            >
              <div>
                <div className="font-medium">{d.name || d.id}</div>
                <div className="font-mono text-xs opacity-60">{d.id}</div>
              </div>
              <button
                type="button"
                className="text-red-500"
                onClick={() => {
                  if (confirm("Force delete?")) deleteMutation.mutate(d.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-mist)] px-4 py-3 dark:border-[var(--color-line)]">
      <div className="text-xs uppercase tracking-wide text-[var(--color-slate)]">{label}</div>
      <div className="mt-1 text-lg font-medium">{value}</div>
    </div>
  );
}
