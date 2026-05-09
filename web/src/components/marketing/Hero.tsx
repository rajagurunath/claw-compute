import Link from "next/link";
import { ArrowRight, Code2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Animated gradient mesh */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu blur-3xl"
      >
        <div
          className="relative left-1/2 aspect-[1155/678] w-[72rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-violet-500/30 via-fuchsia-500/20 to-cyan-400/30 opacity-50 motion-safe:animate-[hero-pulse_10s_ease-in-out_infinite]"
          style={{
            clipPath:
              "polygon(74% 44%, 100% 61%, 97% 26%, 85% 0%, 80% 2%, 72% 32%, 60% 62%, 52% 68%, 47% 58%, 45% 34%, 27% 76%, 0% 64%, 17% 100%, 27% 76%, 76% 97%, 74% 44%)",
          }}
        />
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-24 pb-20 text-center md:pt-32 md:pb-28">
        <Link
          href="/pricing"
          className="group mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition hover:border-foreground/30 hover:text-foreground"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
          12% commission · 88% to suppliers
          <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </Link>
        <h1 className="text-balance bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-5xl font-semibold tracking-tight text-transparent md:text-7xl">
          Idle Macs,
          <br />
          hired by the hour.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground md:text-xl">
          Hire sandboxed AI agents running on idle Apple Silicon. Suppliers
          install one binary and start earning from compute that would
          otherwise sit idle.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="min-w-44">
            <Link href="/browse">
              Browse offerings
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-w-44">
            <Link href="/auth/login?next=/dashboard/become-supplier">
              Become a supplier
            </Link>
          </Button>
        </div>
        <p className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Code2 className="h-3.5 w-3.5" />
          Open-source worker · MLX-native · Trust-but-verify
        </p>
      </div>

      {/* Live stats strip */}
      <div className="border-y border-border/40 bg-muted/30">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6 py-8 text-center md:grid-cols-4">
          <Stat label="suppliers online" value="—" />
          <Stat label="median tok/s" value="130" />
          <Stat label="avg $/hour" value="$1.80" />
          <Stat label="commission" value="12%" />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tracking-tight md:text-3xl">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
