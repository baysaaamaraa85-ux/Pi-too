// ФБШ-15, ADR-007: сүлжээгүй үед бүртгэсэн ирцийг төхөөрөмжийн IndexedDB-д хадгалж, холболт
// сэргэхэд ЯГ ТЭР Idempotency-Key-ээр илгээнэ (сервер давхар боловсруулахгүй). Хадгалагдах
// өгөгдөл: хичээлийн ID, гэрээний ID, "ирсэн эсэх". Token, нэр, хувийн мэдээлэл хадгалахгүй.

const DB_NAME = "pitoo-offline";
const STORE = "attendance";
const DB_VERSION = 1;

export interface QueuedAttendance {
  // Нэг хичээлд нэг дараалал (түлхүүр).
  lessonId: string;
  // Дарааллыг үүсгэсэн хэрэглэгч: зөвхөн тэр хэрэглэгч өөрийн token-оор илгээнэ.
  userId: string;
  key: string;
  entries: { contractId: string; present: boolean; actualFrom?: string; actualTo?: string }[];
  reason?: string;
  createdAt: string;
  // rejected: сервер хүсэлтийг татгалзсан (жишээ нь 24 цаг өнгөрсөн), хэрэглэгч шийднэ.
  status: "pending" | "rejected";
  error?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "lessonId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// Ижил цонхны бүрэлдэхүүнүүд (баннер, ирцийн дэлгэц) өөрчлөлтийг мэдэхэд.
const changes = new EventTarget();
const CHANGE = "queue-change";
const notify = () => changes.dispatchEvent(new Event(CHANGE));

export function subscribeQueue(listener: () => void): () => void {
  changes.addEventListener(CHANGE, listener);
  return () => changes.removeEventListener(CHANGE, listener);
}

export async function enqueueAttendance(
  item: Omit<QueuedAttendance, "status" | "createdAt" | "error">,
): Promise<void> {
  await run("readwrite", (store) =>
    store.put({ ...item, createdAt: new Date().toISOString(), status: "pending" } satisfies QueuedAttendance),
  );
  notify();
}

export async function listQueued(userId: string): Promise<QueuedAttendance[]> {
  const all = await run<QueuedAttendance[]>("readonly", (store) => store.getAll());
  return all
    .filter((item) => item.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeQueued(lessonId: string): Promise<void> {
  await run("readwrite", (store) => store.delete(lessonId));
  notify();
}

export async function markRejected(lessonId: string, error: string): Promise<void> {
  const current = await run<QueuedAttendance | undefined>("readonly", (store) => store.get(lessonId));
  if (!current) return;
  await run("readwrite", (store) => store.put({ ...current, status: "rejected", error }));
  notify();
}
