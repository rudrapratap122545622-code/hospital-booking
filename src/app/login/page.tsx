"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/reception";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
            <div className="h-2.5 w-2.5 rounded-full bg-accent" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Clinic team access only. Patients don't need an account.
          </p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
            {error && (
              <div className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/book" className="text-accent-soft hover:underline">
            Book as a patient
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
