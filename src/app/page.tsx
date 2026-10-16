"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/book");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <p className="text-sm text-muted">Loading ClinicFlow…</p>
    </div>
  );
}