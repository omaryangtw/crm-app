import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  /** Right-side action buttons */
  actions?: React.ReactNode;
  /** Back link URL (for detail pages) */
  backHref?: string;
  /** Back link label */
  backLabel?: string;
}

export function PageHeader({ title, actions, backHref, backLabel }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel ?? "返回"}
        </Link>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {actions && <div className="flex gap-3">{actions}</div>}
      </div>
    </div>
  );
}
