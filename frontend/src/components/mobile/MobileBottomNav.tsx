import { NavLink, useLocation } from "react-router-dom";
import { FileText, Home, Search, User } from "lucide-react";
import { cn } from "../../lib/cn";
import { MobileFabButton, MobileFabMenu } from "./MobileFabMenu";

export function MobileBottomNav({
  fabOpen,
  onFabToggle,
  onSearch,
  signedIn,
}: {
  fabOpen: boolean;
  onFabToggle: () => void;
  onSearch: () => void;
  signedIn: boolean;
}) {
  const { pathname } = useLocation();

  const items = [
    { to: signedIn ? "/dashboard" : "/", label: "Home", icon: Home, match: (p: string) => p === "/" || p === "/dashboard" },
    { to: "/documents/new", label: "Documents", icon: FileText, match: (p: string) => p.startsWith("/documents") || p.startsWith("/view/") },
    { to: signedIn ? "/settings" : "/login", label: "Profile", icon: User, match: (p: string) => p === "/settings" || p === "/login" || p === "/register" },
  ] as const;

  return (
    <>
      <MobileFabMenu open={fabOpen} onClose={() => onFabToggle()} />
      <nav
        className="jb-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--jb-border)] bg-[var(--jb-panel)]/95 backdrop-blur-xl md:hidden"
        aria-label="Primary"
      >
        {items.slice(0, 2).map(({ to, label, icon: Icon, match }) => (
          <NavLink
            key={to}
            to={to}
            className={cn(
              "jb-touch-nav flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              match(pathname) ? "text-[var(--jb-accent)]" : "text-[var(--jb-muted)]",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={match(pathname) ? 2.25 : 1.75} />
            {label}
          </NavLink>
        ))}

        <div className="flex items-end justify-center">
          <MobileFabButton open={fabOpen} onToggle={onFabToggle} />
        </div>

        <button
          type="button"
          className="jb-touch-nav flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[var(--jb-muted)]"
          onClick={onSearch}
        >
          <Search className="h-5 w-5" strokeWidth={1.75} />
          Search
        </button>

        <NavLink
          to={items[2].to}
          className={cn(
            "jb-touch-nav flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
            items[2].match(pathname) ? "text-[var(--jb-accent)]" : "text-[var(--jb-muted)]",
          )}
        >
          <User className="h-5 w-5" strokeWidth={items[2].match(pathname) ? 2.25 : 1.75} />
          Profile
        </NavLink>
      </nav>
    </>
  );
}
