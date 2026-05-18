const url = "https://nzucpacdzzjzoeyyzban.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dWNwYWNkenpqem9leXl6YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDcwMjAsImV4cCI6MjA5NDEyMzAyMH0.cYqU3jCAYyumQRyRVaGXGCQYwX9OF7IuQvOrTOfm0PY";

async function inspectProfiles() {
  try {
    const res = await fetch(`${url}/rest/v1/profiles?limit=1`, {
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
      }
    });
    console.log("Profiles sample:", await res.json());
  } catch (err) {
    console.error("Error inspecting profiles:", err.message);
  }
}

inspectProfiles();
