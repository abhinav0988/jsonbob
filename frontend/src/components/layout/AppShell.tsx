import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileJson, GitCompare, Library, Settings, Terminal } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { logout as apiLogout } from "../../api/auth";
import { listDocuments } from "../../api/documents";
import { SettingsHelpMenus } from "./SettingsHelpMenus";
import { useThemeStore } from "../../store/themeStore";
import {
  CommandPalette,
  useGlobalPaletteActions,
  type PaletteAction,
} from "../../features/command-palette/CommandPalette";
import { ShortcutsModal } from "../../features/shortcuts/ShortcutsModal";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useEditorActionsStore } from "../../store/editorActionsStore";
import { MobileBottomNav } from "../mobile/MobileBottomNav";
import { useIsMobile } from "../../hooks/useIsMobile";
import { cn } from "../../lib/cn";

function isEditorRoute(pathname: string) {
  if (pathname === "/documents/new") return true;
  if (pathname === "/compare") return true;
  if (pathname.startsWith("/view/")) return true;
  if (pathname.startsWith("/documents/") && pathname !== "/documents/new") return true;
  return false;
}

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);
  const dark = useThemeStore((s) => s.dark);
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const editorMode = isEditorRoute(pathname);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const [railHover, setRailHover] = useState(false);
  const railWide = railExpanded || railHover;
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeId = useWorkspaceStore((s) => s.activeId);
  const setActive = useWorkspaceStore((s) => s.setActive);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const togglePin = useWorkspaceStore((s) => s.togglePin);

  const editorActions = useEditorActionsStore((s) => s.actions);
  const pathIndex = useEditorActionsStore((s) => s.pathIndex);
  const focusPath = useEditorActionsStore((s) => s.focusPath);

  const { data: docs } = useQuery({
    queryKey: ["documents", "palette"],
    queryFn: () => listDocuments({ page: 1 }),
    enabled: Boolean(accessToken) && paletteOpen,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isMobile) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setRailExpanded((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile]);

  const railLinks = useMemo(
    () =>
      [
        { to: "/documents/new", label: "Editor", icon: FileJson, show: true },
        { to: "/compare", label: "Compare", icon: GitCompare, show: true },
        { to: "/api-playground", label: "API", icon: Terminal, show: true },
        { to: "/dashboard", label: "Library", icon: Library, show: Boolean(user) },
        { to: "/settings", label: "Settings", icon: Settings, show: true },
      ] as const,
    [user],
  );

  const extras = useMemo<PaletteAction[]>(() => {
    const docActions: PaletteAction[] = (docs?.items ?? []).slice(0, 40).map((d) => ({
      id: `doc-${d.id}`,
      label: d.name || d.id,
      group: "Documents",
      keywords: `${d.id} ${d.visibility} ${d.name ?? ""}`,
      run: () => navigate(`/documents/${d.id}`),
    }));

    const pathActions: PaletteAction[] = pathIndex.slice(0, 80).map((p) => ({
      id: `path-${p}`,
      label: p,
      group: "JSON paths",
      keywords: `path node ${p}`,
      run: () => focusPath?.(p),
    }));

    return [
      {
        id: "palette-help",
        label: "Keyboard shortcuts",
        group: "Help",
        keywords: "shortcut keymap",
        shortcut: "⌘/",
        run: () => setShortcutsOpen(true),
      },
      {
        id: "nav-api",
        label: "Open API Playground",
        group: "Navigate",
        run: () => navigate("/api-playground"),
      },
      ...editorActions,
      ...docActions,
      ...pathActions,
    ];
  }, [docs?.items, editorActions, focusPath, navigate, pathIndex]);

  const actions = useGlobalPaletteActions(extras);

  async function handleLogout() {
    try {
      await apiLogout(refreshToken);
    } catch {
      // ignore
    }
    logout();
  }

  const mobileTitle = useMemo(() => {
    if (pathname === "/" || pathname === "/dashboard") return "Home";
    if (pathname === "/documents/new") return "Editor";
    if (pathname.startsWith("/documents/")) return "Document";
    if (pathname === "/compare") return "Compare";
    if (pathname === "/settings") return "Profile";
    if (pathname === "/login") return "Sign in";
    return "jsonbob";
  }, [pathname]);

  return (
    <div
      className={cn(
        "flex h-svh flex-col overflow-hidden bg-[var(--jb-canvas)] text-[var(--jb-text)]",
        dark && "dark",
      )}
    >
      {/* Mobile header */}
      <header className="z-20 shrink-0 border-b border-[var(--jb-border)] bg-[var(--jb-panel)]/95 backdrop-blur-xl md:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <Link to={user ? "/dashboard" : "/"} className="text-lg font-semibold tracking-tight">
            <span>json</span>
            <span className="text-[var(--jb-accent)]">bob</span>
          </Link>
          <span className="text-sm font-medium text-[var(--jb-muted)]">{mobileTitle}</span>
          <button
            type="button"
            className="jb-touch-icon"
            aria-label="Search"
            onClick={() => setPaletteOpen(true)}
          >
            ⌕
          </button>
        </div>
      </header>

      {/* Desktop header */}
      <header className="z-20 hidden shrink-0 border-b border-[var(--jb-border)] bg-[var(--jb-panel)]/95 backdrop-blur md:block">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4">
          <Link to="/documents/new" className="flex items-baseline text-[22px] font-semibold tracking-tight">
            <span>json</span>
            <span className="text-[var(--jb-accent)]">bob</span>
          </Link>

          <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm text-[var(--jb-muted)]">
            <button
              type="button"
              className="rounded border border-[var(--jb-border)] px-2 py-1 font-mono text-[11px] hover:text-[var(--jb-text)]"
              onClick={() => setPaletteOpen(true)}
              title="Command palette"
            >
              ⌘K
            </button>
            <NavLink to="/documents/new" className="hover:text-[var(--jb-accent-soft)]">
              Editor
            </NavLink>
            <NavLink to="/compare" className="hover:text-[var(--jb-accent-soft)]">
              Compare
            </NavLink>
            <NavLink to="/api-playground" className="hover:text-[var(--jb-accent-soft)]">
              API
            </NavLink>
            {user && (
              <NavLink to="/dashboard" className="hover:text-[var(--jb-accent-soft)]">
                Library
              </NavLink>
            )}
            <SettingsHelpMenus />
            {user ? (
              <>
                {user.role === "admin" && (
                  <NavLink to="/admin" className="hover:text-[var(--jb-accent-soft)]">
                    Admin
                  </NavLink>
                )}
                <button type="button" onClick={handleLogout} className="hover:text-[var(--jb-accent-soft)]">
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="hover:text-[var(--jb-accent-soft)]">
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className="rounded bg-[var(--jb-accent)] px-3 py-1.5 text-white hover:opacity-90"
                >
                  Sign up
                </NavLink>
              </>
            )}
          </nav>
        </div>

        {tabs.length > 0 && (
          <div className="jb-scroll flex gap-1 overflow-x-auto border-t border-[var(--jb-border)] px-2 py-1">
            {tabs
              .slice()
              .sort((a, b) => Number(b.pinned) - Number(a.pinned))
              .map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "group flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs",
                    activeId === t.id
                      ? "border-[var(--jb-accent)]/50 bg-[var(--jb-accent)]/10 text-[var(--jb-text)]"
                      : "border-transparent text-[var(--jb-muted)] hover:bg-[var(--jb-elevated)]",
                  )}
                >
                  <button
                    type="button"
                    className="max-w-[9rem] truncate"
                    onClick={() => {
                      setActive(t.id);
                      navigate(t.href);
                    }}
                  >
                    {t.pinned ? "◆ " : ""}
                    {t.title}
                  </button>
                  <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => togglePin(t.id)}>
                    ·
                  </button>
                  <button type="button" className="opacity-50 hover:opacity-100" onClick={() => closeTab(t.id)}>
                    ×
                  </button>
                </div>
              ))}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            "hidden shrink-0 flex-col border-r border-[var(--jb-border)] bg-[var(--jb-panel)]/80 transition-[width] duration-200 ease-out md:flex",
            railWide ? "w-[180px]" : "w-14",
          )}
          onMouseEnter={() => setRailHover(true)}
          onMouseLeave={() => setRailHover(false)}
          aria-label="App navigation"
        >
          <nav className="flex flex-1 flex-col gap-0.5 p-2">
            {railLinks
              .filter((l) => l.show)
              .map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={label}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-[var(--jb-accent)]/15 text-[var(--jb-accent-soft)]"
                        : "text-[var(--jb-muted)] hover:bg-[var(--jb-elevated)] hover:text-[var(--jb-text)]",
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className={cn("truncate transition-opacity duration-150", railWide ? "opacity-100" : "sr-only opacity-0")}>
                    {label}
                  </span>
                </NavLink>
              ))}
          </nav>
          <p className={cn("px-3 pb-3 font-mono text-[10px] text-[var(--jb-muted)] transition-opacity", railWide ? "opacity-70" : "opacity-0")}>
            ⌘B
          </p>
        </aside>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1",
            editorMode ? "overflow-hidden" : "overflow-y-auto overscroll-contain",
            isMobile ? "pb-[var(--jb-nav-height)]" : "",
          )}
        >
          <Outlet />
        </div>
      </div>

      {isMobile && (
        <MobileBottomNav
          fabOpen={fabOpen}
          onFabToggle={() => setFabOpen((v) => !v)}
          onSearch={() => setPaletteOpen(true)}
          signedIn={Boolean(user)}
        />
      )}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} actions={actions} mobile={isMobile} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
