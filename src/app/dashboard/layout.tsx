import "@/components/app/tokens.css";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { getSubscriptionStatus } from "@/lib/subscription";
import { AppShell } from "@/components/app/shell-client";
import { ChatProvider } from "@/components/chat/chat-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (userId) {
    const supabase = createServerClient();
    const { data: user } = await supabase
      .from("users")
      .select("onboarding_completed")
      .eq("id", userId)
      .single();

    if (!user || !user.onboarding_completed) {
      redirect("/onboarding");
    }

    const subscription = await getSubscriptionStatus(userId);
    if (!subscription.active) {
      const headersList = await headers();
      const pathname = headersList.get("x-pathname") || "";
      if (!pathname.includes("/settings")) {
        redirect("/dashboard/settings?expired=true");
      }
    }
  }

  return (
    <ChatProvider>
      <AppShell>{children}</AppShell>
    </ChatProvider>
  );
}
