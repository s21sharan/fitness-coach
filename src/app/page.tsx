import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Hybro</h1>
      <p className="text-lg text-gray-600 max-w-md text-center">
        AI-powered coaching that connects your nutrition, training, cardio, and
        recovery data.
      </p>
      <div className="flex gap-4">
        <Link
          href="/sign-up"
          className="rounded-lg bg-black px-6 py-3 text-white font-medium hover:bg-gray-800"
        >
          Get Started
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
        >
          Sign In
        </Link>
      </div>
    </main>
  );
}
