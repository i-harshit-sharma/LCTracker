import { Link } from "wouter";
import { SiLeetcode, SiGithub } from "react-icons/si";
import { Bell, Users, BarChart3, Zap, Trophy, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const features = [
  {
    icon: Activity,
    title: "Live Activity Feed",
    description: "Watch the problems your network solves in real time. Every accepted submission appears instantly.",
  },
  {
    icon: Bell,
    title: "Instant Notifications",
    description: "Get notified the moment someone you follow cracks a Hard problem. Never miss a grinding session.",
  },
  {
    icon: Trophy,
    title: "Weekly Leaderboard",
    description: "See who's grinding hardest in your network ranked by weekly solve count. Stay competitive.",
  },
  {
    icon: BarChart3,
    title: "Progress Analytics",
    description: "Track difficulty breakdowns — Easy, Medium, Hard — across everyone you follow at a glance.",
  },
  {
    icon: Users,
    title: "Follow Anyone",
    description: "Follow any public LeetCode username. Friends, rivals, top performers — build your feed.",
  },
  {
    icon: Zap,
    title: "Daily Digest Email",
    description: "A summary of everything your network solved lands in your inbox at 11:59 PM every night.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiLeetcode className="h-6 w-6 text-primary" />
            <span className="font-bold text-base tracking-tight">
              LC<span className="text-primary">Tracker</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" data-testid="link-sign-in">
                Sign in
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="glow-orange" data-testid="link-sign-up">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
          <Zap className="h-3.5 w-3.5" />
          Real-time LeetCode social feed
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
          Turn Leetcode grinding into a
          <br />
          <span className="text-primary"> sport</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Follow LeetCode problem solvers, watch their progress live, and stay
          accountable with a community of developers who actually grind.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/sign-up">
            <Button size="lg" className="glow-orange w-full sm:w-auto" data-testid="hero-cta">
              Start tracking for free
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="hero-sign-in">
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      {/* Stats banner */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border text-center">
          {[
            { value: "Realtime", label: "Submission tracking" },
            { value: "Customizable", label: "Notifications & Emails" },
            { value: "Any", label: "Public LeetCode profile" },
          ].map(({ value, label }) => (
            <div key={label} className="px-4 py-6 md:py-0">
              <div className="text-2xl font-bold text-primary">{value}</div>
              <div className="text-sm text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <h2 className="text-3xl font-bold text-center mb-16">
          Everything you need to stay{" "}
          <span className="text-primary">competitive</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors"
              data-testid={`feature-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to level up your grind?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join developers who track their competitive programming network.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="glow-orange" data-testid="cta-final">
              Create your account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <SiLeetcode className="h-4 w-4 text-primary" />
          <span>LCTracker — not affiliated with LeetCode</span>
        </div>
      </footer>
    </div>
  );
}
