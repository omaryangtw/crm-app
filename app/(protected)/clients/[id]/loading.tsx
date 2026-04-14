import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/app/_components/page-container";
import { DetailLayout } from "@/app/_components/detail-layout";
import { InfoGrid } from "@/app/_components/info-grid";

export default function ClientDetailLoading() {
  return (
    <PageContainer>
      {/* Breadcrumb skeleton */}
      <Skeleton className="h-4 w-40 mb-4" />

      {/* Title skeleton */}
      <Skeleton className="h-8 w-64 mb-6" />

      <DetailLayout className="mb-8" sidebar={
        <div className="space-y-4">
          {/* Photo placeholder */}
          <Skeleton className="h-[200px] w-full rounded-lg" />

          {/* Basic info card */}
          <div className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-5 w-20 mb-2" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      }>
        {/* Right column */}
        <div className="space-y-4">
          {/* Contact card */}
          <div className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-5 w-24 mb-2" />
            <InfoGrid>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </InfoGrid>
          </div>

          {/* Address card */}
          <div className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-5 w-16 mb-2" />
            <InfoGrid>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </InfoGrid>
          </div>
        </div>
      </DetailLayout>

      {/* Table skeleton (cases / contacts) */}
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-5 w-32 mb-2" />
        {/* Table header */}
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
