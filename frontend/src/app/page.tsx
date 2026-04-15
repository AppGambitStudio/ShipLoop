"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("shiploop_token");
    router.replace(token ? "/dump" : "/login");
  }, [router]);

  return null;
}
