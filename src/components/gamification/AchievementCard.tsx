"use client";

interface AchievementCardProps {
  icon: string;
  title: string;
  description: string;
  unlockedAt?: string | null;
}

export function AchievementCard({ icon, title, description, unlockedAt }: AchievementCardProps) {
  const isLocked = !unlockedAt;

  return (
    <div
      className={`relative p-4 rounded-lg border transition-shadow ${
        isLocked
          ? "border-border bg-surface-muted opacity-50"
          : "border-primary/30 bg-card shadow-sm hover:shadow-elevated hover-lift"
      }`}
    >
      <div className="text-3xl mb-2" role="img" aria-label={title}>
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-0.5">
        {title}
      </h3>
      <p className="text-xs text-foreground-muted">{description}</p>
      {unlockedAt && (
        <p className="text-xs text-foreground-subtle mt-2">
          Unlocked {new Date(unlockedAt).toLocaleDateString()}
        </p>
      )}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg text-foreground-subtle">🔒</span>
        </div>
      )}
    </div>
  );
}
