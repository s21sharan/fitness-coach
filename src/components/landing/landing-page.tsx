"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import {
  Dumbbell,
  Brain,
  Calendar,
  ArrowRight,
  Zap,
  TrendingUp,
  Moon,
  MessageCircle,
  ChevronDown,
  Check,
  Apple,
} from "lucide-react";
import { HybroWordmark, HybroLogo } from "./hybro-logo";
import { PhoneMockup, DashboardScreen, ChatScreen } from "./phone-mockup";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

function NavBar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="fixed top-0 z-50 w-full border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <HybroWordmark className="text-white" />
        <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#features" className="transition-colors hover:text-white">Features</a>
          <a href="#how-it-works" className="transition-colors hover:text-white">How It Works</a>
          <a href="#waitlist" className="transition-colors hover:text-white">Waitlist</a>
        </div>
        <a
          href="#waitlist"
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-400 hover:shadow-lg hover:shadow-orange-500/25 active:scale-95"
        >
          Join Waitlist
        </a>
      </div>
    </motion.nav>
  );
}

function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(249,115,22,0.08)_0%,_transparent_70%)]" />
      <div className="absolute top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-orange-500/5 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — Copy */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="text-center lg:text-left"
          >
            <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1.5">
              <Apple size={14} className="text-orange-400" />
              <span className="text-sm font-medium text-orange-300">Coming Soon to iOS</span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-5xl font-bold leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl"
            >
              Stop guessing.
              <br />
              <span className="bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">
                Start being coached.
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mx-auto mt-6 max-w-lg text-lg text-zinc-400 lg:mx-0"
            >
              Hybro connects your MacroFactor, Hevy, Strava, and Garmin data into one AI coach that actually knows your body, your goals, and your week.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <a
                href="#waitlist"
                className="group flex items-center gap-2 rounded-full bg-orange-500 px-7 py-3.5 text-base font-semibold text-white transition-all hover:bg-orange-400 hover:shadow-xl hover:shadow-orange-500/25 active:scale-95"
              >
                Join the Waitlist
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#features"
                className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
              >
                See how it works
                <ChevronDown size={14} />
              </a>
            </motion.div>
          </motion.div>

          {/* Right — Phone mockups */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative flex justify-center"
          >
            {/* Background phone (chat) */}
            <div className="absolute right-0 top-8 hidden opacity-40 blur-[1px] lg:block" style={{ transform: "rotate(6deg) scale(0.85)" }}>
              <PhoneMockup>
                <ChatScreen />
              </PhoneMockup>
            </div>
            {/* Foreground phone (dashboard) */}
            <PhoneMockup className="relative z-10">
              <DashboardScreen />
            </PhoneMockup>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="relative py-28">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-white md:text-4xl">
            You&apos;re tracking everything.
            <br />
            <span className="text-zinc-500">But nothing talks to each other.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-6 text-lg leading-relaxed text-zinc-400">
            Your nutrition app doesn&apos;t know you crushed legs yesterday. Your workout tracker doesn&apos;t know you only slept 5 hours. Your running app has no idea you&apos;re in a caloric deficit.
          </motion.p>
          <motion.p variants={fadeUp} className="mt-4 text-lg font-semibold text-orange-400">
            You need a coach who sees all of it.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

function IntegrationLogos() {
  const apps = [
    { name: "MacroFactor", desc: "Nutrition" },
    { name: "Hevy", desc: "Workouts" },
    { name: "Strava", desc: "Cardio" },
    { name: "Garmin", desc: "Recovery" },
    { name: "Google Cal", desc: "Schedule" },
  ];

  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="text-center"
        >
          <motion.p variants={fadeUp} className="mb-8 text-sm font-medium uppercase tracking-widest text-zinc-500">
            Connects with the tools you already use
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {apps.map((app) => (
              <div
                key={app.name}
                className="group flex flex-col items-center gap-2"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/80 ring-1 ring-white/5 transition-all group-hover:bg-zinc-700/80 group-hover:ring-orange-500/30">
                  <span className="text-lg font-bold text-zinc-300 transition-colors group-hover:text-orange-400">
                    {app.name[0]}
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-zinc-300">{app.name}</p>
                  <p className="text-[10px] text-zinc-600">{app.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
          {/* Connection lines */}
          <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-2">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-zinc-700" />
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 ring-1 ring-orange-500/30">
              <Zap size={16} className="text-orange-400" />
            </div>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-zinc-700" />
          </motion.div>
          <motion.p variants={fadeUp} className="mt-3 text-xs text-zinc-600">
            All your data flows into one AI coach
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Brain,
      title: "AI Coach That Knows You",
      desc: "Ask what to eat, whether to train, or how to fix a lagging body part. Get advice based on your actual data, not generic tips.",
    },
    {
      icon: TrendingUp,
      title: "Auto-Adjusting Plans",
      desc: "Your plan evolves every week based on compliance, recovery, and performance. You approve all changes before they take effect.",
    },
    {
      icon: Dumbbell,
      title: "Smart Split Selection",
      desc: "PPL, Arnold, Upper/Lower, or Hybrid — Hybro picks the right split for your goals, experience, and schedule.",
    },
    {
      icon: Moon,
      title: "Recovery-Aware",
      desc: "HRV trending down? Sleep was rough? Hybro notices and adjusts your plan before you burn out.",
    },
    {
      icon: MessageCircle,
      title: "24/7 Chat Coach",
      desc: "\"What should I eat for dinner?\" — Hybro checks your macros, sees you have 80g protein left, and suggests meals.",
    },
    {
      icon: Calendar,
      title: "Calendar Sync",
      desc: "Hybro reads your Google Calendar, finds open slots, and adds approved workouts as events.",
    },
  ];

  return (
    <section id="features" className="relative py-28">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="mb-16 text-center">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-orange-400">Features</p>
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Everything a great coach does.
              <br />
              <span className="text-zinc-500">In your pocket.</span>
            </h2>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="group rounded-2xl border border-white/5 bg-zinc-900/50 p-6 transition-all hover:border-orange-500/20 hover:bg-zinc-900/80"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 transition-colors group-hover:bg-orange-500/20">
                  <f.icon size={20} className="text-orange-400" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      num: "01",
      title: "Download & Connect",
      desc: "Download Hybro and link MacroFactor, Hevy, Strava, Garmin, and Google Calendar. Takes 2 minutes.",
    },
    {
      num: "02",
      title: "Tell Us Your Goals",
      desc: "Body goals, training experience, schedule, upcoming races — a few quick questions and we know what you need.",
    },
    {
      num: "03",
      title: "Get Coached",
      desc: "Your AI coach generates a personalized plan, adjusts it weekly, and is available 24/7 — all from your pocket.",
    },
  ];

  return (
    <section id="how-it-works" className="relative py-28">
      {/* Background accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(249,115,22,0.05)_0%,_transparent_60%)]" />

      <div className="relative mx-auto max-w-4xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="mb-16 text-center">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-orange-400">How It Works</p>
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Three steps to smarter training.
            </h2>
          </motion.div>

          <div className="space-y-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                variants={fadeUp}
                className="flex items-start gap-6 rounded-2xl border border-white/5 bg-zinc-900/40 p-6 transition-all hover:border-orange-500/15"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-lg font-bold text-orange-400">
                  {step.num}
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function AudienceSection() {
  const audiences = [
    { label: "Bodybuilders", desc: "Periodization, volume tracking, diet phases" },
    { label: "Hybrid Athletes", desc: "Strength + endurance, interference management" },
    { label: "Runners", desc: "5K to Ironman, taper timing, race prep" },
    { label: "Serious Lifters", desc: "PPL, Arnold, Upper/Lower — auto-adjusted" },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="text-center"
        >
          <motion.p variants={fadeUp} className="mb-3 text-sm font-medium uppercase tracking-widest text-orange-400">
            Built For
          </motion.p>
          <motion.h2 variants={fadeUp} className="mb-10 text-3xl font-bold text-white md:text-4xl">
            Athletes who take it seriously.
          </motion.h2>
          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-3">
            {audiences.map((a) => (
              <div
                key={a.label}
                className="group rounded-full border border-white/5 bg-zinc-900/60 px-5 py-3 transition-all hover:border-orange-500/20"
              >
                <p className="text-sm font-medium text-white">{a.label}</p>
                <p className="text-[11px] text-zinc-500 transition-colors group-hover:text-zinc-400">{a.desc}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
    }
  };

  return (
    <section id="waitlist" className="relative py-28">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(249,115,22,0.1)_0%,_transparent_60%)]" />

      <div className="relative mx-auto max-w-xl px-6 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.div variants={fadeUp}>
            <HybroLogo size={48} className="mx-auto mb-6 text-white" />
          </motion.div>

          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-white md:text-4xl">
            Coming soon to iOS.
          </motion.h2>

          <motion.p variants={fadeUp} className="mt-4 text-lg text-zinc-400">
            Join the waitlist to get early access and be the first to train with an AI coach that actually knows your data.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8">
            {submitted ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-green-500/20 bg-green-500/10 py-4">
                <Check size={20} className="text-green-400" />
                <p className="text-sm font-medium text-green-300">You&apos;re on the list. We&apos;ll email you when it&apos;s ready.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 rounded-full border border-white/10 bg-zinc-900/80 px-5 py-3.5 text-sm text-white placeholder:text-zinc-600 outline-none transition-all focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20"
                />
                <button
                  type="submit"
                  className="group flex items-center justify-center gap-2 rounded-full bg-orange-500 px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-orange-400 hover:shadow-xl hover:shadow-orange-500/25 active:scale-95"
                >
                  Join Waitlist
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </button>
              </form>
            )}
          </motion.div>

          <motion.p variants={fadeUp} className="mt-4 text-xs text-zinc-600">
            No spam. We&apos;ll only email you when it&apos;s ready.
          </motion.p>

          {/* App Store badge */}
          <motion.div variants={fadeUp} className="mt-8 flex justify-center">
            <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-zinc-900/60 px-5 py-3 opacity-60">
              <Apple size={20} className="text-white" />
              <div className="text-left">
                <p className="text-[9px] leading-none text-zinc-500">Coming Soon on the</p>
                <p className="text-sm font-semibold leading-tight text-white">App Store</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <HybroWordmark className="text-zinc-500" />
          <div className="flex items-center gap-6 text-sm text-zinc-600">
            <a href="#" className="transition-colors hover:text-zinc-400">Privacy</a>
            <a href="#" className="transition-colors hover:text-zinc-400">Terms</a>
            <a href="#" className="transition-colors hover:text-zinc-400">Twitter</a>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-zinc-700">
          Coming soon to iOS. Join the waitlist for early access.
        </p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <HeroSection />
      <IntegrationLogos />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <AudienceSection />
      <WaitlistSection />
      <Footer />
    </div>
  );
}
