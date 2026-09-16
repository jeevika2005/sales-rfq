import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        {/* We can pass dynamic titles to Header via context or state later, 
            for now we use a default or handle it per page if needed, 
            but usually layouts wrap the page. Let's just put a static placeholder
            that pages can override or we rely on the page to render its own header.
            Actually, the PRD puts the Header in the layout. 
            We'll put a generic one here for Phase 0. */}
        <Header title="Dashboard" subtitle="Overview and analytics" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
