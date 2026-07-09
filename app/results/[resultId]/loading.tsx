import { PageContainer } from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ResultLoading() {
  return (
    <PageContainer className="flex flex-col items-center gap-8 py-16 sm:py-20">
      <Skeleton className="h-6 w-44" />
      <Skeleton className="size-16 rounded-2xl" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="mt-8 h-96 w-full" />
    </PageContainer>
  );
}
