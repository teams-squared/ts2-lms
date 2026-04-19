import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-4 text-center animate-fade-in">
      <p className="text-6xl font-bold text-primary mb-4">404</p>
      <h1 className="text-2xl font-semibold text-foreground mb-2">
        Page not found
      </h1>
      <p className="text-sm text-foreground-muted mb-8 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Go home
      </Link>
    </div>
  );
}
