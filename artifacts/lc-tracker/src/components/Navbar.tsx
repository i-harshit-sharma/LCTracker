import { Link, useLocation } from "wouter";
import { Bell, Users, LayoutDashboard, LogOut, User, Map as MapIcon } from "lucide-react";
import { SiLeetcode } from "react-icons/si";
import { useUser, useClerk } from "@clerk/react";
import { useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Navbar() {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  const { data: unreadNotifications } = useListNotifications(
    { unreadOnly: true },
    {
      query: {
        queryKey: getListNotificationsQueryKey({ unreadOnly: true }),
        refetchInterval: 30_000,
      },
    },
  );

  const unreadCount = unreadNotifications?.length ?? 0;

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/skyline", icon: MapIcon, label: "Skyline" },
    { href: "/follows", icon: Users, label: "Following" },
    { href: "/notifications", icon: Bell, label: "Notifications", badge: unreadCount },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <SiLeetcode className="h-6 w-6 text-primary" />
          <span className="font-bold text-base tracking-tight">
            LC<span className="text-primary">Tracker</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map(({ href, icon: Icon, label, badge }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                id={label === "Following" ? "tour-nav-follows" : undefined}
                data-testid={`nav-link-${label.toLowerCase()}`}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {badge != null && badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
              data-testid="button-user-menu"
            >
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName ?? ""}
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <User className="h-4 w-4" />
              )}
              <span className="hidden md:block text-sm max-w-[120px] truncate">
                {user?.fullName ?? user?.emailAddresses?.[0]?.emailAddress ?? "Account"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              data-testid="button-sign-out"
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile nav */}
      <div className="sm:hidden border-t border-border flex">
        {navItems.map(({ href, icon: Icon, label, badge }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge != null && badge > 0 && (
                <span className="absolute top-1 right-[calc(50%-14px)] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
