import {
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  Flame,
  GraduationCap,
  Medal,
  Rocket,
  Sparkles,
  Star,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/**
 * Resolves an Achievement.icon string (stored in the DB) to a lucide icon
 * component. Historical data stores these as emoji glyphs ("🏆", "📚", "🔥",
 * etc.); newer/future rows may store lucide icon keys directly ("trophy",
 * "flame"). Both forms are accepted here so we can migrate the DB lazily.
 *
 * Any unknown value falls back to Trophy so the UI never renders a raw
 * emoji or a blank square.
 */
export function resolveAchievementIcon(icon: string): LucideIcon {
  const normalised = icon.trim().toLowerCase();
  switch (normalised) {
    // Emoji → lucide
    case "🏆":
    case "trophy":
      return Trophy;
    case "📚":
    case "book":
    case "books":
      return BookOpen;
    case "🔥":
    case "flame":
    case "fire":
      return Flame;
    case "🎯":
    case "target":
      return Target;
    case "⭐":
    case "🌟":
    case "star":
      return Star;
    case "🏅":
    case "medal":
      return Medal;
    case "🥇":
    case "award":
      return Award;
    case "🎓":
    case "graduation":
    case "graduation-cap":
      return GraduationCap;
    case "🚀":
    case "rocket":
      return Rocket;
    case "🧠":
    case "brain":
      return Brain;
    case "✨":
    case "sparkles":
      return Sparkles;
    case "✅":
    case "check":
    case "check-circle":
      return CheckCircle2;
    default:
      return Trophy;
  }
}
