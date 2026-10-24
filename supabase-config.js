(() => {
  "use strict";

  const DEFAULT_SUPABASE_URL = "https://cbvkxqokqsuwywkpzvuq.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_N1k0kUllTRgzc0lWXYbopQ_LTUrswsT";

  // Accessible environment configuration block
  window.ENV = Object.assign(window.ENV || {}, {
    SUPABASE_URL: window.ENV?.SUPABASE_URL || DEFAULT_SUPABASE_URL,
    SUPABASE_ANON_KEY: window.ENV?.SUPABASE_ANON_KEY || window.ENV?.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_ANON_KEY,
    SUPABASE_PUBLISHABLE_KEY: window.ENV?.SUPABASE_PUBLISHABLE_KEY || window.ENV?.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  });

  const config = Object.freeze({
    url: window.ENV.SUPABASE_URL,
    publishableKey: window.ENV.SUPABASE_ANON_KEY,
    anonKey: window.ENV.SUPABASE_ANON_KEY,
    organizationName: "MK97 ERP",
    organizationSlug: "mk97-erp"
  });

  window.MK97_SUPABASE_CONFIG = config;
  window.STARK_SUPABASE_CONFIG = config;
})();
