import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-5 text-center">
      <div className="mx-auto max-w-md">
        {/* Soft sky blue icon circle */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7FBCDF]/20">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7FBCDF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="12" />
            <line x1="11" y1="16" x2="11.01" y2="16" />
          </svg>
        </div>
        
        <h1 className="text-4xl font-semibold tracking-tight text-[#0F2A3F]">
          Page not found
        </h1>
        <p className="mt-3 text-[#5C7A8F]">
          We couldn't find the page you're looking for. It might have been moved, deleted, or never existed.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {/* Main CTA uses your Sky Blue */}
          <Link href="/">
            <Button className="bg-[#7FBCDF] text-white hover:bg-[#5DA5D1]">
              Go to booking page
            </Button>
          </Link>
          
          {/* Secondary CTA uses your Cream/Warm tone */}
          <Link href="/login">
            <Button variant="ghost" className="border-[#DCD3CE] bg-[#DCD3CE]/30 text-[#3B2E28] hover:bg-[#DCD3CE]">
              Staff sign in
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}