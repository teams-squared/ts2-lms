import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Generic breadcrumb nav. Last item (no href) is rendered as current page.
 * Usage: <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Courses", href: "/courses" }, { label: course.title }]} />
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1 text-sm mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRightIcon className="w-3.5 h-3.5 text-foreground-subtle flex-shrink-0" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-foreground-muted hover:text-foreground transition-colors truncate max-w-[160px]"
            >
              {item.label}
            </Link>
          ) : (
            <span
              className="text-foreground-muted font-medium truncate max-w-[200px]"
              aria-current="page"
            >
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
