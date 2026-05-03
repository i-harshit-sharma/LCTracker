import { useMemo } from "react";
import { 
  format, 
  subDays, 
  eachDayOfInterval, 
  isSameDay, 
  startOfWeek, 
  endOfWeek, 
  eachMonthOfInterval,
  isSameMonth,
  startOfMonth
} from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

interface HeatmapProps {
  data: { date: string; count: number }[];
  isLoading?: boolean;
}

export function Heatmap({ data, isLoading }: HeatmapProps) {
  const days = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 364);
    return eachDayOfInterval({ start, end });
  }, []);

  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((d) => {
      // Normalize date string to YYYY-MM-DD to avoid timezone issues
      const dateKey = format(new Date(d.date), "yyyy-MM-dd");
      map.set(dateKey, d.count);
    });
    return map;
  }, [data]);

  const getColor = (count: number) => {
    if (count === 0) return "fill-muted/20";
    if (count <= 1) return "fill-primary/30";
    if (count <= 3) return "fill-primary/60";
    if (count <= 5) return "fill-primary/80";
    return "fill-primary";
  };

  const weeks = useMemo(() => {
    const weeksArr: Date[][] = [];
    let currentWeek: Date[] = [];
    
    // We want to align weeks correctly.
    // Start from the start of the week of the first day
    const firstDay = days[0];
    const startOfFirstWeek = startOfWeek(firstDay, { weekStartsOn: 0 }); // Sunday
    
    const allDays = eachDayOfInterval({
        start: startOfFirstWeek,
        end: days[days.length - 1]
    });

    allDays.forEach((day, i) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) weeksArr.push(currentWeek);
    
    return weeksArr;
  }, [days]);

  const monthLabels = useMemo(() => {
    const labels: { label: string; offset: number }[] = [];
    let lastMonth = -1;
    
    weeks.forEach((week, i) => {
      const firstDayOfWeek = week[0];
      const month = firstDayOfWeek.getMonth();
      if (month !== lastMonth) {
        labels.push({
          label: format(firstDayOfWeek, "MMM"),
          offset: i
        });
        lastMonth = month;
      }
    });
    
    return labels;
  }, [weeks]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const cellSize = 10;
  const gap = 3;
  const labelHeight = 20;
  const labelWidth = 30;

  return (
    <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
      <div className="min-w-175">
        <svg 
          width={weeks.length * (cellSize + gap) + labelWidth} 
          height={7 * (cellSize + gap) + labelHeight}
          className="text-[10px] fill-muted-foreground"
        >
          {/* Month Labels */}
          {monthLabels.map((m, i) => (
            <text 
              key={i} 
              x={labelWidth + m.offset * (cellSize + gap)} 
              y={10}
            >
              {m.label}
            </text>
          ))}

          {/* Day Labels */}
          <text x={0} y={labelHeight + 1 * (cellSize + gap) + 8}>Mon</text>
          <text x={0} y={labelHeight + 3 * (cellSize + gap) + 8}>Wed</text>
          <text x={0} y={labelHeight + 5 * (cellSize + gap) + 8}>Fri</text>

          {/* Grid */}
          <TooltipProvider delayDuration={0}>
            {weeks.map((week, weekIndex) => (
              <g key={weekIndex} transform={`translate(${labelWidth + weekIndex * (cellSize + gap)}, ${labelHeight})`}>
                {week.map((day, dayIndex) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const count = dataMap.get(dateKey) || 0;
                  const isVisible = days.some(d => isSameDay(d, day));
                  
                  if (!isVisible) return null;

                  return (
                    <Tooltip key={dayIndex}>
                      <TooltipTrigger asChild>
                        <rect
                          width={cellSize}
                          height={cellSize}
                          y={dayIndex * (cellSize + gap)}
                          rx={2}
                          className={`${getColor(count)} transition-colors cursor-pointer hover:stroke-foreground/20 hover:stroke-1`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px] py-1 px-2">
                        <span className="font-bold">{count} solve{count !== 1 ? 's' : ''}</span>
                        <span className="ml-1 text-muted-foreground">on {format(day, "MMM d, yyyy")}</span>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </g>
            ))}
          </TooltipProvider>
        </svg>
        
        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className={`w-2.5 h-2.5 rounded-[2px] ${getColor(0)}`} />
            <div className={`w-2.5 h-2.5 rounded-[2px] ${getColor(1)}`} />
            <div className={`w-2.5 h-2.5 rounded-[2px] ${getColor(3)}`} />
            <div className={`w-2.5 h-2.5 rounded-[2px] ${getColor(5)}`} />
            <div className={`w-2.5 h-2.5 rounded-[2px] ${getColor(10)}`} />
            <span>More</span>
        </div>
      </div>
    </div>
  );
}
