import "@/components/app/tokens.css";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
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
  }

  return (
    <ChatProvider>
      <AppShell>{children}</AppShell>
    </ChatProvider>
  );
}
