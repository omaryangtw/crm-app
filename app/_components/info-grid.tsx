import { cn } from "@/lib/utils";

interface InfoGridProps {
  children: React.ReactNode;
  columns?: "2" | "3";
  className?: string;
}

const COLUMN_CLASSES = {
  "2": "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2",
  "3": "grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2",
} as const;

export function InfoGrid({ children, columns = "2", className }: InfoGridProps) {
  return (
    <div className={cn(COLUMN_CLASSES[columns], className)}>
      {children}
    </div>
  );
}
