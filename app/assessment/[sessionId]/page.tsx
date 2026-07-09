import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { AssessmentController } from "@/components/assessment/AssessmentController";
import type { Selection } from "@/components/assessment/MostLeastSelector";
import { db } from "@/lib/mock-db/client";
import type { Answer, AssessmentSession } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assessment in progress",
};

export default async function AssessmentSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const session = (await db.assessmentSession.findUnique({
    where: { id: sessionId },
  })) as AssessmentSession | null;
  if (!session) notFound();
  if (session.status === "COMPLETED" && session.resultId) {
    redirect(`/results/${session.resultId}`);
  }

  const answers = (await db.answer.findMany({
    where: { sessionId },
  })) as Answer[];

  const initialSelections: Record<string, Selection> = {};
  for (const answer of answers) {
    initialSelections[answer.questionId] = {
      most: answer.mostOptionId,
      least: answer.leastOptionId,
    };
  }

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <PageContainer className="max-w-3xl py-14 sm:py-16">
          <AssessmentController
            session={session}
            initialSelections={initialSelections}
          />
        </PageContainer>
      </main>
    </>
  );
}
