"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("shiploop_token"));
  }, [pathname]);

  if (!loggedIn) return null;

  const handleLogout = () => {
    localStorage.removeItem("shiploop_token");
    router.push("/login");
  };

  return (
    <nav className="border-b border-white/5 bg-[#0d0d12]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/dump" className="text-lg font-bold tracking-tight">
          <span className="text-cyan-400">Ship</span>
          <span className="text-purple-400">Loop</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/dump"
            className={`text-sm font-medium transition-colors ${
              pathname === "/dump"
                ? "text-cyan-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Brain Dump
          </Link>
          <Link
            href="/queue"
            className={`text-sm font-medium transition-colors ${
              pathname === "/queue"
                ? "text-cyan-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Approval Queue
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
