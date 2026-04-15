import { redirect } from "next/navigation";
import { auth } from "@/app/_lib/auth";
import { PageContainer } from "@/app/_components/page-container";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  // Admin always has full access. Non-admin users must be bound to a Staff record.
  const isAdmin = session.user.role === "admin";
  const isBound = session.user.staffId !== null && session.user.staffId !== undefined;

  if (!isAdmin && !isBound) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="text-xl font-semibold">帳號尚未啟用</h1>
          <p className="mt-2 text-muted-foreground">
            請聯繫管理員將您的帳號綁定至員工資料後即可使用系統。
          </p>
        </div>
      </PageContainer>
    );
  }

  return <>{children}</>;
}
