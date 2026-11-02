import { PermanentChannelError, type ChannelAdapter } from "./notifications.channels.js";

// ФШ-64 (Could), ТӨ-01: SMS-ийн зардлыг төв батлаагүй тул адаптер зөвхөн интерфэйс хэлбэртэй.
// Төв батлахад энд HTTP дуудлага бичиж registry-д бүртгэнэ, өөр код өөрчлөгдөхгүй (ЧХ-8).
export function createSmsAdapter(): ChannelAdapter {
  return {
    channel: "SMS",
    async send() {
      throw new PermanentChannelError("SMS суваг идэвхжээгүй байна (төв зардлыг батлаагүй).");
    },
  };
}
