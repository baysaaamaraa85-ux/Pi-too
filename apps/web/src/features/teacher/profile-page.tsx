import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { PageHeader } from "@/app/app-shell";
import { errorMessage } from "@/features/admin/list-kit";
import { useAuth } from "@/features/auth/auth-context";
import { useOwnTeacherProfile, usePublicTeachers, toCardData, type PublicTeacher } from "@/features/public/public-api";
import { TeacherCard } from "@/features/public/teacher-card";
import { useTeacherDashboard } from "@/features/dashboard/dashboard-api";
import { MapPin, Users } from "lucide-react";
import { Avatar } from "@/shared/ui/avatar";
import { api } from "@/shared/api-client/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { PhotoUpload } from "@/shared/ui/photo-upload";

// Заах чиглэлийн жишээ (товшиж нэмнэнэ). Багш өөрөө чөлөөтэй бичиж болно.
const SUGGESTIONS = [
  "A Level",
  "AS",
  "IGCSE",
  "Checkpoint",
  "IB",
  "SAT",
  "Хоцрогдол арилгах",
  "Түвшин ахиулах",
  "Олимпиадын бэлтгэл",
  "ЭЕШ",
  "Сургуулийн шалгалт",
];

// D-69, ФШ-78: багш нийтийн сайтад харагдах зураг, заах чиглэлээ өөрөө оруулна.
function SpecialtiesCard({ userId, current }: { userId: string; current: string[] }) {
  const queryClient = useQueryClient();
  const [items, setItems] = React.useState<string[]>(current);
  const [draft, setDraft] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  // Нийтийн жагсаалт ачаалагдсаны дараа анхны утгыг нэг удаа авна.
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (!seeded.current && current.length > 0) {
      seeded.current = true;
      setItems(current);
    }
  }, [current]);

  const add = (value: string) => {
    const v = value.trim();
    if (!v || items.includes(v) || items.length >= 8) return;
    setItems([...items, v]);
    setDraft("");
    setSaved(false);
  };
  const save = useMutation({
    mutationFn: () => api.patch(`/teachers/${userId}/specialties`, { specialties: items }),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["public"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Заах чиглэл</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted">Нийтийн сайтын "Багш нар" хэсэгт таны нэрийн доор харагдана. 8 хүртэл чиглэл.</p>
        <ul className="mb-3 flex flex-wrap gap-2" data-testid="own-specialties">
          {items.length === 0 ? <li className="text-sm text-muted">Чиглэл бичигдээгүй байна.</li> : null}
          {items.map((s) => (
            <li key={s} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-background-soft pl-4 pr-1.5 text-sm font-semibold text-mid">
              {s}
              <button
                type="button"
                aria-label={`${s} чиглэлийг хасах`}
                onClick={() => {
                  setItems(items.filter((x) => x !== s));
                  setSaved(false);
                }}
                className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger-bg hover:text-danger"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add(draft);
          }}
        >
          <Field label="Чиглэл нэмэх" htmlFor="spec-draft">
            <Input id="spec-draft" value={draft} maxLength={40} placeholder="Жишээ нь IB" onChange={(e) => setDraft(e.target.value)} className="w-56" />
          </Field>
          <Button type="submit" variant="secondary" disabled={!draft.trim() || items.length >= 8}>
            Нэмэх
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Санал болгох чиглэлүүд">
          {SUGGESTIONS.filter((s) => !items.includes(s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              disabled={items.length >= 8}
              className="min-h-11 rounded-full border border-border-warm px-3.5 text-xs font-semibold text-muted hover:border-primary/40 hover:text-primary disabled:opacity-40"
            >
              + {s}
            </button>
          ))}
        </div>
        <FormError message={errorMessage(save.error)} />
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            Хадгалах
          </Button>
          {saved && !save.isPending ? (
            <span className="text-sm font-semibold text-success" data-testid="specialties-saved">
              Хадгалагдлаа.
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// Профайлын толгой: зураг, нэр, үүрэг, салбар, идэвхтэй сурагчийн тоо. Хэн болохоо нэг харцаар ойлгуулна.
function ProfileSummary({ name, photoUrl, branches, students }: { name: string; photoUrl?: string | null; branches: string[]; students?: number }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-5 p-5 sm:p-6">
        <Avatar url={photoUrl ?? null} name={name} className="size-20 text-3xl ring-4 ring-primary/10" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-2xl font-extrabold text-foreground-strong" data-testid="profile-name">
            {name}
          </h2>
          <p className="mt-1 text-sm font-semibold text-primary">Багш</p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-mid">
            <li className="flex items-center gap-1.5">
              <MapPin className="size-4 text-primary" aria-hidden="true" />
              {branches.length > 0 ? branches.join(", ") : "Салбар бүртгэгдээгүй"}
            </li>
            {students !== undefined ? (
              <li className="flex items-center gap-1.5">
                <Users className="size-4 text-primary" aria-hidden="true" />
                {students} идэвхтэй сурагч
              </li>
            ) : null}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// Нийтийн сайтын "Багш нар" хэсэгт таны карт яг ингэж харагдана (хадгалсны дараа шинэчлэгдэнэ).
function PublicPreview({ name, profile }: { name: string; profile?: PublicTeacher }) {
  const data = profile ? toCardData(profile) : { name, branch: "", specialties: [] as string[] };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Нийтийн сайтад</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted">"Багш нар" хэсэгт таны карт ингэж харагдана. Зураг, заах чиглэлээ хадгалсны дараа шинэчлэгдэнэ.</p>
        <ul data-testid="public-preview">
          <TeacherCard teacher={data} className="w-full" />
        </ul>
      </CardContent>
    </Card>
  );
}

// ФШ-78, D-69: багш өөрийн зураг, заах чиглэлээ өөрөө оруулна. Энэ мэдээлэл нийтийн сайтын "Багш нар" хэсэгт харагдана.
export function TeacherProfilePage() {
  const { user } = useAuth();
  const list = usePublicTeachers();
  const profile = useOwnTeacherProfile(user?.id);
  const students = useTeacherDashboard().data?.stats.students;
  const name = user?.displayName ?? "Багш";

  return (
    <>
      <PageHeader title="Миний профайл" subtitle="Таны мэдээлэл, нийтийн сайтад харагдах зураг, заах чиглэл" />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid min-w-0 gap-5">
          <ProfileSummary name={name} photoUrl={profile?.photoUrl} branches={profile?.branches ?? []} students={students} />
          <Card>
            <CardHeader>
              <CardTitle>Профайлын зураг</CardTitle>
            </CardHeader>
            <CardContent>
              {user ? (
                <PhotoUpload
                  uploadPath={`/teachers/${user.id}/photo`}
                  currentUrl={profile?.photoUrl}
                  name={name}
                  onUploaded={() => list.refetch()}
                />
              ) : null}
              <p className="mt-4 text-sm text-muted">
                Таны зураг сургалтын төвийн нийтийн сайтын "Багш нар" хэсэгт болон энэ самбарт харагдана.
              </p>
            </CardContent>
          </Card>
          {user && list.isSuccess ? <SpecialtiesCard userId={user.id} current={profile?.specialties ?? []} /> : null}
        </div>
        <PublicPreview name={name} profile={profile} />
      </div>
    </>
  );
}
