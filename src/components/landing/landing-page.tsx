"use client";

import { useEffect, useState } from "react";
import "./landing.css";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

/* ── Icons (Lucide-style SVGs) ── */
function IconActivity({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function IconBarChart({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}
function IconBrain({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 0-4 4v1a3 3 0 0 0-3 3 3 3 0 0 0 1.1 2.3A4 4 0 0 0 4 16a4 4 0 0 0 4 4h1" />
      <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3 3 3 0 0 1-1.1 2.3A4 4 0 0 1 20 16a4 4 0 0 1-4 4h-1" />
      <path d="M12 2v20" />
    </svg>
  );
}
function IconShield({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconCalendar({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconTrendingUp({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
function IconMessageSquare({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconTarget({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function IconCheckCircle({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
function IconX({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconArrowRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function IconDumbbell({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M6 12H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h2.5M6 12H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2.5M6 12h12M18 12h2a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-2.5M18 12h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2.5M6.5 6.5v11M17.5 6.5v11" />
    </svg>
  );
}
function IconZap({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function IconHeart({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/* ── NavBar ── */
function NavBar() {
  return (
    <nav className="l-nav">
      <div className="l-nav-inner">
        <div className="l-brand">
          <div className="l-brand-mark">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12l4-7 5 9 4-5 5 8" />
            </svg>
          </div>
          <span>Trainer</span>
        </div>
        <div className="l-nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#built-for">Built for</a>
        </div>
        <button className="l-btn l-btn-primary" onClick={() => scrollTo("waitlist")}>
          Get early access
        </button>
      </div>
    </nav>
  );
}

/* ── Dashboard Preview ── */
function DashboardPreview() {
  return (
    <div className="l-dash-preview">
      <div className="l-dash-top">
        <div className="l-dash-dot" style={{ background: "#EF4444" }} />
        <div className="l-dash-dot" style={{ background: "#F59E0B" }} />
        <div className="l-dash-dot" style={{ background: "#10B981" }} />
        <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: "var(--l-ink-3)", fontWeight: 500 }}>
          Trainer — Weekly Overview
        </span>
      </div>
      <div className="l-dash-body">
        {/* Fitness / Fatigue / Form card */}
        <div className="l-dash-card l-dash-card-wide">
          <div className="l-dash-label">Fitness / Fatigue / Form (CTL · ATL · TSB)</div>
          <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
            <div>
              <span className="l-dash-metric" style={{ color: "var(--l-primary)" }}>72</span>
              <span className="l-dash-sub" style={{ marginLeft: 6 }}>CTL</span>
            </div>
            <div>
              <span className="l-dash-metric" style={{ color: "var(--l-accent)" }}>58</span>
              <span className="l-dash-sub" style={{ marginLeft: 6 }}>ATL</span>
            </div>
            <div>
              <span className="l-dash-metric" style={{ color: "var(--l-green)" }}>+14</span>
              <span className="l-dash-sub" style={{ marginLeft: 6 }}>TSB</span>
            </div>
          </div>
          <svg className="l-mini-chart" viewBox="0 0 300 48" preserveAspectRatio="none">
            <defs>
              <linearGradient id="l-chart-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#3B82F6" stopOpacity="0.4" />
                <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="l-mini-chart-fill" d="M0,36 Q30,28 60,30 T120,24 T180,18 T240,14 T300,10 L300,48 L0,48 Z" />
            <path className="l-mini-chart-line" d="M0,36 Q30,28 60,30 T120,24 T180,18 T240,14 T300,10" />
            <circle className="l-mini-chart-dot" cx="300" cy="10" />
            {/* ATL line */}
            <path d="M0,32 Q30,30 60,34 T120,30 T180,26 T240,22 T300,18" stroke="#F59E0B" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="4 3" />
          </svg>
        </div>

        {/* Weekly volume */}
        <div className="l-dash-card">
          <div className="l-dash-label">Weekly Volume</div>
          <div className="l-dash-metric">42,800 <span style={{ fontSize: 13, color: "var(--l-ink-3)", fontWeight: 500 }}>lbs</span></div>
          <div className="l-dash-sub">
            <span className="l-dash-delta up">+8.2%</span>
            vs last week
          </div>
        </div>

        {/* HR Zones */}
        <div className="l-dash-card">
          <div className="l-dash-label">HR Zone Distribution</div>
          <div className="l-zone-bars">
            <div className="l-zone-bar" style={{ height: "20%", background: "#94A3B8" }} />
            <div className="l-zone-bar" style={{ height: "45%", background: "#3B82F6" }} />
            <div className="l-zone-bar" style={{ height: "70%", background: "#10B981" }} />
            <div className="l-zone-bar" style={{ height: "50%", background: "#F59E0B" }} />
            <div className="l-zone-bar" style={{ height: "25%", background: "#EF4444" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--l-ink-3)" }}>
            <span>Z1</span><span>Z2</span><span>Z3</span><span>Z4</span><span>Z5</span>
          </div>
        </div>

        {/* Recovery */}
        <div className="l-dash-card">
          <div className="l-dash-label">Recovery</div>
          <div style={{ display: "flex", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--l-ink-3)", marginBottom: 2 }}>HRV</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>62 <span style={{ fontSize: 11, color: "var(--l-green)" }}>ms</span></div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--l-ink-3)", marginBottom: 2 }}>RHR</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>52 <span style={{ fontSize: 11, color: "var(--l-ink-3)" }}>bpm</span></div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--l-ink-3)", marginBottom: 2 }}>Sleep</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>7.4 <span style={{ fontSize: 11, color: "var(--l-ink-3)" }}>h</span></div>
            </div>
          </div>
        </div>

        {/* Splits */}
        <div className="l-dash-card">
          <div className="l-dash-label">Last Run Splits</div>
          <div className="l-splits-row"><span className="l-splits-label">Mile 1</span><span className="l-splits-val">7:42</span></div>
          <div className="l-splits-row"><span className="l-splits-label">Mile 2</span><span className="l-splits-val">7:38</span></div>
          <div className="l-splits-row"><span className="l-splits-label">Mile 3</span><span className="l-splits-val">7:21</span></div>
          <div className="l-splits-row"><span className="l-splits-label">Avg</span><span className="l-splits-val" style={{ color: "var(--l-green)" }}>7:34</span></div>
        </div>
      </div>
    </div>
  );
}

/* ── Hero ── */
function HeroSection() {
  return (
    <section className="l-hero">
      <div className="l-hero-inner">
        <div>
          <div className="l-hero-badge">
            <span className="l-hero-badge-dot" />
            Beta — Now available on web
          </div>
          <h1 className="l-headline">
            Your training data,
            <br />
            <span className="l-headline-accent">unified and analyzed.</span>
          </h1>
          <p className="l-lede">
            Trainer connects MacroFactor, Hevy, Strava, and Garmin into a single intelligence layer.
            Review your training, spot trends, and get AI coaching grounded in real data.
          </p>
          <div className="l-cta-row">
            <button className="l-btn l-btn-primary l-btn-lg" onClick={() => scrollTo("waitlist")}>
              Get early access <IconArrowRight />
            </button>
            <a href="#features" className="l-btn l-btn-ghost l-btn-lg" style={{ textDecoration: "none" }}>
              See features
            </a>
          </div>
          <div className="l-kpi-strip">
            <div className="l-kpi">
              <div className="l-kpi-val">4</div>
              <div className="l-kpi-label">Data sources</div>
            </div>
            <div className="l-kpi">
              <div className="l-kpi-val green">8</div>
              <div className="l-kpi-label">AI coach tools</div>
            </div>
            <div className="l-kpi">
              <div className="l-kpi-val">24/7</div>
              <div className="l-kpi-label">AI availability</div>
            </div>
          </div>
        </div>
        <DashboardPreview />
      </div>
    </section>
  );
}

/* ── Integrations ── */
function IntegrationsBar() {
  const items = [
    { letter: "M", name: "MacroFactor", color: "#3D7BF8" },
    { letter: "H", name: "Hevy", color: "#6366F1" },
    { letter: "S", name: "Strava", color: "#FC4C02" },
    { letter: "G", name: "Garmin", color: "#0091D5" },
  ];
  return (
    <section className="l-integrations">
      <p className="l-integrations-label">Connects to the tools you already use</p>
      <div className="l-integrations-row">
        {items.map((item) => (
          <div key={item.name} className="l-integration-item">
            <span className="l-integration-ico" style={{ background: item.color }}>{item.letter}</span>
            {item.name}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Problem ── */
function ProblemSection() {
  return (
    <section className="l-section">
      <div className="l-section-head l-reveal">
        <div className="l-eyebrow">The problem</div>
        <h2 className="l-section-title">
          Five apps. Five silos.
          <br />
          <span className="l-dim">Zero cross-talk.</span>
        </h2>
        <p className="l-section-sub">
          You track nutrition, lifts, cardio, and recovery in separate apps.
          None of them see the full picture — so none of them can coach you.
        </p>
      </div>
      <div className="l-problem-grid">
        <div className="l-prob-card l-reveal">
          <div className="l-prob-icon"><IconX size={18} /></div>
          <h4>Your nutrition app doesn&apos;t know you crushed legs yesterday.</h4>
          <p>Protein targets stay flat while your recovery demands spike.</p>
        </div>
        <div className="l-prob-card l-reveal">
          <div className="l-prob-icon"><IconX size={18} /></div>
          <h4>Your lifting app doesn&apos;t know you slept 5 hours.</h4>
          <p>It programs the same heavy session — and you grind through it wrecked.</p>
        </div>
        <div className="l-prob-card l-reveal">
          <div className="l-prob-icon"><IconX size={18} /></div>
          <h4>Your run tracker doesn&apos;t know you&apos;re in a deficit.</h4>
          <p>It queues a tempo run that tanks recovery for the rest of the week.</p>
        </div>
      </div>
    </section>
  );
}

/* ── Features ── */
function FeaturesSection() {
  return (
    <section id="features" className="l-section">
      <div className="l-section-head l-reveal">
        <div className="l-eyebrow">Features</div>
        <h2 className="l-section-title">
          An intelligence layer
          <br />
          <span className="l-dim">for your entire training stack.</span>
        </h2>
      </div>
      <div className="l-feat-grid">
        <div className="l-feat l-feat-wide l-reveal">
          <div className="l-feat-icon blue"><IconBrain size={20} /></div>
          <h3>AI coach with full data access</h3>
          <p>
            Ask what to eat, whether to train, or how to fix a plateau. Trainer&apos;s AI sees your
            nutrition, workouts, cardio, recovery, and weight — then gives specific, data-backed advice.
          </p>
        </div>
        <div className="l-feat l-reveal">
          <div className="l-feat-icon amber"><IconTrendingUp size={20} /></div>
          <h3>Adaptive training plans</h3>
          <p>
            AI-generated plans that adjust weekly based on compliance, recovery trends, and performance data.
          </p>
        </div>
        <div className="l-feat l-reveal">
          <div className="l-feat-icon green"><IconShield size={20} /></div>
          <h3>Recovery-aware scheduling</h3>
          <p>
            HRV trending down? Sleep was rough? Trainer spots fatigue signals and adjusts before you burn out.
          </p>
        </div>
        <div className="l-feat l-reveal">
          <div className="l-feat-icon blue"><IconBarChart size={20} /></div>
          <h3>Unified analytics</h3>
          <p>
            Fitness curves, HR zone distribution, training load, body composition — all in one calendar view.
          </p>
        </div>
        <div className="l-feat l-feat-wide l-reveal">
          <div className="l-feat-icon amber"><IconCheckCircle size={20} /></div>
          <h3>You approve every change</h3>
          <p>
            Trainer proposes plan adjustments. You review and approve. Nothing changes without your sign-off — your training, your call. See exactly what changed and why before it ships.
          </p>
        </div>
        <div className="l-feat l-reveal">
          <div className="l-feat-icon green"><IconMessageSquare size={20} /></div>
          <h3>24/7 coach chat</h3>
          <p>
            &quot;What should I eat for dinner?&quot; Trainer checks your remaining macros and suggests meals that close the gap.
          </p>
        </div>
        <div className="l-feat l-reveal">
          <div className="l-feat-icon blue"><IconCalendar size={20} /></div>
          <h3>Training calendar</h3>
          <p>
            Month view with daily workout cards, planned sessions, compliance badges, and weekly muscle heat maps.
          </p>
        </div>
        <div className="l-feat l-reveal">
          <div className="l-feat-icon amber"><IconActivity size={20} /></div>
          <h3>Cardio enrichment</h3>
          <p>
            Strava + Garmin data merged. Training effect, VO2 max, HR zones, splits, and running dynamics in one view.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── How it works ── */
function HowItWorksSection() {
  return (
    <section id="how" className="l-section">
      <div className="l-section-head l-reveal">
        <div className="l-eyebrow">How it works</div>
        <h2 className="l-section-title">
          Three steps to
          <br />
          <span className="l-dim">smarter training.</span>
        </h2>
      </div>
      <div className="l-steps">
        <div className="l-step l-reveal">
          <div className="l-step-num">STEP 01</div>
          <h4>Connect your apps</h4>
          <p>
            Link MacroFactor, Hevy, Strava, and Garmin. Credentials are encrypted (AES-256-GCM) and data syncs automatically.
          </p>
        </div>
        <div className="l-step l-reveal">
          <div className="l-step-num">STEP 02</div>
          <h4>Set your goals</h4>
          <p>
            Training history, schedule constraints, body composition goals, and upcoming races. A few questions build your profile.
          </p>
        </div>
        <div className="l-step l-reveal">
          <div className="l-step-num">STEP 03</div>
          <h4>Review and train</h4>
          <p>
            Your AI coach builds a plan, adjusts it weekly, and is available 24/7 for the gray-area decisions.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Audience ── */
function AudienceSection() {
  return (
    <section id="built-for" className="l-section">
      <div className="l-section-head l-reveal">
        <div className="l-eyebrow">Built for</div>
        <h2 className="l-section-title">Serious athletes who train with data.</h2>
        <p className="l-section-sub">
          Trainer is for people juggling lifts, miles, macros, and a real life — who are tired of pretending five separate apps add up to a coach.
        </p>
      </div>
      <div className="l-aud-grid">
        <div className="l-aud l-reveal">
          <div className="l-aud-icon" style={{ background: "var(--l-primary-dim)", color: "var(--l-primary)" }}>
            <IconDumbbell size={20} />
          </div>
          <h4>Bodybuilders</h4>
          <p>Periodization, volume tracking, cut and bulk phase management.</p>
        </div>
        <div className="l-aud l-reveal">
          <div className="l-aud-icon" style={{ background: "var(--l-accent-dim)", color: "var(--l-accent)" }}>
            <IconZap size={20} />
          </div>
          <h4>Hybrid athletes</h4>
          <p>Strength + endurance with concurrent training interference managed.</p>
        </div>
        <div className="l-aud l-reveal">
          <div className="l-aud-icon" style={{ background: "var(--l-green-dim)", color: "var(--l-green)" }}>
            <IconActivity size={20} />
          </div>
          <h4>Runners</h4>
          <p>5K to Ironman — taper timing, pace zones, and race prep handled.</p>
        </div>
        <div className="l-aud l-reveal">
          <div className="l-aud-icon" style={{ background: "var(--l-red-dim)", color: "var(--l-red)" }}>
            <IconHeart size={20} />
          </div>
          <h4>Recovery-focused</h4>
          <p>HRV, sleep, RHR, and body battery tracked to prevent overtraining.</p>
        </div>
      </div>
    </section>
  );
}

/* ── CTA / Waitlist ── */
function WaitlistSection() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector("input") as HTMLInputElement;
    if (input?.value) {
      input.value = "";
      setSubmitted(true);
    }
  };

  return (
    <section id="waitlist" className="l-cta-section">
      <div className="l-cta-card l-reveal">
        <h2>
          Start training with an AI coach
          <br />
          that sees your full picture.
        </h2>
        <p>
          Join the waitlist. Early-access invites ship as we scale the beta.
        </p>
        <form className="l-cta-form" onSubmit={handleSubmit}>
          <input type="email" required placeholder="you@athlete.com" aria-label="Email address" />
          <button type="submit">Get early access</button>
        </form>
        {submitted ? (
          <p className="l-cta-foot">You&apos;re on the list. We&apos;ll email you when your invite is ready.</p>
        ) : (
          <p className="l-cta-foot">No spam. Unsubscribe anytime.</p>
        )}
      </div>
    </section>
  );
}

/* ── Footer ── */
function Footer() {
  return (
    <footer className="l-footer">
      <div className="l-foot">
        <div className="l-brand" style={{ fontSize: 16, gap: 8 }}>
          <div className="l-brand-mark" style={{ width: 26, height: 26, borderRadius: 6 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12l4-7 5 9 4-5 5 8" />
            </svg>
          </div>
          <span>Trainer</span>
        </div>
        <div className="l-foot-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Twitter</a>
          <a href="#">Contact</a>
        </div>
        <small>&copy; 2025 Trainer</small>
      </div>
    </footer>
  );
}

/* ── Main ── */
export default function LandingPage() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".l-reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing-root">
      <NavBar />
      <HeroSection />
      <IntegrationsBar />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <AudienceSection />
      <WaitlistSection />
      <Footer />
    </div>
  );
}
