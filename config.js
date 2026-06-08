const SUPABASE_URL = 'https://neensjugjhkvwcqslicr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lZW5zanVnamhrdndjcXNsaWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5Mjg1NzQsImV4cCI6MjA4MTUwNDU3NH0.eDEhhT8HzetCntUZ2LYkZhtoUjSjmFxPQqm03aAL8tU';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});
