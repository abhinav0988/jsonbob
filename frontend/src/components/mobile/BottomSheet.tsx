import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { cn } from "../../lib/cn";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  tall = false,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  tall?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const trapRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] md:hidden" role="presentation">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "jb-mobile-sheet absolute inset-x-0 bottom-0 flex flex-col rounded-t-[1.25rem] border border-[var(--jb-border)] bg-[var(--jb-panel)] shadow-[var(--jb-shadow-sheet)]",
              tall ? "max-h-[92dvh]" : "max-h-[78dvh]",
              className,
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={reduce ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 380 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 400) onClose();
            }}
          >
            <div className="flex shrink-0 flex-col items-center pt-2 pb-1">
              <div className="mb-2 h-1 w-10 rounded-full bg-[var(--jb-border)]" aria-hidden />
              {title && (
                <div className="flex w-full items-center gap-2 px-4 pb-2">
                  <h2 className="flex-1 text-base font-semibold tracking-tight">{title}</h2>
                  <button
                    type="button"
                    aria-label="Close sheet"
                    className="jb-touch-icon"
                    onClick={onClose}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
            <div className="jb-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
