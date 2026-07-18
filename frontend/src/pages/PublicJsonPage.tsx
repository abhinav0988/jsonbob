import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import { fetchRawJson } from "../api/documents";
import { JsonWorkspace } from "../components/editor/JsonWorkspace";
import { getApiBaseUrl } from "../lib/apiBase";
import { useRecentStore } from "../store/recentStore";

const API_BASE = getApiBaseUrl();

export function PublicJsonPage() {
  const { id = "" } = useParams();
  const pushRecent = useRecentStore((s) => s.push);
  const [password, setPassword] = useState("");
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rawApiUrl = `${API_BASE}/json/${id}`;

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["raw-json", id, submittedPassword],
    queryFn: () => fetchRawJson(id, submittedPassword),
    enabled: Boolean(id),
    retry: false,
  });

  useEffect(() => {
    if (data !== undefined) {
      const pretty = JSON.stringify(data, null, 2);
      setText(pretty);
      setSnapshot(pretty);
      pushRecent({
        id,
        title: id,
        href: `/view/${id}`,
        visibility: "public",
        source: "public",
        preview: pretty.replace(/\s+/g, " ").slice(0, 80),
      });
    }
  }, [data, id, pushRecent]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const content = JSON.parse(text);
      await api.put(`/json/${id}`, content, {
        headers: submittedPassword
          ? { "X-Document-Password": submittedPassword }
          : undefined,
      });
    },
    onSuccess: () => {
      setMessage("Saved");
      setErrorMsg(null);
      setSnapshot(text);
    },
    onError: (e: unknown) => {
      if (e instanceof SyntaxError) setErrorMsg("Invalid JSON");
      else setErrorMsg("Save failed");
    },
  });

  const needsPassword =
    (error as { response?: { status?: number } })?.response?.status === 401 ||
    (error as { response?: { status?: number } })?.response?.status === 403;

  if (isLoading || isFetching) {
    return <main className="flex h-full items-center justify-center text-sm opacity-70">Loading…</main>;
  }

  if (needsPassword && !data) {
    return (
      <main className="mx-auto flex h-full max-w-md items-center px-4">
        <div className="w-full">
          <h1 className="text-3xl font-semibold">Password protected</h1>
          <p className="mt-2 text-sm text-[#94a3b8]">Enter the document password to view.</p>
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedPassword(password);
            }}
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[#334155] bg-[#0b1220] px-3 py-2"
              placeholder="Password"
            />
            <button type="submit" className="rounded-md bg-[#f97316] px-4 py-2 text-sm text-white">
              Unlock
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="flex h-full items-center justify-center text-sm text-red-400">
        Document not found or expired
      </main>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {(message || errorMsg) && (
        <p
          className={`shrink-0 border-b px-4 py-2 text-sm ${
            errorMsg
              ? "border-red-900/40 bg-red-950/30 text-red-300"
              : "border-[#1f2937] bg-[#111827] text-[#fdba74]"
          }`}
        >
          {errorMsg ?? message} · {rawApiUrl}
        </p>
      )}
      <div className="min-h-0 flex-1 p-2 sm:p-3">
        <JsonWorkspace
          value={text}
          onChange={setText}
          initialSnapshot={snapshot}
          documentId={id}
          onSave={() => saveMutation.mutate()}
          saving={saveMutation.isPending}
          actions={
            <>
              <button
                type="button"
                className="jb-action"
                onClick={() =>
                  void navigator.clipboard.writeText(`${window.location.origin}/view/${id}`)
                }
              >
                Copy URL
              </button>
              <a href={rawApiUrl} target="_blank" rel="noreferrer" className="jb-action">
                Raw
              </a>
            </>
          }
        />
      </div>
    </div>
  );
}
