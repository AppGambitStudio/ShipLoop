"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("shiploop_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    // Check if config exists — new users go to onboard
    api.config.get()
      .then((config) => {
        router.replace(config ? "/dump" : "/onboard");
      })
      .catch(() => {
        router.replace("/onboard");
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  );
}
