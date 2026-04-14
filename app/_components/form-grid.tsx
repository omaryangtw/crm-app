import { cn } from "@/lib/utils";

interface FormGridProps {
  children: React.ReactNode;
  columns?: "2" | "3";
  className?: string;
}

const COLUMN_CLASSES = {
  "2": "grid grid-cols-1 gap-4 sm:grid-cols-2",
  "3": "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
} as const;

export function FormGrid({ children, columns = "3", className }: FormGridProps) {
  return (
    <div className={cn(COLUMN_CLASSES[columns], className)}>
      {children}
    </div>
  );
}
