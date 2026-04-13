import Link from "next/link";

interface InfoRowProps {
  label: string;
  value: string | null | undefined;
  /** If provided, value renders as a link */
  href?: string;
  /** If true, value uses destructive styling */
  highlight?: boolean;
}

export function InfoRow({ label, value, href, highlight }: InfoRowProps) {
  const display = value ?? "—";

  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground font-medium">{label}</span>
      {href && value ? (
        <Link href={href} className="text-primary hover:underline">
          {display}
        </Link>
      ) : (
        <span className={highlight ? "text-destructive font-bold" : "text-foreground"}>
          {display}
        </span>
      )}
    </div>
  );
}
