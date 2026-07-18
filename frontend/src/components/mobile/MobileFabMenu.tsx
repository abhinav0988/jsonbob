import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ClipboardPaste,
  FileJson,
  FileUp,
  History,
  Plus,
  QrCode,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/cn";

type FabAction = {
  id: string;
  label: string;
  icon: typeof Plus;
  onClick: () => void;
};

export function MobileFabMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  function userHome() {
    return "/dashboard";
  }

  const actions: FabAction[] = [
    {
      id: "new",
      label: "New JSON",
      icon: FileJson,
      onClick: () => {
        onClose();
        navigate("/documents/new");
      },
    },
    {
      id: "paste",
      label: "Paste JSON",
      icon: ClipboardPaste,
      onClick: async () => {
        onClose();
        try {
          const text = await navigator.clipboard.readText();
          sessionStorage.setItem("jb-template", text);
        } catch {
          /* empty ok */
        }
        navigate("/documents/new");
      },
    },
    {
      id: "import",
      label: "Import file",
      icon: FileUp,
      onClick: () => {
        onClose();
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,.yaml,.yml,.txt";
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          try {
            sessionStorage.setItem("jb-template", await file.text());
          } catch {
            /* ignore */
          }
          navigate("/documents/new");
        };
        input.click();
      },
    },
    {
      id: "qr",
      label: "Scan QR",
      icon: QrCode,
      onClick: () => {
        onClose();
        navigate("/api-playground");
      },
    },
    {
      id: "recent",
      label: "Open recent",
      icon: History,
      onClick: () => {
        onClose();
        navigate(userHome());
      },
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[85] md:hidden">
          <motion.button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="absolute inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex flex-col items-center gap-3 px-6">
            {actions.map((a, i) => (
              <motion.button
                key={a.id}
                type="button"
                initial={{ opacity: 0, y: 16, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { delay: i * 0.04, type: "spring", stiffness: 420, damping: 28 }
                }
                className="jb-mobile-card flex w-full max-w-sm items-center gap-4 px-4 py-3.5 text-left active:scale-[0.98]"
                onClick={a.onClick}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--jb-accent)]/15 text-[var(--jb-accent)]">
                  <a.icon className="h-5 w-5" />
                </span>
                <span className="text-[15px] font-medium">{a.label}</span>
              </motion.button>
            ))}
          </div>
          <motion.button
            type="button"
            aria-label="Close"
            className={cn(
              "absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2",
              "flex h-14 w-14 items-center justify-center rounded-full bg-[var(--jb-elevated)] text-[var(--jb-text)] shadow-lg ring-2 ring-[var(--jb-border)]",
            )}
            initial={{ rotate: 0 }}
            animate={{ rotate: 45 }}
            exit={{ rotate: 0 }}
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </motion.button>
        </div>
      )}
    </AnimatePresence>
  );
}

export function MobileFabButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      aria-label={open ? "Close create menu" : "Create"}
      aria-expanded={open}
      className="relative -mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--jb-accent)] text-white shadow-[var(--jb-shadow-fab)] ring-4 ring-[var(--jb-panel)] active:scale-95"
      onClick={onToggle}
    >
      <motion.span
        animate={{ rotate: open ? 45 : 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 22 }}
      >
        <Plus className="h-7 w-7" strokeWidth={2.25} />
      </motion.span>
    </button>
  );
}
