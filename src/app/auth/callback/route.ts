import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/';

  /**
   * ARCHITECTURAL FIX: 
   * We redirect to '/' instead of '/login' because we don't have a login page.
   * This prevents the 404 error you were seeing.
   */
  if (errorDescription) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(errorDescription)}`);
  }

  if (code) {
    const cookieStore = await cookies();
    
    // We check if keys exist to avoid crashing the server if Vercel hasn't picked them up yet
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
       console.error("CRITICAL: Supabase Environment Variables are missing in production.");
       return NextResponse.redirect(`${origin}/?error=missing_env_vars`);
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Success! Send them to the lobby or whatever 'next' is.
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error("Auth Callback Error:", error.message);
      // Redirect to home page with the actual error message
      return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error.message)}`);
    }
  }

  // Fallback if no code is present
  return NextResponse.redirect(`${origin}/?error=no-code-provided`);
}