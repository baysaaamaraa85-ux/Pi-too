import type { TeacherPlacementRequestsDto } from "@pitoo/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api-client/client";

// D-102: багшийн харж болох түвшин тогтоох хүсэлтүүд (өөрийн ахалдаг салбарын, эсвэл өөрт нь шилжүүлсэн).
// Цэс (хонх, хайлт) ба хуудас хоёулаа нэг query-г ашиглана. Админ дээр invalidate хийхэд ["placement-requests"] угтвараар цэвэрлэгдэнэ.
export const MY_PLACEMENT_KEY = ["placement-requests", "mine"] as const;

export function useMyPlacementRequests(enabled = true) {
  return useQuery({
    queryKey: MY_PLACEMENT_KEY,
    enabled,
    queryFn: () => api.get<TeacherPlacementRequestsDto>("/teacher/placement-requests"),
    refetchInterval: 60_000,
  });
}
