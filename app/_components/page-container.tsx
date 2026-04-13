import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  /** 窄版佈局（詳情頁、表單頁）vs 寬版（列表頁、首頁） */
  size?: "default" | "narrow";
}

export function PageContainer({ children, size = "default" }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto px-4 py-6 sm:px-6 lg:px-8",
        size === "default" ? "max-w-7xl" : "max-w-4xl"
      )}
    >
      {children}
    </div>
  );
}
