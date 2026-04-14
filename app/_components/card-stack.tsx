import { cn } from "@/lib/utils";

interface CardStackProps {
  children?: React.ReactNode;
  className?: string;
}

export function CardStack({ children, className }: CardStackProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {children}
    </div>
  );
}
