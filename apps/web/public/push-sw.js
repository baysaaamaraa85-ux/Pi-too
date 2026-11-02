// Web Push service worker (ФШ-62, ADR-005). Мэдэгдлийг төхөөрөмж дээр харуулж, нээлттэй
// цонх байвал "хүрсэн" гэж апп-д мэдэгдэнэ (апп нь API-д ack хийж DELIVERED болгоно).
// Нэвтрэлтийн token санах ойд л байдаг тул service worker өөрөө API дуудахгүй.

self.addEventListener("push", (event) => {
  let data = { title: "Пи тоо", body: "Танд шинэ мэдэгдэл ирлээ.", url: "/", id: null };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // JSON биш бол анхдагч бичвэрийг харуулна.
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title, {
        body: data.body,
        data: { url: data.url },
        icon: "/favicon.svg",
        badge: "/favicon.svg",
      });
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) client.postMessage({ type: "push-received", id: data.id });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.openWindow(url));
});
