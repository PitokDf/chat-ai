"use client";

import { useEffect } from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { AlertTriangle, CheckCircle2, Info as InfoIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToasts, type Toast } from "@/lib/store/toast";

const KIND_ICON = {
  info: <InfoIcon className="h-4 w-4 text-sky-400" />,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  error: <AlertTriangle className="h-4 w-4 text-destructive" />,
} as const;

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  const duration = toast.duration ?? 3000;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = window.setTimeout(() => dismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, duration, dismiss]);

  return (
    <ToastPrimitive.Root
      data-slot="toast"
      duration={duration <= 0 ? Infinity : duration}
      onOpenChange={(open) => {
        if (!open) dismiss(toast.id);
      }}
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 shadow-xl",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80",
        "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out]",
        "data-[swipe=end]:animate-out data-[state=open]:slide-in-from-bottom-2",
      )}
    >
      <span className="mt-0.5">{KIND_ICON[toast.kind]}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <ToastPrimitive.Title className="text-xs font-medium text-foreground">
          {toast.title}
        </ToastPrimitive.Title>
        {toast.description ? (
          <ToastPrimitive.Description className="text-[11px] text-muted-foreground">
            {toast.description}
          </ToastPrimitive.Description>
        ) : null}
      </div>
      <ToastPrimitive.Close
        aria-label="Close"
        className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
      <ToastPrimitive.Viewport className="pointer-events-none fixed bottom-4 right-4 z-100 flex w-[min(92vw,360px)] flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
