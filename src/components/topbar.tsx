import { UserButton } from "@clerk/nextjs";

export function Topbar() {
  return (
    <header className="flex h-14 items-center justify-end border-b bg-white px-6">
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
