import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  "https://jtvftxnlkjfpljfxyitx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dmZ0eG5sa2pmcGxqZnh5aXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTY4NTgsImV4cCI6MjA3MjI5Mjg1OH0.VC7_Ke3059o00KDXjddxYA5ZlZ6Et88GnWGCc8Ge7EM"
);