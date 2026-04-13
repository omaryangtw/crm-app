import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: number;
  icon?: React.ReactNode;
  href?: string;
  description?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  href,
  description,
}: StatCardProps) {
  const content = (
    <Card
      className={
        href ? "hover:bg-muted/50 transition-colors cursor-pointer" : undefined
      }
    >
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          {icon && (
            <span className="h-5 w-5 text-muted-foreground">{icon}</span>
          )}
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
