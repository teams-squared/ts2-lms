"use client";

import { CheckCircleIcon, CloseIcon, XIcon } from "@/components/icons";

export type ToastVariant = "success" | "error" | "info";

interface ToastProps {
  message: string;
  variant: ToastVariant;
  onDismiss: () => void;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; icon: string; border: string }> = {
  success: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    icon: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/40",
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950/40",
    icon: "text-red-600 dark:text-red-400",
    border: "border-danger/30",
  },
  info: {
    bg: "bg-primary-subtle",
    icon: "text-primary",
    border: "border-primary/30",
  },
};

function InfoCircleIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className ?? "w-5 h-5"}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function XCircleIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className ?? "w-5 h-5"}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

const VARIANT_ICON: Record<ToastVariant, React.FC<{ className?: string }>> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  info: InfoCircleIcon,
};

export function Toast({ message, variant, onDismiss }: ToastProps) {
  const styles = VARIANT_STYLES[variant];
  const IconComponent = VARIANT_ICON[variant];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-elevated animate-slide-up ${styles.bg} ${styles.border}`}
      role="status"
      aria-live="polite"
    >
      <IconComponent className={`w-5 h-5 flex-shrink-0 ${styles.icon}`} />
      <p className="text-sm font-medium text-foreground flex-1">
        {message}
      </p>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 rounded-lg text-foreground-subtle hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
