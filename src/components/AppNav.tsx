import { Link } from "@tanstack/react-router";
import { BookOpen, Heart, GraduationCap, Users, User as UserIcon } from "lucide-react";

const items = [
  { to: "/", label: "Verse", icon: BookOpen },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/lessons", label: "Lessons", icon: GraduationCap },
  { to: "/community", label: "Community", icon: Users },
  { to: "/auth", label: "Account", icon: UserIcon },
] as const;

export function AppNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border/70 bg-card/90 px-2 py-1.5 shadow-lg backdrop-blur-md"
    >
      <ul className="flex items-center gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              className="flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}