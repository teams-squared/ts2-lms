import { calculateLevel } from "@/lib/levels";

interface WelcomeBarProps {
  firstName: string;
  xp: number;
  streak: number;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5)  return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Rotate between motivational sublines. Stable within the hour. */
function getSubline(firstName: string): string {
  const options = [
    `Keep it up, ${firstName}!`,
    `Back at it, ${firstName}.`,
    `Let's go, ${firstName}.`,
    `Ready to learn, ${firstName}?`,
    `Welcome back, ${firstName}.`,
    `Make today count, ${firstName}.`,
  ];
  // Seed by hour-of-year so the message changes every hour but is stable within.
  const now = new Date();
  const hourOfYear =
    Math.floor(
      (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()) -
        Date.UTC(now.getFullYear(), 0, 0)) / 3_600_000,
    );
  return options[hourOfYear % options.length];
}

/** Circular SVG ring showing level progress. */
function LevelRing({ level, percent }: { level: number; percent: number }) {
  const size = 56;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-white/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/70 leading-none">
          Lv
        </span>
        <span className="text-base font-bold text-white leading-tight">{level}</span>
      </div>
    </div>
  );
}

export function WelcomeBar({ firstName, xp, streak }: WelcomeBarProps) {
  const { level, currentXp, nextLevelXp } = calculateLevel(xp);
  const percent = Math.round((currentXp / nextLevelXp) * 100);
  const greeting = getTimeBasedGreeting();
  const subline = getSubline(firstName);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-2">
      <div className="relative rounded-2xl p-5 sm:p-6 shadow-sm overflow-hidden bg-primary">
        <div className="relative flex items-center gap-4 sm:gap-5">
          <LevelRing level={level} percent={percent} />

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              {greeting}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
              {subline}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1.5 text-white/90">
                <span className="font-semibold tabular-nums">{currentXp}</span>
                <span className="text-white/60">/</span>
                <span className="tabular-nums text-white/70">{nextLevelXp} XP</span>
              </span>
              {streak > 0 && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="inline-flex items-center gap-1.5 text-white/90">
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full bg-amber-400"
                    />
                    <span className="tabular-nums font-medium">
                      {streak}-day streak
                    </span>
                  </span>
                </>
              )}
            </div>
            {/* XP progress bar beneath stats */}
            <div className="mt-2.5 h-1.5 bg-white/15 rounded-full overflow-hidden max-w-xs">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
