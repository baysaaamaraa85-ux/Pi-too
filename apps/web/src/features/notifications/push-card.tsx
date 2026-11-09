import { errorMessage } from "@/features/admin/list-kit";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { FormError } from "@/shared/ui/field";
import {
  pushSupported,
  useNotificationSettings,
  usePushAck,
  usePushSubscribe,
} from "./notifications-api";

// ФШ-30, 36, 62: багш чөлөөний хүсэлт, багц дуусах мэдэгдлийг push-ээр авна. Энэ төхөөрөмж
// бүртгэгдээгүй бол нэг товчоор идэвхжүүлнэ. Бүртгэгдсэн, дэмжигдэхгүй, сервер тохируулаагүй бол харагдахгүй.
export function PushEnableCard() {
  usePushAck();
  const settings = useNotificationSettings();
  const subscribe = usePushSubscribe(settings.data?.vapidPublicKey);

  if (!pushSupported() || !settings.data || settings.data.pushSubscribed || !settings.data.vapidPublicKey) {
    return null;
  }
  return (
    <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4" data-testid="push-card">
      <p className="text-sm text-mid">
        Чөлөө хүссэн, багц дуусах мэдэгдлийг утсандаа шууд авахын тулд идэвхжүүлнэ үү.
      </p>
      <Button variant="secondary" disabled={subscribe.isPending} onClick={() => subscribe.mutate()}>
        Мэдэгдэл идэвхжүүлэх
      </Button>
      <FormError message={errorMessage(subscribe.error)} />
    </Card>
  );
}
