import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ROUTES } from "@/routes";

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  }),
  defaultOptions: { queries: { staleTime: 30_000 } },
});
export const router = createBrowserRouter(ROUTES);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
