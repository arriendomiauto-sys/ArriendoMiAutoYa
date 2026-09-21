import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rgxiyidijtoazcrmijly.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJneGl5aWRpanRvYXpjcm1pamx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNzkyNzIsImV4cCI6MjEwMjY1NTI3Mn0.CkLZA7coBk9lvngokZNpbHik6ESGTDWvLOKq2opMVqc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
});
