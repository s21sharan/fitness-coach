"use client";

export function PhoneMockup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Glow effect */}
      <div className="absolute -inset-4 rounded-[3rem] bg-orange-500/20 blur-3xl" />
      {/* Phone frame */}
      <div className="relative w-[280px] rounded-[2.5rem] border-[6px] border-zinc-700 bg-zinc-900 p-2 shadow-2xl">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
        {/* Screen */}
        <div className="overflow-hidden rounded-[2rem] bg-zinc-950">
          {children}
        </div>
      </div>
    </div>
  );
}

export function DashboardScreen() {
  return (
    <div className="w-full space-y-3 p-4 pt-10 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-zinc-500">Good morning</p>
          <p className="text-sm font-semibold">Today&apos;s Plan</p>
        </div>
        <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center">
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600" />
        </div>
      </div>

      {/* Today Card */}
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-4">
        <p className="text-[10px] font-medium text-orange-100">TODAY</p>
        <p className="mt-1 text-lg font-bold text-white">Push Day</p>
        <p className="mt-0.5 text-[10px] text-orange-100">
          Keep it moderate — HRV was low
        </p>
      </div>

      {/* Weekly Strip */}
      <div>
        <p className="mb-2 text-[10px] font-medium text-zinc-500">THIS WEEK</p>
        <div className="flex gap-1.5">
          {[
            { day: "M", label: "Push", done: true },
            { day: "T", label: "Pull", done: true },
            { day: "W", label: "Legs", done: true },
            { day: "T", label: "Rest", done: false, rest: true },
            { day: "F", label: "Push", done: false, active: true },
            { day: "S", label: "Run", done: false },
            { day: "S", label: "Rest", done: false, rest: true },
          ].map((d, i) => (
            <div
              key={i}
              className={`flex-1 rounded-xl p-1.5 text-center ${
                d.active
                  ? "bg-orange-500/20 ring-1 ring-orange-500"
                  : d.done
                    ? "bg-zinc-800"
                    : "bg-zinc-900"
              }`}
            >
              <p className="text-[8px] text-zinc-500">{d.day}</p>
              <p className={`text-[9px] font-medium ${d.done ? "text-green-400" : d.active ? "text-orange-400" : d.rest ? "text-zinc-600" : "text-zinc-400"}`}>
                {d.label}
              </p>
              {d.done && (
                <div className="mx-auto mt-0.5 h-1 w-1 rounded-full bg-green-400" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Calories", value: "1,847", sub: "/ 2,400" },
          { label: "Sleep", value: "6.5h", sub: "HRV 42" },
          { label: "Weight", value: "183", sub: "-0.4 lb" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl bg-zinc-800/60 p-2.5">
            <p className="text-[8px] text-zinc-500">{s.label}</p>
            <p className="text-sm font-bold">{s.value}</p>
            <p className="text-[8px] text-zinc-500">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 pt-1">
        <div className="flex-1 rounded-xl bg-zinc-800 p-2.5 text-center">
          <p className="text-[9px] font-medium text-zinc-400">Chat with Coach</p>
        </div>
        <div className="flex-1 rounded-xl bg-zinc-800 p-2.5 text-center">
          <p className="text-[9px] font-medium text-zinc-400">View Plan</p>
        </div>
      </div>
    </div>
  );
}

export function ChatScreen() {
  return (
    <div className="w-full space-y-3 p-4 pt-10 text-white">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold">H</div>
        <p className="text-sm font-semibold">Hybro Coach</p>
      </div>

      {/* Chat Messages */}
      <div className="space-y-2.5">
        <div className="rounded-2xl rounded-tl-sm bg-zinc-800 p-3">
          <p className="text-[10px] text-zinc-300">What should I eat for dinner? I&apos;m trying to hit my protein.</p>
        </div>
        <div className="rounded-2xl rounded-tr-sm bg-orange-500/15 p-3">
          <p className="text-[10px] text-orange-100">
            You have 82g protein left today. Here are 3 options:
          </p>
          <div className="mt-2 space-y-1.5">
            {[
              "8oz chicken breast + rice + broccoli (52g P)",
              "Salmon bowl with quinoa + avocado (48g P)",
              "Greek yogurt parfait + protein shake (55g P)",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                <p className="text-[9px] text-zinc-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-zinc-800 p-3">
          <p className="text-[10px] text-zinc-300">Should I train today? I feel beat up.</p>
        </div>
        <div className="rounded-2xl rounded-tr-sm bg-orange-500/15 p-3">
          <p className="text-[10px] text-orange-100">
            Your HRV dropped to 28 last night and you only slept 5.5h. I&apos;d skip today and rest. You&apos;ve hit 4/5 sessions this week already.
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2">
        <div className="flex-1 rounded-full bg-zinc-800 px-3 py-2">
          <p className="text-[9px] text-zinc-600">Ask your coach...</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
        </div>
      </div>
    </div>
  );
}
