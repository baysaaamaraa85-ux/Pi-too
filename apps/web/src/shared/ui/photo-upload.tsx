import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { ApiError, api } from "@/shared/api-client/client";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { FormError } from "@/shared/ui/field";
import { cn } from "@/shared/ui/utils";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;

// ФШ-78: зураг сонгоод шууд серверт илгээнэ. Шалгалтыг сервер дахин хийнэ (магик байт, хэмжээ).
export function PhotoUpload({
  uploadPath,
  currentUrl,
  name,
  onUploaded,
  shape = "round",
  label = "Зураг оруулах",
}: {
  uploadPath: string;
  currentUrl: string | null | undefined;
  name: string;
  onUploaded: () => unknown;
  shape?: "round" | "wide";
  label?: string;
}) {
  const queryClient = useQueryClient();
  const input = React.useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const upload = useMutation({
    mutationFn: (file: File) => api.upload<{ photoUrl: string }>(uploadPath, file),
    onSuccess: async () => {
      setDone(true);
      // Нийтийн сайтын багш, салбарын жагсаалт шинэ зургаа шууд харуулна.
      await queryClient.invalidateQueries({ queryKey: ["public"] });
      await onUploaded();
    },
  });

  function pick(file: File | undefined) {
    setLocalError(null);
    setDone(false);
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setLocalError("Зөвхөн JPG, PNG эсвэл WEBP зураг оруулна уу.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("Зураг 3 MB-аас бага байх ёстой.");
      return;
    }
    upload.mutate(file);
  }

  const serverError = upload.error instanceof ApiError ? upload.error.problem.detail : upload.error ? "Зураг оруулж чадсангүй." : null;
  return (
    <div className="flex flex-wrap items-center gap-4">
      {shape === "round" ? (
        <Avatar url={currentUrl} name={name} className="size-20 text-3xl" />
      ) : (
        <span
          className={cn(
            "grid h-24 w-36 shrink-0 place-items-center overflow-hidden rounded-xl bg-background-soft text-xs text-muted",
          )}
        >
          {currentUrl ? <img src={currentUrl} alt="" className="size-full object-cover" /> : "Зураггүй"}
        </span>
      )}
      <div className="grid gap-2">
        <input
          ref={input}
          type="file"
          accept={ACCEPT.join(",")}
          aria-label={label}
          data-testid="photo-input"
          className="sr-only"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="secondary" className="w-fit" disabled={upload.isPending} onClick={() => input.current?.click()}>
          {upload.isPending ? "Оруулж байна..." : currentUrl ? "Зураг солих" : label}
        </Button>
        <p className="text-xs text-muted">JPG, PNG, WEBP, 3 MB хүртэл.</p>
        <FormError message={localError ?? serverError} />
        {done && !upload.isPending ? <p className="text-sm font-semibold text-success">Зураг хадгалагдлаа.</p> : null}
      </div>
    </div>
  );
}
