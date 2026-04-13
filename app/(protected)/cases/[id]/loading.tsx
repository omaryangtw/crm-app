import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/app/_components/page-container";

export default function CaseDetailLoading() {
  return (
    <PageContainer size="narrow">
      {/* Breadcrumb skeleton */}
      <Skeleton className="h-4 w-36 mb-4" />

      {/* Title skeleton */}
      <Skeleton className="h-8 w-56 mb-6" />

      {/* Associated client card */}
      <div className="rounded-lg border p-4 mb-6 space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Case details card */}
      <div className="rounded-lg border p-4 mb-6 space-y-3">
        <Skeleton className="h-5 w-24 mb-2" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* Relations card */}
      <div className="rounded-lg border p-4 mb-6 space-y-3">
        <Skeleton className="h-5 w-20 mb-2" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Notes card */}
      <div className="rounded-lg border p-4 mb-6 space-y-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </PageContainer>
  );
}
