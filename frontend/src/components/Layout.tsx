import Dock from "./Dock";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      <main className="flex-1 pb-20 overflow-y-auto">{children}</main>
      <Dock />
    </div>
  );
}
