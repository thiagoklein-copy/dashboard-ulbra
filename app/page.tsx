import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Carregando dashboard…
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
