import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md glass rounded-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${destructive ? "bg-ember/[0.1] border-ember/40 text-ember" : "bg-plasma/[0.1] border-plasma/40 text-plasma"}`}>
                <AlertTriangle size={16} />
              </div>
              <div className="flex-1">
                <div className="font-display text-lg tracking-tight text-fg">{title}</div>
                <p className="mt-2 text-sm text-muted">{description}</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-line text-sm text-subtle hover:bg-panel/60 hover:text-fg transition-all">
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={
                  destructive
                    ? "px-4 py-2 rounded-xl text-sm text-fg font-medium bg-ember border border-ember/30 hover:shadow-[0_0_16px_rgba(173,13,3,0.35)] transition-all"
                    : "px-4 py-2 rounded-xl text-sm text-fg font-medium bg-plasma border border-plasma/30 hover:border-lumen/50 hover:shadow-[0_0_16px_rgba(74,203,235,0.35)] transition-all"
                }
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
