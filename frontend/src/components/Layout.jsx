import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* pt-[52px] = header mobile với search; pb-16 = bottom tab */}
      <main className="flex-1 overflow-auto pt-[52px] pb-20 md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  );
}
