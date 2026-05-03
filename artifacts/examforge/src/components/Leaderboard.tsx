import { useGetLeaderboard } from "@workspace/api-client-react";
import { Trophy, Clock, User, Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground text-sm font-semibold">
      {rank}
    </span>
  );
}

interface Props {
  examId: string;
}

export function Leaderboard({ examId }: Props) {
  const { data, isLoading } = useGetLeaderboard(examId, { limit: 20 });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" /> Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const entries = data?.entries ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-accent" /> Leaderboard
          <Badge variant="secondary" className="ml-auto">{entries.length} finishers</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Medal className="mx-auto h-10 w-10 opacity-30 mb-3" />
            <p className="text-sm">No finished attempts yet. Be the first to complete this exam!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const scorePct = Math.round(entry.scorePct);
              const name = entry.userName || "Anonymous";
              return (
                <div
                  key={entry.attemptId}
                  className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors ${
                    entry.rank === 1
                      ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800"
                      : entry.rank === 2
                      ? "bg-slate-50 border-slate-200 dark:bg-slate-950/20 dark:border-slate-700"
                      : entry.rank === 3
                      ? "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800"
                      : "bg-muted/30 border-border/50"
                  }`}
                >
                  <div className="flex-shrink-0 w-10 flex justify-center">
                    <RankBadge rank={entry.rank} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-mono">{formatTime(entry.elapsedSeconds)}</span>
                    </div>
                    <Badge
                      variant={scorePct >= 70 ? "default" : scorePct >= 50 ? "secondary" : "destructive"}
                      className="text-xs min-w-[46px] justify-center"
                    >
                      {scorePct}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
