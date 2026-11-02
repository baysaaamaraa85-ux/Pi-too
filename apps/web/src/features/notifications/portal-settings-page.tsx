import { NOTIFICATION_CHANNEL_LABELS, type NotificationChannelValue } from "@pitoo/contracts";
import * as React from "react";
import { PageHeader } from "@/app/app-shell";
import { errorMessage } from "@/features/admin/list-kit";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import {
  pushSupported,
  useNotificationSettings,
  usePushAck,
  usePushSubscribe,
  useSaveNotificationSettings,
} from "./notifications-api";

const CHANNELS: NotificationChannelValue[] = ["PUSH", "EMAIL"];

// ФШ-62: эцэг эх мэдэгдлийн сувгаа (push, имэйл) сонгоно. SMS идэвхжээгүй (ТӨ-01).
export function PortalNotificationSettingsPage() {
  usePushAck();
  const settings = useNotificationSettings();
  const save = useSaveNotificationSettings();
  const subscribe = usePushSubscribe(settings.data?.vapidPublicKey);
  const [channels, setChannels] = React.useState<NotificationChannelValue[] | null>(null);
  const [email, setEmail] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const currentChannels = channels ?? settings.data?.channels ?? [];
  const currentEmail = email ?? settings.data?.email ?? "";
  const toggle = (c: NotificationChannelValue) =>
    setChannels(currentChannels.includes(c) ? currentChannels.filter((x) => x !== c) : [...currentChannels, c]);

  return (
    <>
      <PageHeader title="Мэдэгдэл" subtitle="Ирц, хуваарь, төлбөрийн мэдэгдлийг хэрхэн авах" />
      <Card className="max-w-xl">
        <CardContent className="grid gap-4 p-6">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-bold text-foreground-strong">Мэдэгдлийн суваг</legend>
            {CHANNELS.map((c) => (
              <label key={c} className="flex min-h-11 items-center gap-2.5 text-sm text-mid">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={currentChannels.includes(c)}
                  onChange={() => {
                    setSaved(false);
                    toggle(c);
                  }}
                />
                {NOTIFICATION_CHANNEL_LABELS[c]}
              </label>
            ))}
          </fieldset>

          <Field label="Имэйл хаяг" htmlFor="notif-email" hint="Имэйл сувгийн мэдэгдэл, нууц үг сэргээх холбоос энд очно.">
            <Input
              id="notif-email"
              type="email"
              value={currentEmail}
              onChange={(e) => {
                setSaved(false);
                setEmail(e.target.value);
              }}
            />
          </Field>
          <FormError message={errorMessage(save.error)} />
          {saved ? <p className="text-sm font-semibold text-success">Хадгалагдлаа.</p> : null}
          <Button
            className="w-fit"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({ channels: currentChannels, email: currentEmail }, { onSuccess: () => setSaved(true) })
            }
          >
            Хадгалах
          </Button>

          <div className="border-t border-border-warm pt-4">
            <p className="text-sm font-bold text-foreground-strong">Энэ төхөөрөмж дээр push мэдэгдэл</p>
            {!pushSupported() ? (
              <p className="mt-1 text-sm text-muted">
                Энэ хөтөч push мэдэгдэл дэмжихгүй байна. iPhone дээр апп-ыг нүүр дэлгэцэнд нэмсэний дараа ажиллана,
                эс бөгөөс имэйл сувгийг сонгоно уу.
              </p>
            ) : settings.data?.pushSubscribed ? (
              <p className="mt-1 text-sm font-semibold text-success">Бүртгэгдсэн.</p>
            ) : (
              <>
                <Button variant="secondary" className="mt-2" disabled={subscribe.isPending} onClick={() => subscribe.mutate()}>
                  Мэдэгдэл идэвхжүүлэх
                </Button>
                <FormError message={errorMessage(subscribe.error)} />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
