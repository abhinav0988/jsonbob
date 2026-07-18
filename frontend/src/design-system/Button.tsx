import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jb-accent)]/40 disabled:opacity-50",
  {
    variants: {
      intent: {
        ghost:
          "border border-[var(--jb-border)] bg-[var(--jb-elevated)] text-[var(--jb-text)] hover:border-[var(--jb-muted)]",
        primary: "border border-[var(--jb-accent)] bg-[var(--jb-accent)] text-white hover:bg-[var(--jb-accent-deep)]",
        danger: "border border-red-500/50 bg-red-950/40 text-red-200 hover:bg-red-900/50",
      },
      size: {
        sm: "px-2.5 py-1 text-xs",
        md: "px-3.5 py-1.5 text-sm",
        lg: "px-4 py-2",
      },
    },
    defaultVariants: { intent: "ghost", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { children: ReactNode };

export function Button({ className, intent, size, children, ...props }: ButtonProps) {
  return (
    <button type="button" className={cn(buttonVariants({ intent, size }), className)} {...props}>
      {children}
    </button>
  );
}
