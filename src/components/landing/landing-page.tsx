"use client";

import { useEffect, useRef, useState } from "react";
import "./landing.css";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="landing-brand-mark"
      style={{ width: size, height: size, borderRadius: size * 0.33 }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path
          d="M5 4v16M5 12h7M12 4v16M19 7l3 3-3 3M19 14l3 3-3 3"
          stroke="#F6B7A6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function NavBar() {
  return (
    <nav className="landing-nav">
      <div className="landing-nav-inner">
        <div className="landing-brand">
          <BrandMark />
          <span>Hybro</span>
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#built-for">Built for</a>
          <a href="#waitlist">Waitlist</a>
        </div>
        <button
          className="landing-btn landing-btn-primary"
          onClick={() => scrollTo("waitlist")}
        >
          Get early access
        </button>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="landing-hero">
      <div className="landing-blob landing-blob-a" />
      <div className="landing-blob landing-blob-b" />
      <div className="landing-blob landing-blob-c" />

      <div className="landing-hero-grid">
        {/* Left — Copy */}
        <div className="hero-copy">
          <span className="landing-pill">
            <span className="landing-pill-dot" /> Coming soon to iOS &middot; Beta opens this summer
          </span>
          <h1 className="landing-headline">
            Train smarter,
            <br />
            not <em>harder.</em>
          </h1>
          <p className="landing-lede">
            Hybro is the AI coach for hybrid athletes. It connects MacroFactor, Hevy, Strava,
            Garmin and your calendar — then builds one plan that adapts to your sleep, recovery,
            and life.
          </p>
          <div className="landing-cta-row">
            <button
              className="landing-btn landing-btn-coral landing-btn-lg"
              onClick={() => scrollTo("waitlist")}
            >
              Join the waitlist
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <a href="#features" className="landing-cta-secondary">
              See features
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
          <div className="landing-social-proof">
            <div className="landing-avatars">
              <span className="landing-av-1" />
              <span className="landing-av-2" />
              <span className="landing-av-3" />
              <span className="landing-av-4" />
            </div>
            <div className="landing-proof-text">
              <div className="landing-stars">★★★★★</div>
              <div>
                <b>2,400+ athletes</b> on the waitlist
              </div>
            </div>
          </div>
        </div>

        {/* Right — Phone mockups */}
        <div className="landing-phone-stage">
          {/* Floating decorations */}
          <div className="landing-deco landing-deco-a landing-tag-coral">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 21s-7-4.35-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.65-7 10-7 10z"
                fill="currentColor"
              />
            </svg>
            72 BPM · Resting
          </div>
          <div className="landing-deco landing-deco-b landing-tag-sky">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 12l4-7 5 9 4-5 5 8"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            +1.2% strength
          </div>
          <div className="landing-deco landing-deco-c landing-tag-mint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" />
              <path
                d="M8 12l3 3 5-6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Recovery: Ready
          </div>

          {/* Phone 1: Run */}
          <div className="landing-phone landing-phone-1">
            <div className="landing-p2">
              <div className="landing-p2-top">
                <div className="landing-p2-back">‹</div>
                <h4>Today&apos;s run</h4>
                <div style={{ width: 28 }} />
              </div>
              <div className="landing-p2-ring-wrap">
                <div className="landing-p2-ring">
                  <div className="landing-p2-ring-inner">
                    <div className="landing-p2-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M13 4a2 2 0 100 4 2 2 0 000-4zM6 22l3-7 4 2 2 5M11 13l-2 2-3-3 4-3 3 1 2 4-2 1"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <small>Easy zone 2</small>
                    <h2>
                      5.2<span className="landing-unit">km</span>
                    </h2>
                  </div>
                </div>
              </div>
              <div className="landing-p2-stats">
                <div className="landing-p2-stat">
                  <p>Pace</p>
                  <h4>5&apos;42&quot;</h4>
                </div>
                <div className="landing-p2-stat">
                  <p>Time</p>
                  <h4>32:14</h4>
                </div>
                <div className="landing-p2-stat">
                  <p>HR</p>
                  <h4>138</h4>
                </div>
              </div>
              <div className="landing-p2-cta">
                <span className="landing-play">▶</span> Start run
              </div>
            </div>
          </div>

          {/* Phone 2: Today / Center */}
          <div className="landing-phone landing-phone-2">
            <div className="landing-screen">
              <div className="landing-p1-head">
                <div className="landing-p1-greet">
                  <div className="landing-p1-avatar" />
                  <div>
                    <p>Good morning</p>
                    <h4>Hi, Alex 👋</h4>
                  </div>
                </div>
                <div className="landing-p1-bell">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 21a2 2 0 004 0"
                      stroke="#0F1B22"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="landing-ring-card">
                <div className="landing-ring">
                  <span>64%</span>
                </div>
                <div className="landing-ring-meta">
                  <p>Today</p>
                  <h3>Push Day</h3>
                  <span className="landing-delta">8 of 12 sets</span>
                </div>
              </div>

              <div className="landing-chips">
                <div className="landing-chip landing-chip-coral">
                  <p>Calories</p>
                  <h5>1,847</h5>
                </div>
                <div className="landing-chip landing-chip-mint">
                  <p>Protein</p>
                  <h5>148g</h5>
                </div>
                <div className="landing-chip">
                  <p>Sleep</p>
                  <h5>7.2h</h5>
                </div>
              </div>

              <div className="landing-chart-card">
                <div className="landing-chart-card-h">
                  <p>Weight trend</p>
                  <h6>−0.4 lb</h6>
                </div>
                <svg className="landing-spark" viewBox="0 0 200 60" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="landing-sg" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#6FB6CE" stopOpacity="0.5" />
                      <stop offset="1" stopColor="#6FB6CE" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    className="landing-spark-fill"
                    d="M0,38 Q20,30 40,32 T80,28 T120,22 T160,18 T200,14 L200,60 L0,60 Z"
                  />
                  <path
                    className="landing-spark-line"
                    d="M0,38 Q20,30 40,32 T80,28 T120,22 T160,18 T200,14"
                  />
                  <circle className="landing-spark-dot" cx="200" cy="14" r="3.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Phone 3: Coach Chat */}
          <div className="landing-phone landing-phone-3">
            <div className="landing-p3">
              <div className="landing-p3-head">
                <div className="landing-p3-avatar">H</div>
                <div>
                  <h4>Hybro Coach</h4>
                  <p>● Online · sees your data</p>
                </div>
              </div>
              <div className="landing-bubble landing-bubble-me">What should I eat tonight?</div>
              <div className="landing-bubble landing-bubble-coach">
                You&apos;re <b>82g protein</b> short. Try:
              </div>
              <div className="landing-bubble landing-bubble-suggest">
                🍗 Chicken bowl + rice (52g P)
              </div>
              <div className="landing-bubble landing-bubble-suggest">
                🐟 Salmon teriyaki (48g P)
              </div>
              <div className="landing-bubble landing-bubble-me">Should I run tomorrow?</div>
              <div className="landing-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarqueeSection() {
  const items = [
    { letter: "M", name: "MacroFactor", color: "#3D7BF8" },
    { letter: "H", name: "Hevy", color: "#0F1B22" },
    { letter: "S", name: "Strava", color: "#FC4C02" },
    { letter: "G", name: "Garmin", color: "#0091D5" },
    { letter: "C", name: "Google Calendar", color: "#4285F4" },
    { letter: "A", name: "Apple Health", color: "#000" },
    { letter: "W", name: "Whoop", color: "#FF375F" },
  ];

  const doubled = [...items, ...items];

  return (
    <section className="landing-marquee-section">
      <p className="landing-marquee-label">Connects to the apps you already use</p>
      <div className="landing-marquee">
        <div className="landing-marquee-track">
          {doubled.map((item, i) => (
            <div key={i} className="landing-marquee-item">
              <span className="landing-marquee-ico" style={{ background: item.color }}>
                {item.letter}
              </span>
              {item.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="landing-section landing-problem">
      <div className="landing-section-head landing-reveal">
        <div className="landing-section-eyebrow">The problem</div>
        <h2 className="landing-section-title">
          You&apos;re tracking everything.
          <br />
          <span className="landing-text-muted">Nothing talks to each other.</span>
        </h2>
        <p className="landing-section-sub">
          Five apps. Five dashboards. Five silos. None of them know what the others know — so none
          of them coach you.
        </p>
      </div>
      <div className="landing-problem-grid">
        <div className="landing-prob-card landing-reveal">
          <div className="landing-x">×</div>
          <h4>Your nutrition app doesn&apos;t know you crushed legs yesterday.</h4>
          <p>So your protein target stays flat while your recovery demands more.</p>
        </div>
        <div className="landing-prob-card landing-reveal">
          <div className="landing-x">×</div>
          <h4>Your lifting app doesn&apos;t know you only slept 5 hours.</h4>
          <p>So it pushes the same heavy session — and you grind through it half-broken.</p>
        </div>
        <div className="landing-prob-card landing-reveal">
          <div className="landing-x">×</div>
          <h4>Your run tracker doesn&apos;t know you&apos;re in a deficit.</h4>
          <p>So it queues a tempo run that wrecks recovery for the rest of the week.</p>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="landing-section">
      <div className="landing-section-head landing-reveal">
        <div className="landing-section-eyebrow">Features</div>
        <h2 className="landing-section-title">
          Everything a great coach does.
          <br />
          <span className="landing-text-muted">In your pocket.</span>
        </h2>
      </div>

      <div className="landing-feat-grid">
        {/* AI Coach — tall coral */}
        <div className="landing-feat landing-color-coral landing-feat-tall landing-reveal">
          <div className="landing-feat-tag">● AI Coach</div>
          <h3>An AI coach that actually knows your body.</h3>
          <p>
            Ask what to eat, whether to train, or how to fix a lagging body part. Get advice
            grounded in your real data — not generic gym tips.
          </p>
          <div className="landing-feat-illu">
            <svg viewBox="0 0 320 120" width="100%">
              <rect x="8" y="20" rx="14" width="180" height="38" fill="#fff" />
              <text x="20" y="44" fontSize="13" fontWeight="700" fill="#0F1B22">
                Skip today — HRV ↓ 22%
              </text>
              <rect x="100" y="68" rx="14" width="212" height="38" fill="#0F1B22" />
              <text x="112" y="92" fontSize="12.5" fontWeight="700" fill="#F6B7A6">
                Coach knows. Coach adjusts.
              </text>
            </svg>
          </div>
        </div>

        {/* Adaptive plans — tall ink */}
        <div className="landing-feat landing-color-ink landing-feat-tall landing-reveal">
          <div className="landing-feat-tag">● Adaptive plans</div>
          <h3>Plans that evolve every week.</h3>
          <p>
            Compliance, recovery, performance — Hybro re-tunes your plan and shows you exactly what
            changed before it ships.
          </p>
          <div className="landing-feat-illu">
            <svg viewBox="0 0 320 110" width="100%">
              <path
                d="M10,80 Q60,60 110,70 T210,40 T310,20"
                stroke="#F6B7A6"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M10,80 Q60,60 110,70 T210,40 T310,20 L310,110 L10,110 Z"
                fill="#F6B7A6"
                opacity="0.15"
              />
              <circle cx="110" cy="70" r="5" fill="#F6B7A6" />
              <circle cx="210" cy="40" r="5" fill="#F6B7A6" />
              <circle cx="310" cy="20" r="6" fill="#fff" stroke="#F6B7A6" strokeWidth="3" />
            </svg>
          </div>
        </div>

        {/* Recovery — sm sky */}
        <div className="landing-feat landing-color-sky landing-feat-sm landing-reveal">
          <div className="landing-feat-tag">● Recovery</div>
          <h3>Recovery aware.</h3>
          <p>HRV trending down? Sleep was rough? Hybro spots it before you burn out.</p>
        </div>

        {/* Splits — sm mint */}
        <div className="landing-feat landing-color-mint landing-feat-sm landing-reveal">
          <div className="landing-feat-tag">● Splits</div>
          <h3>Smart split selection.</h3>
          <p>PPL, Arnold, Upper/Lower or Hybrid — picked for your goals and schedule.</p>
        </div>

        {/* Calendar — sm lemon */}
        <div className="landing-feat landing-color-lemon landing-feat-sm landing-reveal">
          <div className="landing-feat-tag">● Calendar</div>
          <h3>Calendar sync.</h3>
          <p>Reads your week, finds open slots, drops approved sessions in.</p>
        </div>

        {/* 24/7 Chat — wide */}
        <div className="landing-feat landing-feat-wide landing-reveal">
          <div className="landing-feat-tag">● 24/7 Chat</div>
          <h3>Talk to your coach. Anytime.</h3>
          <p>
            &quot;What should I eat for dinner?&quot; Hybro checks your macros, sees you have 80g
            protein left, and suggests three meals you&apos;d actually make.
          </p>
        </div>

        {/* You decide — wide coral */}
        <div className="landing-feat landing-color-coral landing-feat-wide landing-reveal">
          <div className="landing-feat-tag">● You decide</div>
          <h3>You approve every change.</h3>
          <p>
            Hybro proposes. You approve. Nothing changes in your plan without your sign-off — your
            body, your call.
          </p>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="how" className="landing-section">
      <div className="landing-section-head landing-reveal">
        <div className="landing-section-eyebrow">How it works</div>
        <h2 className="landing-section-title">
          Three steps.
          <br />
          <span className="landing-text-muted">Smarter every week.</span>
        </h2>
      </div>
      <div className="landing-steps">
        <div className="landing-step landing-reveal">
          <div className="landing-step-num">01</div>
          <h4>Connect your apps</h4>
          <p>
            Link MacroFactor, Hevy, Strava, Garmin and Google Calendar. Two minutes, no
            spreadsheets.
          </p>
          <div className="landing-step-illu landing-ill-1">
            <svg viewBox="0 0 200 100" width="160">
              <circle cx="40" cy="50" r="22" fill="#fff" />
              <text x="40" y="56" textAnchor="middle" fontSize="18" fontWeight="800">
                M
              </text>
              <circle cx="100" cy="50" r="22" fill="#0F1B22" />
              <text
                x="100"
                y="56"
                textAnchor="middle"
                fontSize="18"
                fontWeight="800"
                fill="#fff"
              >
                H
              </text>
              <circle cx="160" cy="50" r="22" fill="#fff" />
              <text x="160" y="56" textAnchor="middle" fontSize="18" fontWeight="800">
                S
              </text>
              <path
                d="M62,50 L78,50 M122,50 L138,50"
                stroke="#0F1B22"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="3 4"
              />
            </svg>
          </div>
        </div>
        <div className="landing-step landing-reveal">
          <div className="landing-step-num">02</div>
          <h4>Tell us your goals</h4>
          <p>
            Body goals, training history, schedule, upcoming races. A few questions and we know the
            shape of your week.
          </p>
          <div className="landing-step-illu landing-ill-2">
            <svg viewBox="0 0 200 100" width="160">
              <rect x="20" y="20" rx="10" width="160" height="14" fill="#fff" />
              <rect x="20" y="20" rx="10" width="120" height="14" fill="#0F1B22" />
              <rect x="20" y="44" rx="10" width="160" height="14" fill="#fff" />
              <rect x="20" y="44" rx="10" width="80" height="14" fill="#0F1B22" />
              <rect x="20" y="68" rx="10" width="160" height="14" fill="#fff" />
              <rect x="20" y="68" rx="10" width="140" height="14" fill="#0F1B22" />
            </svg>
          </div>
        </div>
        <div className="landing-step landing-reveal">
          <div className="landing-step-num">03</div>
          <h4>Get coached daily</h4>
          <p>
            Your AI coach builds your plan, adjusts it weekly, and is online 24/7 for the
            gray-area calls.
          </p>
          <div className="landing-step-illu landing-ill-3">
            <svg viewBox="0 0 200 100" width="160">
              <rect x="20" y="30" rx="10" width="100" height="22" fill="#fff" />
              <text x="32" y="46" fontSize="11" fontWeight="700">
                Push it today 🔥
              </text>
              <rect x="80" y="58" rx="10" width="100" height="22" fill="#0F1B22" />
              <text x="92" y="74" fontSize="11" fontWeight="700" fill="#F6B7A6">
                On it, coach.
              </text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function AudienceSection() {
  return (
    <section id="built-for" className="landing-section">
      <div className="landing-section-head landing-reveal">
        <div className="landing-section-eyebrow">Built for</div>
        <h2 className="landing-section-title">Athletes who take it seriously.</h2>
        <p className="landing-section-sub">
          Hybro is built for the people juggling lifts, miles, macros and a real life — and tired
          of pretending five separate apps add up to a coach.
        </p>
      </div>
      <div className="landing-aud-cards">
        <div className="landing-aud landing-reveal">
          <div className="landing-aud-emoji">💪</div>
          <h4>Bodybuilders</h4>
          <p>Periodization, volume tracking, cut and bulk phases.</p>
        </div>
        <div className="landing-aud landing-reveal">
          <div className="landing-aud-emoji">⚡</div>
          <h4>Hybrid athletes</h4>
          <p>Strength + endurance with interference managed.</p>
        </div>
        <div className="landing-aud landing-reveal">
          <div className="landing-aud-emoji">🏃</div>
          <h4>Runners</h4>
          <p>5K to Ironman — taper timing and race prep handled.</p>
        </div>
        <div className="landing-aud landing-reveal">
          <div className="landing-aud-emoji">🏋️</div>
          <h4>Serious lifters</h4>
          <p>PPL, Arnold, Upper/Lower — auto-adjusted to your week.</p>
        </div>
      </div>
    </section>
  );
}

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
    <section id="waitlist" className="landing-cta-section">
      <div className="landing-cta-card landing-reveal">
        <div className="landing-cta-blob landing-cta-blob-a" />
        <div className="landing-cta-blob landing-cta-blob-b" />
        <h2>
          Be the first to train with a coach <em>that actually knows you.</em>
        </h2>
        <p>
          Join 2,400+ athletes on the waitlist. Early-access invites go out as we open the iOS
          beta.
        </p>
        <form className="landing-cta-form" onSubmit={handleSubmit}>
          <input type="email" required placeholder="you@hybridathlete.com" />
          <button type="submit">Get early access</button>
        </form>
        {submitted ? (
          <p className="landing-cta-foot">
            ✓ You&apos;re on the list. We&apos;ll email you when your invite is ready.
          </p>
        ) : (
          <p className="landing-cta-foot">No spam. Unsubscribe anytime. iOS only at launch.</p>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-foot">
        <div className="landing-brand" style={{ fontSize: 18 }}>
          <BrandMark size={30} />
          <span>Hybro</span>
        </div>
        <div className="landing-foot-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Twitter</a>
          <a href="#">Contact</a>
        </div>
        <small>© 2025 Hybro Labs · Made for athletes</small>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in");
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    document.querySelectorAll(".landing-reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif", background: "#EAF3F6", minHeight: "100vh", overflowX: "hidden" as const }}>
      <NavBar />
      <HeroSection />
      <MarqueeSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <AudienceSection />
      <WaitlistSection />
      <Footer />
    </div>
  );
}
