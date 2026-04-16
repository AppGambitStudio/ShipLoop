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

  // Hide nav on login page
  if (!loggedIn || pathname === "/login") return null;

  const handleLogout = () => {
    localStorage.removeItem("shiploop_token");
    router.push("/login");
  };

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors ${
        pathname === href ? "text-cyan-400" : "text-gray-400 hover:text-gray-200"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="border-b border-white/5 bg-[#0d0d12]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/dump" className="text-lg font-bold tracking-tight">
          <span className="text-cyan-400">Ship</span>
          <span className="text-purple-400">Loop</span>
        </Link>

        <div className="flex items-center gap-6">
          {navLink("/dump", "Brain Dump")}
          {navLink("/queue", "Queue")}
          {navLink("/assets", "Assets")}
          {navLink("/voice", "Voice")}
          {navLink("/strategist", "Strategist")}
          {navLink("/onboard", "Settings")}
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
