import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 1. Browser Client (Stay the same)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// 2. Server Client (Updated to be Async)
export async function createServerSupabaseClient() {
  // CRITICAL: Next.js 15 requires awaiting cookies()
  const cookieStore = await cookies(); 

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Usually ignored if called from a Server Component
          }
        },
      },
    }
  );
}