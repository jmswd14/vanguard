// ── MOTHERBOARD THEME ─────────────────────────────────────────────────────────
// Retro Terminal is the only theme.
// This file manages the two user-configurable colors (Color 1 / Color 2).

window.VG_THEME = {

  applyRetroColors: function(c1, c2) {
    const el = document.documentElement;
    el.style.setProperty('--retro-c1', c1);
    el.style.setProperty('--retro-c2', c2);
    localStorage.setItem('vg-retro-c1', c1);
    localStorage.setItem('vg-retro-c2', c2);
  },

  sync: async function() {
    const client = window.supabaseClient;
    if (!client) return;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    const { data } = await client
      .from('user_preferences')
      .select('key,value')
      .eq('user_id', user.id)
      .in('key', ['retro_color1', 'retro_color2']);
    if (!data) return;
    const prefs = {};
    data.forEach(function(r) { prefs[r.key] = r.value; });
    if (prefs.retro_color1) localStorage.setItem('vg-retro-c1', prefs.retro_color1);
    if (prefs.retro_color2) localStorage.setItem('vg-retro-c2', prefs.retro_color2);
    const c1 = localStorage.getItem('vg-retro-c1') || '#00FF41';
    const c2 = localStorage.getItem('vg-retro-c2') || '#FF6600';
    this.applyRetroColors(c1, c2);
  },

};

document.addEventListener('DOMContentLoaded', function() {
  const c1 = localStorage.getItem('vg-retro-c1') || '#00FF41';
  const c2 = localStorage.getItem('vg-retro-c2') || '#FF6600';
  VG_THEME.applyRetroColors(c1, c2);
});
