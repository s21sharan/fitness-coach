import "@/components/app/tokens.css";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div style={{ minHeight: "100vh" }}>{children}</div>;
}
