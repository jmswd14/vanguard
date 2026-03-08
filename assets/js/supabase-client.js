// Supabase client — shared across all pages.
// The anon key is intentionally public: Row Level Security policies
// in Supabase ensure each user can only access their own data.
const SUPABASE_URL = 'https://znhwyzgccojbjaivzllp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_w1kQscDakbxA_xPoqza5tQ_iFoG-6pl';

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
