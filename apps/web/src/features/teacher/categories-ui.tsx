import type { TeacherCategoriesDto } from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Trash2, X } from "lucide-react";
import * as React from "react";
import { errorMessage } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

// D-69: багш зөвхөн өөртөө зориулж сурагчдаа өөрийн нэрлэсэн категориор ангилна (самбарыг цэгцтэй харуулах).

export function useTeacherCategories() {
  return useQuery({
    queryKey: ["teacher-categories"],
    queryFn: () => api.get<TeacherCategoriesDto>("/teacher/categories"),
  });
}

export function useRefreshCategories() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["teacher-categories"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

function CategoryChip({ id, name, students }: { id: string; name: string; students: number }) {
  const refresh = useRefreshCategories();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(name);
  const rename = useMutation({
    mutationFn: () => api.patch(`/teacher/categories/${id}`, { name: value }),
    onSuccess: async () => {
      setEditing(false);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/teacher/categories/${id}`),
    onSuccess: refresh,
  });

  if (editing) {
    return (
      <li className="grid gap-1.5" data-testid="category-chip">
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            rename.mutate();
          }}
        >
          <Input aria-label="Категорийн шинэ нэр" value={value} maxLength={40} onChange={(e) => setValue(e.target.value)} className="h-11 w-44" />
          <Button type="submit" size="sm" disabled={!value.trim() || rename.isPending} aria-label="Хадгалах">
            <Check className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="secondary" aria-label="Болих" onClick={() => setEditing(false)}>
            <X className="size-4" />
          </Button>
        </form>
        <FormError message={errorMessage(rename.error)} />
      </li>
    );
  }
  return (
    <li className="grid gap-1.5" data-testid="category-chip">
      <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border-warm bg-background-soft pl-4 pr-1.5 text-sm font-semibold text-foreground-strong">
        <span>
          {name} <span className="font-normal text-muted">({students})</span>
        </span>
        <button
          type="button"
          aria-label={`${name} категорийн нэр засах`}
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
          className="grid size-9 place-items-center rounded-full text-muted hover:bg-primary/8 hover:text-primary"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          aria-label={`${name} категори устгах`}
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
          className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger-bg hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      </span>
      <FormError message={errorMessage(remove.error)} />
    </li>
  );
}

// "Сурагч" хэсэгт категори нэмэх: нэрийг нь өөрөө өгч үүсгэнэ, нэрийг засч, устгана.
// bare = true бол цонхон дотор (карт, гарчиггүй) харуулна (D-103).
export function CategoryManager({ bare = false }: { bare?: boolean }) {
  const categories = useTeacherCategories();
  const refresh = useRefreshCategories();
  const [name, setName] = React.useState("");
  const create = useMutation({
    mutationFn: () => api.post("/teacher/categories", { name }),
    onSuccess: async () => {
      setName("");
      await refresh();
    },
  });
  const Wrapper = bare ? "div" : Card;
  return (
    <Wrapper className={bare ? undefined : "mb-4 p-4"} data-testid="category-manager">
      {bare ? null : <p className="text-sm font-bold text-foreground-strong">Миний категори</p>}
      <p className={bare ? "text-xs text-muted" : "mt-0.5 text-xs text-muted"}>
        Зөвхөн танд харагдана, самбараа цэгцтэй харахад зориулсан. Жишээ нь AS, IGCSE, IB, SAT, ЭЕШ, Хоцрогдол арилгах.
        Нэг сурагчийг 2 хүртэл категорид нэмж болно.
      </p>
      <form
        className="mt-3 flex flex-wrap items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Input
          aria-label="Шинэ категорийн нэр"
          placeholder="Категорийн нэр"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-56"
        />
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          Категори нэмэх
        </Button>
      </form>
      <FormError message={errorMessage(create.error)} />
      {categories.data && categories.data.categories.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {categories.data.categories.map((c) => (
            <CategoryChip key={c.id} id={c.id} name={c.name} students={c.students} />
          ))}
        </ul>
      ) : null}
    </Wrapper>
  );
}
