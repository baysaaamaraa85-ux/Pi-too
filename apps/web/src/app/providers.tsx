import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { ApiError } from "@/shared/api-client/client";
import { AuthProvider } from "@/features/auth/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // 4xx алдааг (эрх, олдсонгүй) дахин оролдохгүй.
            retry: (count, error) =>
              !(error instanceof ApiError && error.problem.status < 500) && count < 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
