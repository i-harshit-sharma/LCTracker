import { useMemo } from "react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  useGetLeaderboard, 
  getGetLeaderboardQueryOptions,
  useGetPreferences
} from "@workspace/api-client-react";
import { useQueries } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, AlertTriangle, History, Info } from "lucide-react";
import { subWeeks, startOfWeek, format } from "date-fns";

export function PredictionsGraph() {
  const { data: prefs } = useGetPreferences();
  const myUsername = prefs?.leetcodeUsername;

  // Generate keys for the last 3 weeks to calculate a moving average velocity
  const historicalWeeks = useMemo(() => {
    const dates = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const date = subWeeks(now, i);
      const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
      dates.push(`week-${format(start, "yyyy-MM-dd")}`);
    }
    return dates;
  }, []);

  // Fetch leaderboard for current and previous weeks for FOLLOWED users
  const historicalQueries = useQueries({
    queries: historicalWeeks.map(period => 
      getGetLeaderboardQueryOptions({ scope: "following", period })
    )
  });

  const { data: currentLeaderboard, isLoading: isCurrentLoading, error: currentError } = useGetLeaderboard({ 
    scope: "following", 
    period: "all" 
  });

  const isLoading = isCurrentLoading || historicalQueries.some(q => q.isLoading);
  const isError = currentError || historicalQueries.some(q => q.isError);

  const processedData = useMemo(() => {
    if (!currentLeaderboard || !Array.isArray(currentLeaderboard)) return { chartData: [], events: [], stats: [] };
    if (historicalQueries.some(q => !q.data)) return { chartData: [], events: [], stats: [] };

    // Calculate average velocity for each user across historical weeks
    const userVelocityMap = new Map<string, number>();
    
    historicalQueries.forEach(query => {
      const weekData = query.data as any[];
      if (Array.isArray(weekData)) {
        weekData.forEach(entry => {
          const current = userVelocityMap.get(entry.leetcodeUsername) || 0;
          userVelocityMap.set(entry.leetcodeUsername, current + (entry.solvedInPeriod || 0));
        });
      }
    });

    // Divide by number of weeks to get average velocity
    userVelocityMap.forEach((total, username) => {
      userVelocityMap.set(username, total / historicalWeeks.length);
    });

    // Select users to plot: All followed users
    const plottedUsers = [...currentLeaderboard]
      .filter(u => u.totalSolved !== null && u.totalSolved !== undefined);

    if (plottedUsers.length === 0) return { chartData: [], events: [], stats: [] };

    // Calculate stats like growth rate %
    const stats = plottedUsers.map(user => {
      const total = user.totalSolved || 1; // avoid div by zero
      const velocity = userVelocityMap.get(user.leetcodeUsername) || 0;
      const growthRate = (velocity / total) * 100;
      return {
        username: user.leetcodeUsername,
        growthRate,
        velocity
      };
    }).sort((a, b) => b.growthRate - a.growthRate);

    // Generate chart data
    const weeks = 8;
    const chartData = [];
    for (let w = 0; w <= weeks; w++) {
      const dataPoint: any = { week: w === 0 ? "Now" : `Week ${w}` };
      plottedUsers.forEach(user => {
        const currentTotal = user.totalSolved || 0;
        const velocity = userVelocityMap.get(user.leetcodeUsername) || 0;
        dataPoint[user.leetcodeUsername] = Math.round(currentTotal + velocity * w);
      });
      chartData.push(dataPoint);
    }

    // Calculate overtaking events for all plotted users
    const events: { user1: string, user2: string, week: number, total: number }[] = [];
    for (let i = 0; i < plottedUsers.length; i++) {
      for (let j = i + 1; j < plottedUsers.length; j++) {
        const u1 = plottedUsers[i];
        const u2 = plottedUsers[j];
        
        const T1 = u1.totalSolved || 0;
        const V1 = userVelocityMap.get(u1.leetcodeUsername) || 0;
        const T2 = u2.totalSolved || 0;
        const V2 = userVelocityMap.get(u2.leetcodeUsername) || 0;

        if (V1 === V2 || Math.abs(V1 - V2) < 0.1) continue;

        const W = (T2 - T1) / (V1 - V2);
        
        if (W > 0 && W <= 8) {
          events.push({
            user1: u1.leetcodeUsername,
            user2: u2.leetcodeUsername,
            week: W,
            total: T1 + V1 * W
          });
        }
      }
    }

    // Calculate overtake challenge for current user
    const leader = [...currentLeaderboard].sort((a, b) => (b.totalSolved || 0) - (a.totalSolved || 0))[0];
    const meStat = stats.find(u => u.username === myUsername);
    let challenge = null;

    if (leader && meStat && leader.leetcodeUsername !== myUsername) {
      const leaderTotal = leader.totalSolved || 0;
      const leaderVelocity = userVelocityMap.get(leader.leetcodeUsername) || 0;
      const myTotal = currentLeaderboard.find(u => u.leetcodeUsername === myUsername)?.totalSolved || 0;
      
      const predictedLeaderTotal = leaderTotal + (leaderVelocity * 8);
      const neededTotal = predictedLeaderTotal + 1;
      const neededVelocity = (neededTotal - myTotal) / 8;
      const neededGrowthRate = (neededVelocity / (myTotal || 1)) * 100;

      challenge = {
        leaderUsername: leader.leetcodeUsername,
        neededVelocity,
        neededGrowthRate,
        currentVelocity: meStat.velocity
      };
    }

    return { chartData, events, stats, challenge };
  }, [currentLeaderboard, historicalQueries, historicalWeeks, myUsername]);

  const { chartData: predictionData, events: overtakingEvents, stats: userStats, challenge } = processedData;

  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="mt-8 border-destructive/20 bg-destructive/5">
        <CardContent className="py-10 flex flex-col items-center justify-center text-center gap-3">
          <AlertTriangle className="h-10 w-10 text-destructive opacity-50" />
          <div>
            <p className="font-semibold text-destructive">Failed to load predictions</p>
            <p className="text-xs text-muted-foreground">The leaderboard data could not be retrieved.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!predictionData.length) {
    return (
      <Card className="mt-8 border-dashed">
        <CardContent className="py-10 flex flex-col items-center justify-center text-center gap-3">
          <Info className="h-10 w-10 text-muted-foreground opacity-50" />
          <div>
            <p className="font-semibold">No data for predictions</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              We need at least some all-time solve data to project future growth.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const colors = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#f43f5e"];

  return (
    <Card className="mt-8 overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Growth & Overtaking Predictions
        </CardTitle>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <History className="h-3 w-3" />
          Linear projections based on 3-week moving average velocity
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        {challenge && (
          <div className="mb-8 p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-foreground">Target: Overtake @{challenge.leaderUsername}</h4>
                <p className="text-xs text-muted-foreground">Required effort to become #1 in 8 weeks</p>
              </div>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Required Growth</p>
                <p className="text-xl font-black text-primary">+{challenge.neededGrowthRate.toFixed(2)}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Target Velocity</p>
                <p className="text-xl font-black text-foreground">{challenge.neededVelocity.toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-1">/wk</span></p>
              </div>
              <div className="hidden md:block h-10 w-px bg-border" />
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Current Gap</p>
                <p className="text-xl font-black text-orange-500">
                  {Math.max(0, challenge.neededVelocity - challenge.currentVelocity).toFixed(1)}
                  <span className="text-xs font-normal text-muted-foreground ml-1">to add</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="h-100 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={predictionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis 
                dataKey="week" 
                stroke="#94a3b8" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#94a3b8" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val.toLocaleString()}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px" }}
                itemStyle={{ fontSize: "12px" }}
                labelStyle={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}
              />
              <Legend verticalAlign="top" height={36}/>
              {Object.keys(predictionData[0])
                .filter(key => key !== "week")
                .map((username, index) => (
                  <Line
                    key={username}
                    type="monotone"
                    dataKey={username}
                    stroke={colors[index % colors.length]}
                    strokeWidth={username === myUsername ? 4 : 2}
                    dot={username === myUsername ? { r: 6 } : { r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {userStats.length > 0 && (
          <div className="mt-8 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2 px-1">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Velocity & Growth Rate
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {userStats.map((stat, i) => (
                <div 
                  key={stat.username} 
                  className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors ${
                    stat.username === myUsername 
                      ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20" 
                      : "bg-muted/30 border-border/50 hover:bg-muted/50"
                  }`}
                >
                  <span className={`text-xs font-bold truncate ${stat.username === myUsername ? "text-primary" : "text-foreground"}`}>
                    @{stat.username}
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Growth</span>
                    <span className="text-xs font-mono font-bold text-emerald-500">
                      +{stat.growthRate.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Speed</span>
                    <span className="text-[10px] font-medium">
                      {stat.velocity.toFixed(1)}/wk
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {overtakingEvents.length > 0 && (
          <div className="mt-8 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2 px-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Overtaking Alerts
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {overtakingEvents.map((event, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      <span className="text-primary">@{event.user1}</span> will overtake <span className="text-blue-400">@{event.user2}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Around Week {event.week.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      Est. {Math.round(event.total)} solves
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
