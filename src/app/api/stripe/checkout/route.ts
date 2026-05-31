import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  const { returnUrl, includeTrial } = await req.json().catch(() => ({
    returnUrl: "/dashboard",
    includeTrial: true,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    ...(includeTrial ? { subscription_data: { trial_period_days: 3 } } : {}),
    customer_email: email ?? undefined,
    metadata: { user_id: userId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${returnUrl}?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${returnUrl}?checkout=canceled`,
  });

  return NextResponse.json({ url: session.url });
}
