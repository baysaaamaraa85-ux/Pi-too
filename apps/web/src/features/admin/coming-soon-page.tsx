import { PageHeader } from "@/app/app-shell";

// Дараагийн шатуудад хэрэгжих хэсгүүдийн түр хуудас.
export function ComingSoonPage({ title, text }: { title: string; text: string }) {
  return (
    <>
      <PageHeader title={title} />
      <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
        {text}
      </p>
    </>
  );
}
