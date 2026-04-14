import { cn } from "@/lib/utils";

interface DetailLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DetailLayout({ sidebar, children, className }: DetailLayoutProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-6", className)}>
      <div className="md:col-span-1">{sidebar}</div>
      <div className="md:col-span-3">{children}</div>
    </div>
  );
}
