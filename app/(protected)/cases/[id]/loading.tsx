import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/app/_components/page-container";
import { InfoGrid } from "@/app/_components/info-grid";

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
        <InfoGrid>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </InfoGrid>
      </div>

      {/* Relations card */}
      <div className="rounded-lg border p-4 mb-6 space-y-3">
        <Skeleton className="h-5 w-20 mb-2" />
        <InfoGrid columns="3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </InfoGrid>
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
