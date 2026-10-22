import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./button";

// ФБШ-12: мөнгө, ирц, хуваарьт нөлөөлөх үйлдэл баталгаажуулах цонхтой.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Тийм",
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-6 shadow-lg">
          <Dialog.Title className="font-display text-lg font-bold text-foreground-strong">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
              Болих
            </Button>
            <Button size="sm" onClick={onConfirm} disabled={busy}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
