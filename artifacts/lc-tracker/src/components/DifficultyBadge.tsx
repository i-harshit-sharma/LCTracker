interface DifficultyBadgeProps {
  difficulty: string;
}

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  const colors: Record<string, string> = {
    Easy: "bg-green-500/15 text-green-400 border-green-500/30",
    Medium: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    Hard: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  const cls = colors[difficulty] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
      data-testid={`badge-difficulty-${difficulty.toLowerCase()}`}
    >
      {difficulty}
    </span>
  );
}
