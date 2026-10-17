(function () {
  'use strict';

  const S = window.StarkSystem;
  if (!S) return;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => new Intl.NumberFormat('en-US').format(Number(n) || 0);
  const money = (n, cur = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(Number(n) || 0);

  function formatDate(iso) {
    if (!iso) return 'Today at ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  // State & Filter Variables
  const params = new URLSearchParams(location.search);
  let query = params.get('search') || '';
  let selectedBrand = params.get('brand') || 'all';
  let selectedStatus = params.get('status') || 'all';
  let selectedWarehouse = params.get('warehouse') || 'all';
  let minPrice = params.get('minPrice') || '';
  let maxPrice = params.get('maxPrice') || '';
  let priceTier = params.get('tier') || 'all';
  let sortBy = params.get('sort') || 'model-asc';
  let viewMode = params.get('view') || 'cards'; // Enhanced 4-column card view
  let activeMenuSku = null;

  // Cache initial action and immediately sanitize URL so refreshing never re-triggers modals
  const initialAction = params.get('action');
  const initialActionBrand = params.get('brand') || '';
  if (params.has('action')) {
    try {
      const cleanParams = new URLSearchParams(location.search);
      cleanParams.delete('action');
      const cleanSearch = cleanParams.toString();
      const cleanUrl = location.pathname + (cleanSearch ? '?' + cleanSearch : '') + location.hash;
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, document.title, cleanUrl);
      }
    } catch (err) {}
  }

  function notice(message, error = false) {
    if (window.StarkSystemUI?.notice) {
      window.StarkSystemUI.notice(message, error);
    } else {
      const toast = document.createElement('div');
      toast.className = 'system-toast' + (error ? ' error' : '');
      toast.textContent = message;
      document.body.append(toast);
      setTimeout(() => toast.remove(), 4000);
    }
  }

  // =========================================================================
  // VECTOR PRODUCT ILLUSTRATIONS
  // =========================================================================
  const productSVGs = {
    // 1. Sony WH-1000XM5
    'SONY-1000XM5': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 75 C40 28, 120 28, 120 75" stroke="#1e293b" stroke-width="9" stroke-linecap="round"/>
      <path d="M48 68 C48 34, 112 34, 112 68" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
      <rect x="36" y="66" width="7" height="18" rx="2" fill="#64748b"/>
      <rect x="117" y="66" width="7" height="18" rx="2" fill="#64748b"/>
      <g transform="translate(25, 68) rotate(6)">
        <ellipse cx="14" cy="24" rx="14" ry="24" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
        <ellipse cx="17" cy="24" rx="9" ry="18" fill="#334155"/>
        <circle cx="14" cy="14" r="2.5" fill="#94a3b8"/>
      </g>
      <g transform="translate(107, 70) rotate(-6)">
        <ellipse cx="14" cy="24" rx="14" ry="24" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
        <ellipse cx="11" cy="24" rx="9" ry="18" fill="#334155"/>
        <circle cx="14" cy="14" r="2.5" fill="#94a3b8"/>
      </g>
    </svg>`,

    // 2. New Balance 550
    'NB-550': `<svg viewBox="0 0 170 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="85" cy="116" rx="64" ry="6" fill="#e2e8f0"/>
      <path d="M26 104 C35 110, 138 112, 148 102 C149 98, 147 96, 142 96 L28 96 C24 96, 23 99, 26 104 Z" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
      <path d="M28 96 L142 96 C145 92, 144 86, 138 84 L114 84 L102 74 L78 74 L60 84 L34 84 C28 86, 26 92, 28 96 Z" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
      <path d="M34 84 C38 78, 54 74, 76 74 C90 74, 102 62, 114 62 C124 62, 136 72, 138 84 Z" fill="#fdfbf7" stroke="#e2d9cc" stroke-width="1.5"/>
      <path d="M114 62 C116 56, 126 56, 130 62 L138 84 L122 84 Z" fill="#e7ded3"/>
      <circle cx="44" cy="81" r="1" fill="#cbd5e1"/><circle cx="48" cy="80" r="1" fill="#cbd5e1"/><circle cx="52" cy="81" r="1" fill="#cbd5e1"/>
      <path d="M84 76 L92 76 L102 88 L94 88 Z" fill="#94a3b8"/>
      <path d="M82 76 L86 76 L86 88 L82 88 Z" fill="#cbd5e1"/>
      <path d="M98 76 L102 76 L102 88 L98 88 Z" fill="#cbd5e1"/>
      <line x1="72" y1="74" x2="84" y2="72" stroke="#e2d9cc" stroke-width="2"/>
      <line x1="76" y1="70" x2="88" y2="68" stroke="#e2d9cc" stroke-width="2"/>
    </svg>`,

    // 3. YETI Rambler 40oz
    'YETI-40': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="78" y="14" width="4" height="28" rx="1.5" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
      <rect x="58" y="38" width="44" height="8" rx="2" fill="#cbd5e1"/>
      <rect x="62" y="34" width="36" height="5" rx="1" fill="#94a3b8" opacity="0.4"/>
      <rect x="58" y="46" width="44" height="4" fill="#94a3b8"/>
      <path d="M60 50 L100 50 L95 90 L91 90 L89 122 L71 122 L69 90 L65 90 Z" fill="#faf7f2" stroke="#d6cbbe" stroke-width="1.5"/>
      <path d="M100 56 C114 56, 115 84, 96 86" stroke="#e8dfd1" stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M100 56 C114 56, 115 84, 96 86" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <rect x="71" y="122" width="18" height="4" rx="1" fill="#94a3b8"/>
    </svg>`,

    // 4. Bose SoundLink Flex
    'BOSE-FLEX': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="46" width="96" height="46" rx="23" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
      <rect x="42" y="52" width="72" height="34" rx="17" fill="#0f172a"/>
      <g fill="#475569">
        <circle cx="56" cy="62" r="1.5"/><circle cx="64" cy="62" r="1.5"/><circle cx="72" cy="62" r="1.5"/><circle cx="80" cy="62" r="1.5"/><circle cx="88" cy="62" r="1.5"/><circle cx="96" cy="62" r="1.5"/><circle cx="104" cy="62" r="1.5"/>
        <circle cx="52" cy="69" r="1.5"/><circle cx="60" cy="69" r="1.5"/><circle cx="68" cy="69" r="1.5"/><circle cx="76" cy="69" r="1.5"/><circle cx="84" cy="69" r="1.5"/><circle cx="92" cy="69" r="1.5"/><circle cx="100" cy="69" r="1.5"/><circle cx="108" cy="69" r="1.5"/>
        <circle cx="56" cy="76" r="1.5"/><circle cx="64" cy="76" r="1.5"/><circle cx="72" cy="76" r="1.5"/><circle cx="80" cy="76" r="1.5"/><circle cx="88" cy="76" r="1.5"/><circle cx="96" cy="76" r="1.5"/><circle cx="104" cy="76" r="1.5"/>
      </g>
      <path d="M125 61 C134 61, 134 77, 125 77" stroke="#475569" stroke-width="4" stroke-linecap="round" fill="none"/>
      <rect x="72" y="68" width="16" height="3" rx="1" fill="#e2e8f0"/>
    </svg>`,

    // 5. Ray-Ban Wayfarer
    'RB-2140': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M34 62 L18 52" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>
      <path d="M126 62 L142 52" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>
      <path d="M26 60 C32 58, 66 56, 74 62 C76 64, 84 64, 86 62 C94 56, 128 58, 134 60 C138 66, 132 88, 114 90 C96 92, 92 78, 88 78 C84 78, 80 92, 62 90 C44 88, 22 66, 26 60 Z" fill="#0f172a"/>
      <path d="M34 63 C40 62, 66 61, 71 65 C72 73, 68 85, 57 85 C43 85, 32 75, 34 63 Z" fill="#092825"/>
      <path d="M40 65 L48 82" stroke="#14b8a6" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
      <path d="M89 65 C94 61, 120 62, 126 63 C128 75, 117 85, 103 85 C92 85, 88 73, 89 65 Z" fill="#092825"/>
      <path d="M96 65 L104 82" stroke="#14b8a6" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
      <ellipse cx="29" cy="62" rx="1.5" ry="1" fill="#e2e8f0"/><ellipse cx="131" cy="62" rx="1.5" ry="1" fill="#e2e8f0"/>
    </svg>`,

    // 6. Apple AirPods Pro 2
    'AP-PRO2': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="52" y="66" width="56" height="48" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
      <circle cx="80" cy="84" r="2" fill="#10b981"/>
      <path d="M54 66 C54 52, 106 52, 106 66 Z" fill="#cbd5e1"/>
      <g transform="translate(62, 42)">
        <ellipse cx="8" cy="12" rx="7" ry="9" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
        <rect x="6" y="18" width="4" height="18" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
        <ellipse cx="4" cy="10" rx="3" ry="5" fill="#f1f5f9"/><circle cx="8" cy="8" r="1.5" fill="#475569"/>
      </g>
      <g transform="translate(84, 42)">
        <ellipse cx="6" cy="12" rx="7" ry="9" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
        <rect x="4" y="18" width="4" height="18" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
        <ellipse cx="10" cy="10" rx="3" ry="5" fill="#f1f5f9"/><circle cx="6" cy="8" r="1.5" fill="#475569"/>
      </g>
    </svg>`,

    // 7. Nike Brasilia Backpack
    'NK-BRAS': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 36 C42 48, 40 92, 46 112" stroke="#334155" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M110 36 C118 48, 120 92, 114 112" stroke="#334155" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M52 42 C52 28, 108 28, 108 42 L112 110 C112 116, 106 120, 100 120 L60 120 C54 120, 48 116, 48 110 Z" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
      <path d="M54 78 C54 72, 106 72, 106 78 L108 114 C108 118, 104 120, 98 120 L62 120 C56 120, 52 118, 52 114 Z" fill="#1e293b"/>
      <path d="M55 76 C55 74, 105 74, 105 76" stroke="#475569" stroke-width="2"/>
      <path d="M66 94 C76 96, 92 88, 98 80 C95 86, 85 99, 72 99 C66 99, 63 96, 66 94 Z" fill="#ffffff"/>
      <path d="M72 30 C72 24, 88 24, 88 30" stroke="#475569" stroke-width="3" fill="none"/>
    </svg>`,

    // 8. Bogg Bag Original
    'BOGG-ORIG': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M58 72 C58 24, 102 24, 102 72" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M58 72 C58 24, 102 24, 102 72" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <path d="M42 56 L118 56 L114 114 C114 118, 110 120, 106 120 L54 120 C50 120, 46 118, 46 114 Z" fill="#7dd3fc" stroke="#38bdf8" stroke-width="2"/>
      <g fill="#0284c7" opacity="0.7">
        <ellipse cx="54" cy="68" rx="2.5" ry="3.5"/><ellipse cx="64" cy="68" rx="2.5" ry="3.5"/><ellipse cx="74" cy="68" rx="2.5" ry="3.5"/><ellipse cx="84" cy="68" rx="2.5" ry="3.5"/><ellipse cx="94" cy="68" rx="2.5" ry="3.5"/><ellipse cx="104" cy="68" rx="2.5" ry="3.5"/>
        <ellipse cx="54" cy="80" rx="2.5" ry="3.5"/><ellipse cx="64" cy="80" rx="2.5" ry="3.5"/><ellipse cx="74" cy="80" rx="2.5" ry="3.5"/><ellipse cx="84" cy="80" rx="2.5" ry="3.5"/><ellipse cx="94" cy="80" rx="2.5" ry="3.5"/><ellipse cx="104" cy="80" rx="2.5" ry="3.5"/>
        <ellipse cx="54" cy="92" rx="2.5" ry="3.5"/><ellipse cx="64" cy="92" rx="2.5" ry="3.5"/><ellipse cx="74" cy="92" rx="2.5" ry="3.5"/><ellipse cx="84" cy="92" rx="2.5" ry="3.5"/><ellipse cx="94" cy="92" rx="2.5" ry="3.5"/><ellipse cx="104" cy="92" rx="2.5" ry="3.5"/>
      </g>
      <circle cx="58" cy="72" r="3.5" fill="#ffffff" stroke="#38bdf8" stroke-width="1.5"/>
      <circle cx="102" cy="72" r="3.5" fill="#ffffff" stroke="#38bdf8" stroke-width="1.5"/>
    </svg>`,

    // 9. Stanley Quencher 40oz
    'STAN-40': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="78" y="12" width="4" height="28" rx="1.5" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
      <rect x="58" y="36" width="44" height="6" rx="2" fill="#d1d5db"/>
      <rect x="60" y="42" width="40" height="4" fill="#9ca3af"/>
      <path d="M61 46 L99 46 L95 86 L91 86 L88 122 L72 122 L69 86 L65 86 Z" fill="#698b77" stroke="#3f5849" stroke-width="1.5"/>
      <path d="M60 52 C44 52, 44 86, 64 88" stroke="#476353" stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M60 52 C44 52, 44 86, 64 88" stroke="#e5e7eb" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <rect x="72" y="122" width="16" height="4" rx="1" fill="#9ca3af"/>
    </svg>`,

    // 10. Kendra Scott Elisa
    'KS-ELISA': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M42 24 C44 68, 62 94, 80 94 C98 94, 116 68, 118 24" stroke="#d97706" stroke-width="1.8" stroke-dasharray="3 1.5" fill="none"/>
      <ellipse cx="80" cy="94" rx="16" ry="10" fill="#b45309" stroke="#f59e0b" stroke-width="2"/>
      <ellipse cx="80" cy="94" rx="13" ry="7.5" fill="#fef08a"/>
      <path d="M74 92 L86 92 M76 95 L84 95" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.8"/>
    </svg>`,

    // 11. Solo Stove Bonfire 2.0
    'SOLO-BON2': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="80" cy="52" rx="36" ry="9" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5"/>
      <ellipse cx="80" cy="52" rx="26" ry="6" fill="#1e293b"/>
      <path d="M44 52 L116 52 L116 106 C116 112, 44 112, 44 106 Z" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>
      <circle cx="52" cy="100" r="2" fill="#1e293b"/><circle cx="64" cy="101" r="2" fill="#1e293b"/><circle cx="76" cy="102" r="2" fill="#1e293b"/><circle cx="88" cy="102" r="2" fill="#1e293b"/><circle cx="100" cy="101" r="2" fill="#1e293b"/>
      <ellipse cx="80" cy="110" rx="34" ry="7" fill="none" stroke="#64748b" stroke-width="2"/>
    </svg>`,

    // 12. Dyson Supersonic
    'DYS-SONIC': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="73" y="64" width="14" height="54" rx="7" fill="#475569" stroke="#334155" stroke-width="1.5"/>
      <rect x="77" y="118" width="6" height="8" rx="2" fill="#1e293b"/>
      <rect x="52" y="38" width="46" height="28" rx="6" fill="#64748b"/>
      <ellipse cx="52" cy="52" rx="4" ry="14" fill="#d946ef" stroke="#c026d3" stroke-width="1.5"/>
      <ellipse cx="52" cy="52" rx="1.5" ry="6" fill="#1e293b"/>
      <ellipse cx="98" cy="52" rx="4" ry="14" fill="#d946ef"/>
    </svg>`,

    // 13. Garmin Forerunner 265
    'GAR-FR265': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M68 20 L92 20 L90 50 L70 50 Z" fill="#1e293b"/><path d="M70 90 L90 90 L92 124 L68 124 Z" fill="#1e293b"/>
      <circle cx="80" cy="70" r="28" fill="#0f172a" stroke="#334155" stroke-width="2.5"/>
      <circle cx="80" cy="70" r="23" fill="#090d16"/>
      <circle cx="80" cy="70" r="20" stroke="#06b6d4" stroke-width="2" stroke-dasharray="80 30" fill="none"/>
      <text x="80" y="74" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="700" font-family="system-ui,sans-serif">10:24</text>
    </svg>`,

    // 14. Theragun Prime
    'THERA-PRM': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M64 42 C74 34, 102 34, 114 46 C124 58, 116 88, 104 96 L76 96 C64 96, 52 82, 54 68 Z" fill="#0f172a" stroke="#1e293b" stroke-width="3"/>
      <path d="M78 54 C82 50, 96 50, 100 56 C104 62, 100 78, 94 82 L84 82 C78 82, 74 74, 76 66 Z" fill="#ffffff"/>
      <rect x="38" y="74" width="22" height="10" rx="3" fill="#334155"/>
      <circle cx="34" cy="79" r="9" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
    </svg>`,

    // 15. FieldBar Cooler
    'FB-COOLER': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M64 46 C64 30, 96 30, 96 46" stroke="#b45309" stroke-width="4.5" stroke-linecap="round" fill="none"/>
      <rect x="46" y="52" width="68" height="62" rx="8" fill="#a7f3d0" stroke="#059669" stroke-width="2"/>
      <line x1="46" y1="68" x2="114" y2="68" stroke="#047857" stroke-width="2"/>
      <rect x="76" y="62" width="8" height="14" rx="2" fill="#e2e8f0" stroke="#64748b" stroke-width="1"/>
    </svg>`,

    // 16. Aura Carver Frame
    'AURA-CRV': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="34" y="38" width="92" height="68" rx="6" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
      <rect x="44" y="46" width="72" height="52" rx="2" fill="#f8fafc"/>
      <rect x="50" y="52" width="60" height="40" fill="#38bdf8"/>
      <polygon points="50,92 68,76 80,86 94,70 110,92" fill="#0f172a" opacity="0.6"/>
    </svg>`,

    // 17. OluKai Ohana Sandal
    'OLU-OHANA': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 40 C60 26, 92 26, 96 46 C98 64, 94 96, 92 114 C90 120, 66 120, 64 114 C62 96, 60 62, 60 40 Z" fill="#78350f" stroke="#451a03" stroke-width="2"/>
      <path d="M62 68 C72 62, 77 48, 77 44" stroke="#92400e" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M94 68 C84 62, 79 48, 79 44" stroke="#92400e" stroke-width="4.5" stroke-linecap="round"/>
    </svg>`,

    // 18. Lululemon Everywhere Belt Bag
    'LULU-EBB': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M30 64 L50 66 M110 66 L130 64" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
      <rect x="46" y="52" width="68" height="42" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
      <path d="M52 60 C66 58, 94 58, 108 60" stroke="#475569" stroke-width="2"/>
      <circle cx="104" cy="84" r="3" fill="#cbd5e1"/>
    </svg>`,

    // 19. Audio-Technica ATH-M50x
    'ATH-M50X': `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M42 74 C42 28, 118 28, 118 74" stroke="#1e293b" stroke-width="9" stroke-linecap="round"/>
      <circle cx="38" cy="84" r="17" fill="#0f172a" stroke="#cbd5e1" stroke-width="2"/>
      <circle cx="38" cy="84" r="9" fill="#1e293b" stroke="#94a3b8" stroke-width="1.5"/>
      <circle cx="122" cy="84" r="17" fill="#0f172a" stroke="#cbd5e1" stroke-width="2"/>
      <circle cx="122" cy="84" r="9" fill="#1e293b" stroke="#94a3b8" stroke-width="1.5"/>
    </svg>`
  };

  const fallbackProductSVG = `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="45" y="38" width="70" height="64" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
    <path d="M60 70 L72 58 L85 72 L95 62 L105 76" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="68" cy="52" r="4" fill="#cbd5e1"/>
  </svg>`;

  // =========================================================================
  // ENTERPRISE MASTER CATALOG DATASET (19 ITEMS MATCHING SCREENSHOT)
  // =========================================================================
  const defaultMasterCatalog = [
    {
      sku: 'SONY-1000XM5',
      model: 'WH-1000XM5',
      brand: 'Sony',
      title: 'Sony WH-1000XM5',
      standardPrice: 349.00,
      cost: 278.00,
      status: 'Live',
      tags: ['Electronics', 'Audio'],
      onOrder: 120,
      poNumber: 'PO-38447',
      onHold: 12,
      totalATS: 212,
      uploadedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      uploadSource: 'Brand Feed · Sony EDI ATS',
      warehouses: [
        { name: 'Sarasota DC', ats: 124 },
        { name: 'Demo_3PL', ats: 56 },
        { name: 'TX DC', ats: 32 }
      ]
    },
    {
      sku: 'NB-550',
      model: 'NB-550',
      brand: 'New Balance',
      title: 'New Balance 550',
      standardPrice: 110.00,
      cost: 65.00,
      status: 'Live',
      tags: ['Footwear', 'Fashion'],
      onOrder: 100,
      poNumber: 'PO-38451',
      onHold: 8,
      totalATS: 86,
      uploadedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      uploadSource: 'Brand Feed · New Balance B2B',
      warehouses: [
        { name: 'Sarasota DC', ats: 40 },
        { name: 'Demo_3PL', ats: 30 },
        { name: 'NY DC', ats: 16 }
      ]
    },
    {
      sku: 'YETI-40',
      model: 'TMBLR-40',
      brand: 'YETI',
      title: 'YETI Rambler 40oz',
      standardPrice: 45.00,
      cost: 24.00,
      status: 'Live',
      tags: ['Drinkware', 'Lifestyle'],
      onOrder: 0,
      poNumber: 'PO: —',
      onHold: 20,
      totalATS: 142,
      uploadedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      uploadSource: 'Brand Feed · YETI Direct Stock',
      warehouses: [
        { name: 'Sarasota DC', ats: 68 },
        { name: 'FL DC', ats: 54 },
        { name: 'Demo_3PL', ats: 20 }
      ]
    },
    {
      sku: 'BOSE-FLEX',
      model: 'SL-FLEX',
      brand: 'Bose',
      title: 'Bose SoundLink Flex',
      standardPrice: 129.00,
      cost: 82.00,
      status: 'Live',
      tags: ['Electronics', 'Audio'],
      onOrder: 80,
      poNumber: 'PO-38462',
      onHold: 5,
      totalATS: 56,
      uploadedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      uploadSource: 'Brand Feed · Bose Partner Portal',
      warehouses: [
        { name: 'Sarasota DC', ats: 24 },
        { name: 'Demo_3PL', ats: 20 },
        { name: 'CA DC', ats: 12 }
      ]
    },
    {
      sku: 'RB-2140',
      model: 'RB-2140',
      brand: 'Ray-Ban',
      title: 'Ray-Ban Wayfarer',
      standardPrice: 155.00,
      cost: 88.00,
      status: 'Internal Use',
      tags: ['Accessories', 'Fashion'],
      onOrder: 50,
      poNumber: 'PO-38470',
      onHold: 10,
      totalATS: 12,
      uploadedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      uploadSource: 'Luxottica Master Price & ATS',
      warehouses: [
        { name: 'Sarasota DC', ats: 6 },
        { name: 'NY DC', ats: 4 },
        { name: 'Demo_3PL', ats: 2 }
      ]
    },
    {
      sku: 'AP-PRO2',
      model: 'AP-PRO2',
      brand: 'Apple',
      title: 'Apple AirPods Pro 2',
      standardPrice: 249.00,
      cost: 185.00,
      status: 'Live',
      tags: ['Electronics', 'Audio'],
      onOrder: 180,
      poNumber: 'PO-38472',
      onHold: 6,
      totalATS: 62,
      uploadedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      uploadSource: 'Apple B2B Direct Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 28 },
        { name: 'Demo_3PL', ats: 20 },
        { name: 'TX DC', ats: 14 }
      ]
    },
    {
      sku: 'NK-BRAS',
      model: 'NK-BRAS',
      brand: 'Nike',
      title: 'Nike Brasilia Backpack',
      standardPrice: 60.00,
      cost: 32.00,
      status: 'Live',
      tags: ['Bags', 'Sports'],
      onOrder: 100,
      poNumber: 'PO-38475',
      onHold: 4,
      totalATS: 48,
      uploadedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      uploadSource: 'Nike Equipment Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 26 },
        { name: 'Demo_3PL', ats: 14 },
        { name: 'NY DC', ats: 8 }
      ]
    },
    {
      sku: 'BOGG-ORIG',
      model: 'BOGG-ORIG',
      brand: 'Bogg Bag',
      title: 'Bogg Bag Original',
      standardPrice: 90.00,
      cost: 45.00,
      status: 'Presentation',
      tags: ['Accessories', 'Lifestyle'],
      onOrder: 400,
      poNumber: 'PO-38488',
      onHold: 0,
      totalATS: 104,
      uploadedAt: new Date(Date.now() - 3600000 * 7).toISOString(),
      uploadSource: 'Bogg Direct Brand Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 80 },
        { name: 'FL DC', ats: 18 },
        { name: 'Demo_3PL', ats: 6 }
      ]
    },
    {
      sku: 'STAN-40',
      model: 'STAN-40',
      brand: 'Stanley',
      title: 'Stanley Quencher 40oz',
      standardPrice: 45.00,
      cost: 22.00,
      status: 'Presentation',
      tags: ['Drinkware', 'Lifestyle'],
      onOrder: 150,
      poNumber: 'PO-38491',
      onHold: 0,
      totalATS: 0,
      uploadedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
      uploadSource: 'PMI Worldwide Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 0 },
        { name: 'Demo_3PL', ats: 0 },
        { name: 'FL DC', ats: 0 }
      ]
    },
    {
      sku: 'KS-ELISA',
      model: 'KS-ELISA',
      brand: 'Kendra Scott',
      title: 'Kendra Scott Elisa',
      standardPrice: 98.00,
      cost: 48.00,
      status: 'Internal Use',
      tags: ['Jewelry', 'Fashion'],
      onOrder: 40,
      poNumber: 'PO-38495',
      onHold: 5,
      totalATS: 28,
      uploadedAt: new Date(Date.now() - 3600000 * 14).toISOString(),
      uploadSource: 'Kendra Scott Wholesale Desk',
      warehouses: [
        { name: 'Sarasota DC', ats: 16 },
        { name: 'Demo_3PL', ats: 8 },
        { name: 'NY DC', ats: 4 }
      ]
    },
    {
      sku: 'SOLO-BON2',
      model: 'SOLO-BON2',
      brand: 'Solo Stove',
      title: 'Solo Stove Bonfire 2.0',
      standardPrice: 299.00,
      cost: 195.00,
      status: 'Live',
      tags: ['Outdoors', 'Lifestyle'],
      onOrder: 60,
      poNumber: 'PO-38501',
      onHold: 8,
      totalATS: 32,
      uploadedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
      uploadSource: 'Solo Stove EDI Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 20 },
        { name: 'Demo_3PL', ats: 8 },
        { name: 'TX DC', ats: 4 }
      ]
    },
    {
      sku: 'DYS-SONIC',
      model: 'DYS-SONIC',
      brand: 'Dyson',
      title: 'Dyson Supersonic',
      standardPrice: 429.00,
      cost: 310.00,
      status: 'Live',
      tags: ['Beauty', 'Appliances'],
      onOrder: 30,
      poNumber: 'PO-38505',
      onHold: 4,
      totalATS: 18,
      uploadedAt: new Date(Date.now() - 3600000 * 16).toISOString(),
      uploadSource: 'Dyson Commercial Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 10 },
        { name: 'Demo_3PL', ats: 6 },
        { name: 'NY DC', ats: 2 }
      ]
    },
    {
      sku: 'GAR-FR265',
      model: 'GAR-FR265',
      brand: 'Garmin',
      title: 'Garmin Forerunner 265',
      standardPrice: 449.00,
      cost: 320.00,
      status: 'Live',
      tags: ['Fitness', 'Electronics'],
      onOrder: 45,
      poNumber: 'PO-38510',
      onHold: 3,
      totalATS: 22,
      uploadedAt: new Date(Date.now() - 3600000 * 9).toISOString(),
      uploadSource: 'Garmin Direct Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 14 },
        { name: 'Demo_3PL', ats: 6 },
        { name: 'CA DC', ats: 2 }
      ]
    },
    {
      sku: 'THERA-PRM',
      model: 'THERA-PRM',
      brand: 'Therabody',
      title: 'Theragun Prime',
      standardPrice: 299.00,
      cost: 205.00,
      status: 'Live',
      tags: ['Wellness', 'Electronics'],
      onOrder: 50,
      poNumber: 'PO-38515',
      onHold: 5,
      totalATS: 35,
      uploadedAt: new Date(Date.now() - 3600000 * 11).toISOString(),
      uploadSource: 'Therabody Partner Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 20 },
        { name: 'Demo_3PL', ats: 10 },
        { name: 'FL DC', ats: 5 }
      ]
    },
    {
      sku: 'FB-COOLER',
      model: 'FB-COOLER',
      brand: 'FieldBar',
      title: 'FieldBar Cooler',
      standardPrice: 219.00,
      cost: 140.00,
      status: 'Live',
      tags: ['Outdoor', 'Lifestyle'],
      onOrder: 25,
      poNumber: 'PO-38520',
      onHold: 6,
      totalATS: 40,
      uploadedAt: new Date(Date.now() - 3600000 * 15).toISOString(),
      uploadSource: 'FieldBar Brand Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 25 },
        { name: 'Demo_3PL', ats: 10 },
        { name: 'CA DC', ats: 5 }
      ]
    },
    {
      sku: 'AURA-CRV',
      model: 'AURA-CRV',
      brand: 'Aura Frames',
      title: 'Aura Carver Frame',
      standardPrice: 149.00,
      cost: 126.00,
      status: 'Live',
      tags: ['Home', 'Electronics'],
      onOrder: 20,
      poNumber: 'PO-38525',
      onHold: 2,
      totalATS: 15,
      uploadedAt: new Date(Date.now() - 3600000 * 13).toISOString(),
      uploadSource: 'Aura Frames Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 8 },
        { name: 'Demo_3PL', ats: 5 },
        { name: 'NY DC', ats: 2 }
      ]
    },
    {
      sku: 'OLU-OHANA',
      model: 'OLU-OHANA',
      brand: 'OluKai',
      title: 'OluKai Ohana Sandal',
      standardPrice: 75.00,
      cost: 42.00,
      status: 'Live',
      tags: ['Footwear', 'Lifestyle'],
      onOrder: 80,
      poNumber: 'PO-38530',
      onHold: 10,
      totalATS: 70,
      uploadedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      uploadSource: 'OluKai Wholesale Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 45 },
        { name: 'Demo_3PL', ats: 15 },
        { name: 'FL DC', ats: 10 }
      ]
    },
    {
      sku: 'LULU-EBB',
      model: 'LULU-EBB',
      brand: 'Lululemon',
      title: 'Lululemon Everywhere Belt Bag',
      standardPrice: 38.00,
      cost: 19.00,
      status: 'Live',
      tags: ['Accessories', 'Fashion'],
      onOrder: 120,
      poNumber: 'PO-38535',
      onHold: 15,
      totalATS: 110,
      uploadedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      uploadSource: 'Lululemon B2B Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 70 },
        { name: 'Demo_3PL', ats: 25 },
        { name: 'TX DC', ats: 15 }
      ]
    },
    {
      sku: 'ATH-M50X',
      model: 'ATH-M50X',
      brand: 'Audio-Technica',
      title: 'Audio-Technica ATH-M50x',
      standardPrice: 169.00,
      cost: 115.00,
      status: 'Live',
      tags: ['Electronics', 'Audio'],
      onOrder: 15,
      poNumber: 'PO-38540',
      onHold: 0,
      totalATS: 15,
      uploadedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
      uploadSource: 'Audio-Technica Feed',
      warehouses: [
        { name: 'Sarasota DC', ats: 10 },
        { name: 'Demo_3PL', ats: 5 },
        { name: 'NY DC', ats: 0 }
      ]
    }
  ];

  const STORAGE_KEY = 'stark.enterpriseItemMaster.customRecords.v2';

  function getStoredCatalog() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (_) {}
    return null;
  }

  function saveCatalog(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (_) {}
  }

  function getItemMasterRecords() {
    let catalog = getStoredCatalog();
    if (!catalog) {
      catalog = JSON.parse(JSON.stringify(defaultMasterCatalog));
      saveCatalog(catalog);
    }
    return catalog;
  }

  function getBrandList(items) {
    const map = {};
    items.forEach(i => {
      const b = (i.brand || '').trim();
      if (b) map[b] = (map[b] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }

  function filterItems(items) {
    return items.filter(item => {
      // 1. Text Search
      if (query) {
        const q = query.toLowerCase().trim();
        const whNames = (item.warehouses || []).map(w => w.name).join(' ');
        const haystack = [
          item.model,
          item.sku,
          item.brand,
          item.title,
          item.status,
          (item.tags || []).join(' '),
          whNames
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // 2. Brand Filter
      if (selectedBrand !== 'all' && item.brand.toLowerCase() !== selectedBrand.toLowerCase()) {
        return false;
      }

      // 3. Status Filter (Live / fashion / internal use / presentation)
      if (selectedStatus !== 'all' && item.status.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }

      // 4. Warehouse Filter
      if (selectedWarehouse !== 'all') {
        const whTarget = selectedWarehouse.toLowerCase();
        const hasStockInWh = (item.warehouses || []).some(w => {
          const matchName = w.name.toLowerCase().includes(whTarget) ||
            (whTarget === 'sarasota' && w.name.toLowerCase().includes('sarasota')) ||
            (whTarget === 'demo_3pl' && w.name.toLowerCase().includes('demo_3pl'));
          return matchName && w.ats > 0;
        });
        if (!hasStockInWh) return false;
      }

      // 5. Price Filter
      const price = item.standardPrice;
      if (minPrice !== '' && price < Number(minPrice)) return false;
      if (maxPrice !== '' && price > Number(maxPrice)) return false;

      // Price Tier Pills
      if (priceTier === 'under50' && price >= 50) return false;
      if (priceTier === '50-150' && (price < 50 || price > 150)) return false;
      if (priceTier === '150-300' && (price < 150 || price > 300)) return false;
      if (priceTier === '300plus' && price < 300) return false;

      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'model-asc': return a.model.localeCompare(b.model);
        case 'model-desc': return b.model.localeCompare(a.model);
        case 'brand-asc': return a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model);
        case 'price-low': return a.standardPrice - b.standardPrice;
        case 'price-high': return b.standardPrice - a.standardPrice;
        case 'ats-high': return b.totalATS - a.totalATS;
        case 'ats-low': return a.totalATS - b.totalATS;
        case 'date-desc': return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        default: return a.model.localeCompare(b.model);
      }
    });
  }

  function getStatusBadgeHtml(status) {
    const s = String(status || 'Live').toLowerCase();
    let cls = 'live', label = 'Live';
    if (s.includes('fashion')) { cls = 'fashion'; label = 'Fashion'; }
    else if (s.includes('internal')) { cls = 'internal'; label = 'Internal Use'; }
    else if (s.includes('presentation')) { cls = 'presentation'; label = 'Presentation'; }

    return `<span class="im-card-status-badge ${cls}">● ${esc(label)}</span>`;
  }

  // Spreadsheet Parser (SheetJS .xlsx/.xls + CSV Fallback)
  function parseCSVText(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (!lines.length) return [];

    function parseLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          if (inQuotes && line[i + 1] === char) {
            current += char;
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if ((char === ',' || char === '\t') && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.every(v => !v)) continue;
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }
    return rows;
  }

  function parseSpreadsheet(file) {
    return new Promise((resolve, reject) => {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      const reader = new FileReader();

      if (isExcel && window.XLSX) {
        reader.onload = e => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const rawRows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
            const normalized = rawRows.map(r => {
              const res = {};
              for (const [k, v] of Object.entries(r)) {
                res[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = String(v ?? '').trim();
              }
              return res;
            });
            resolve(normalized);
          } catch (err) {
            reject(new Error('Excel read error: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = e => {
          try {
            resolve(parseCSVText(e.target.result));
          } catch (err) {
            reject(new Error('CSV read error: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsText(file);
      }
    });
  }

  function downloadCsvFile(filename, csvText) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // =========================================================================
  // ATS UPLOAD BY THE BRAND (EXCEL / CSV FILE)
  // ATS is availability at the brand
  // =========================================================================
  function openAtsUploadModal(defaultBrand = '') {
    const allRecords = getItemMasterRecords();
    const brands = getBrandList(allRecords).map(([b]) => b);
    const activeBrand = defaultBrand || (selectedBrand !== 'all' ? selectedBrand : brands[0] || 'Sony');

    let parsedRows = [];
    let uploadedFileName = '';

    const body = `
      <div class="im-form" id="im-ats-upload-form">
        <div class="im-banner-desc">
          <strong>ATS is Availability at the Brand:</strong> Upload the latest Available-To-Sell stock file provided by brand partners (Excel .xlsx, .xls, or .csv) to update availability at the brand.
        </div>

        <div class="im-form-row">
          <label class="im-form-field">
            <span>Brand Partner *</span>
            <select id="ats-upload-brand" class="im-select">
              ${brands.map(b => `<option value="${esc(b)}" ${b.toLowerCase() === activeBrand.toLowerCase() ? 'selected' : ''}>${esc(b)}</option>`).join('')}
              <option value="__NEW__">+ Add / Upload for New Brand…</option>
            </select>
          </label>
          <label class="im-form-field" id="ats-custom-brand-wrap" style="display:none">
            <span>New Brand Name *</span>
            <input type="text" id="ats-custom-brand" placeholder="e.g. Bose, Sennheiser, Samsung">
          </label>
        </div>

        <!-- File Dropzone -->
        <div class="im-upload-zone" id="ats-dropzone">
          <input type="file" id="ats-file-input" accept=".xlsx,.xls,.csv,.tsv" hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p id="ats-drop-title">Drop Brand ATS Excel / CSV File Here or Browse</p>
          <small>Accepts .xlsx, .xls, .csv · Auto-detects Model#, Brand, and ATS Quantity columns</small>
        </div>

        <div class="im-upload-templates">
          <button type="button" class="im-template-btn" id="ats-download-template">📥 Download ATS Excel Template (.csv)</button>
          <button type="button" class="im-template-btn" id="ats-load-sample">⚡ Load Sample Brand ATS Feed</button>
        </div>

        <!-- Live Parsed Preview Table -->
        <div id="ats-preview-wrap" class="im-upload-preview" style="display:none">
          <table class="im-preview-table">
            <thead>
              <tr>
                <th>Model #</th>
                <th>Brand</th>
                <th>Product Description</th>
                <th style="text-align:right">Current Master ATS</th>
                <th style="text-align:right">New Brand ATS</th>
                <th style="text-align:right">Change</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="ats-preview-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    window.StarkSystemUI.dialog('ATS Upload · Brand Availability', body, () => {
      if (!parsedRows.length) {
        notice('Please upload or load a Brand ATS file first.', true);
        return false;
      }

      const brandSelect = document.querySelector('#ats-upload-brand');
      let targetBrand = brandSelect.value;
      if (targetBrand === '__NEW__') {
        targetBrand = document.querySelector('#ats-custom-brand').value.trim() || 'New Brand';
      }

      const uploadTimestamp = new Date().toISOString();
      const currentItems = getItemMasterRecords();
      let updatedCount = 0;

      parsedRows.forEach(row => {
        const m = String(row.model || '').trim();
        if (!m) return;
        const newQty = Math.max(0, parseInt(row.ats, 10) || 0);

        const item = currentItems.find(i => (i.model && i.model.toLowerCase() === m.toLowerCase()) || i.sku.toLowerCase() === m.toLowerCase());
        if (item) {
          item.totalATS = newQty;
          item.uploadedAt = uploadTimestamp;
          item.uploadSource = `Brand ATS Feed · ${targetBrand} (${uploadedFileName || 'file'})`;
          if (item.warehouses && item.warehouses[0]) {
            item.warehouses[0].ats = Math.round(newQty * 0.6);
          }
          if (item.warehouses && item.warehouses[1]) {
            item.warehouses[1].ats = Math.round(newQty * 0.25);
          }
          if (item.warehouses && item.warehouses[2]) {
            item.warehouses[2].ats = Math.max(0, newQty - (item.warehouses[0]?.ats || 0) - (item.warehouses[1]?.ats || 0));
          }
          updatedCount++;
        }
      });

      saveCatalog(currentItems);
      notice(`ATS Upload successful: ${updatedCount} items updated with latest brand availability.`);
      render();
      return true;
    }, 'Apply Brand ATS Upload', { system: true });

    const brandSel = document.querySelector('#ats-upload-brand');
    const customWrap = document.querySelector('#ats-custom-brand-wrap');
    if (brandSel && customWrap) {
      brandSel.onchange = () => {
        customWrap.style.display = brandSel.value === '__NEW__' ? '' : 'none';
      };
    }

    const dropzone = document.querySelector('#ats-dropzone');
    const fileInput = document.querySelector('#ats-file-input');
    const dropTitle = document.querySelector('#ats-drop-title');
    const previewWrap = document.querySelector('#ats-preview-wrap');
    const previewTbody = document.querySelector('#ats-preview-tbody');

    if (dropzone && fileInput) {
      dropzone.onclick = () => fileInput.click();
      dropzone.ondragover = e => { e.preventDefault(); dropzone.classList.add('dragover'); };
      dropzone.ondragleave = () => dropzone.classList.remove('dragover');
      dropzone.ondrop = e => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
      };
      fileInput.onchange = e => {
        if (e.target.files.length) handleFile(e.target.files[0]);
      };
    }

    async function handleFile(file) {
      uploadedFileName = file.name;
      dropTitle.innerHTML = `File Loaded: <b>${esc(file.name)}</b> (${(file.size / 1024).toFixed(1)} KB)`;
      try {
        const rawRows = await parseSpreadsheet(file);
        processAtsRows(rawRows);
      } catch (err) {
        notice(err.message, true);
      }
    }

    function processAtsRows(rows) {
      const all = getItemMasterRecords();
      const brandVal = document.querySelector('#ats-upload-brand').value;

      parsedRows = rows.map(r => {
        const model = r.model || r.modelnumber || r.sku || r.item || r.itemcode || r.part || '';
        const ats = r.ats || r.available || r.availabletosell || r.qty || r.quantity || r.stock || r.onhand || 0;
        const brand = r.brand || brandVal;
        const title = r.title || r.description || r.product || r.name || '';

        return {
          model: String(model).trim(),
          ats: Number(ats) || 0,
          brand: String(brand).trim(),
          title: String(title).trim()
        };
      }).filter(r => r.model);

      if (!parsedRows.length) {
        notice('No valid Model# or ATS quantity columns detected in file.', true);
        return;
      }

      previewWrap.style.display = '';
      previewTbody.innerHTML = parsedRows.slice(0, 50).map(row => {
        const existing = all.find(i => i.model.toLowerCase() === row.model.toLowerCase() || i.sku.toLowerCase() === row.model.toLowerCase());
        const currentATS = existing ? existing.totalATS : 0;
        const delta = row.ats - currentATS;
        const deltaClass = delta > 0 ? 'im-delta-pos' : delta < 0 ? 'im-delta-neg' : 'im-delta-zero';
        const deltaText = delta > 0 ? `+${delta}` : `${delta}`;

        return `
          <tr>
            <td><strong>${esc(row.model)}</strong></td>
            <td>${esc(row.brand || brandVal)}</td>
            <td>${esc(existing ? existing.title : row.title || '—')}</td>
            <td style="text-align:right">${num(currentATS)}</td>
            <td style="text-align:right"><strong>${num(row.ats)}</strong></td>
            <td style="text-align:right" class="${deltaClass}">${deltaText}</td>
            <td>${existing ? '<span class="sys-badge green">Match</span>' : '<span class="sys-badge amber">New Model</span>'}</td>
          </tr>
        `;
      }).join('');

      notice(`Parsed ${parsedRows.length} brand ATS records from file.`);
    }

    document.querySelector('#ats-download-template').onclick = () => {
      const template = 'Model#,Brand,Product_Description,ATS_Quantity,Upload_Date\r\nWH-1000XM5,Sony,Sony WH-1000XM5,212,2026-10-17\r\nNB-550,New Balance,New Balance 550,86,2026-10-17\r\nTMBLR-40,YETI,YETI Rambler 40oz,142,2026-10-17\r\nSL-FLEX,Bose,Bose SoundLink Flex,56,2026-10-17';
      downloadCsvFile('Brand-ATS-Upload-Template.csv', template);
      notice('Brand ATS CSV template downloaded.');
    };

    document.querySelector('#ats-load-sample').onclick = () => {
      uploadedFileName = `${activeBrand}_ATS_Feed_Live.xlsx`;
      dropTitle.innerHTML = `Loaded Sample Feed: <b>${esc(uploadedFileName)}</b>`;
      const sampleRows = [
        { model: 'WH-1000XM5', ats: 212, brand: 'Sony', title: 'Sony WH-1000XM5' },
        { model: 'NB-550', ats: 86, brand: 'New Balance', title: 'New Balance 550' },
        { model: 'TMBLR-40', ats: 142, brand: 'YETI', title: 'YETI Rambler 40oz' },
        { model: 'SL-FLEX', ats: 56, brand: 'Bose', title: 'Bose SoundLink Flex' },
        { model: 'AP-PRO2', ats: 62, brand: 'Apple', title: 'Apple AirPods Pro 2' }
      ];
      processAtsRows(sampleRows);
    };
  }

  // =========================================================================
  // PRICE UPDATE (BRAND)
  // =========================================================================
  function openPriceUpdateModal(defaultBrand = '') {
    const allRecords = getItemMasterRecords();
    const brands = getBrandList(allRecords).map(([b]) => b);
    const activeBrand = defaultBrand || (selectedBrand !== 'all' ? selectedBrand : brands[0] || 'Sony');

    let parsedRows = [];
    let uploadedFileName = '';

    const body = `
      <div class="im-form" id="im-price-upload-form">
        <div class="im-banner-desc">
          <strong>Brand Price Update:</strong> Upload brand price sheets (Excel .xlsx, .xls, or .csv) to apply updated standard pricing and unit cost.
        </div>

        <div class="im-form-row">
          <label class="im-form-field">
            <span>Brand Partner *</span>
            <select id="price-upload-brand" class="im-select">
              ${brands.map(b => `<option value="${esc(b)}" ${b.toLowerCase() === activeBrand.toLowerCase() ? 'selected' : ''}>${esc(b)}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="im-upload-zone" id="price-dropzone">
          <input type="file" id="price-file-input" accept=".xlsx,.xls,.csv,.tsv" hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <p id="price-drop-title">Drop Brand Price Sheet Here or Browse</p>
          <small>Accepts .xlsx, .xls, .csv · Auto-detects Model#, New Standard Price, and Unit Cost</small>
        </div>

        <div class="im-upload-templates">
          <button type="button" class="im-template-btn" id="price-download-template">📥 Download Price Sheet Template (.csv)</button>
          <button type="button" class="im-template-btn" id="price-load-sample">⚡ Load Sample Brand Price Revision</button>
        </div>

        <div id="price-preview-wrap" class="im-upload-preview" style="display:none">
          <table class="im-preview-table">
            <thead>
              <tr>
                <th>Model #</th>
                <th>Brand</th>
                <th style="text-align:right">Current Price</th>
                <th style="text-align:right">New Standard Price</th>
                <th style="text-align:right">Delta %</th>
                <th style="text-align:right">Unit Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="price-preview-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    window.StarkSystemUI.dialog('Brand Price Update · Upload Revision', body, () => {
      if (!parsedRows.length) {
        notice('Please upload or load a Brand Price sheet first.', true);
        return false;
      }

      const uploadTimestamp = new Date().toISOString();
      const currentItems = getItemMasterRecords();
      let updatedCount = 0;

      parsedRows.forEach(row => {
        const m = String(row.model || '').trim();
        if (!m) return;
        const newPrice = Number(row.price);
        const newCost = Number(row.cost);

        const item = currentItems.find(i => (i.model && i.model.toLowerCase() === m.toLowerCase()) || i.sku.toLowerCase() === m.toLowerCase());
        if (item) {
          if (Number.isFinite(newPrice) && newPrice > 0) item.standardPrice = newPrice;
          if (Number.isFinite(newCost) && newCost > 0) item.cost = newCost;
          item.uploadedAt = uploadTimestamp;
          updatedCount++;
        }
      });

      saveCatalog(currentItems);
      notice(`Brand Price Update applied: ${updatedCount} catalog items updated.`);
      render();
      return true;
    }, 'Apply Price Changes', { system: true });

    const dropzone = document.querySelector('#price-dropzone');
    const fileInput = document.querySelector('#price-file-input');
    const dropTitle = document.querySelector('#price-drop-title');
    const previewWrap = document.querySelector('#price-preview-wrap');
    const previewTbody = document.querySelector('#price-preview-tbody');

    if (dropzone && fileInput) {
      dropzone.onclick = () => fileInput.click();
      dropzone.ondragover = e => { e.preventDefault(); dropzone.classList.add('dragover'); };
      dropzone.ondragleave = () => dropzone.classList.remove('dragover');
      dropzone.ondrop = e => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
      };
      fileInput.onchange = e => {
        if (e.target.files.length) handleFile(e.target.files[0]);
      };
    }

    async function handleFile(file) {
      uploadedFileName = file.name;
      dropTitle.innerHTML = `Price File Loaded: <b>${esc(file.name)}</b> (${(file.size / 1024).toFixed(1)} KB)`;
      try {
        const rawRows = await parseSpreadsheet(file);
        processPriceRows(rawRows);
      } catch (err) {
        notice(err.message, true);
      }
    }

    function processPriceRows(rows) {
      const all = getItemMasterRecords();
      const brandVal = document.querySelector('#price-upload-brand').value;

      parsedRows = rows.map(r => {
        const model = r.model || r.modelnumber || r.sku || r.item || r.itemcode || r.part || '';
        const price = r.price || r.newprice || r.standardprice || r.msrp || r.retail || r.unitprice || r.listprice || 0;
        const cost = r.cost || r.unitcost || r.wholesale || r.dealerprice || 0;
        const brand = r.brand || brandVal;

        return {
          model: String(model).trim(),
          price: Number(price) || 0,
          cost: Number(cost) || 0,
          brand: String(brand).trim()
        };
      }).filter(r => r.model && r.price > 0);

      if (!parsedRows.length) {
        notice('No valid Model# or Price columns detected in file.', true);
        return;
      }

      previewWrap.style.display = '';
      previewTbody.innerHTML = parsedRows.slice(0, 50).map(row => {
        const existing = all.find(i => i.model.toLowerCase() === row.model.toLowerCase() || i.sku.toLowerCase() === row.model.toLowerCase());
        const currentPrice = existing ? existing.standardPrice : 0;
        const pct = currentPrice > 0 ? (((row.price - currentPrice) / currentPrice) * 100).toFixed(1) : '0.0';
        const pctClass = Number(pct) > 0 ? 'im-delta-pos' : Number(pct) < 0 ? 'im-delta-neg' : 'im-delta-zero';
        const pctText = Number(pct) > 0 ? `+${pct}%` : `${pct}%`;

        return `
          <tr>
            <td><strong>${esc(row.model)}</strong></td>
            <td>${esc(row.brand || brandVal)}</td>
            <td style="text-align:right">${money(currentPrice)}</td>
            <td style="text-align:right"><strong>${money(row.price)}</strong></td>
            <td style="text-align:right" class="${pctClass}">${pctText}</td>
            <td style="text-align:right">${row.cost > 0 ? money(row.cost) : '—'}</td>
            <td>${existing ? '<span class="sys-badge green">Price Update</span>' : '<span class="sys-badge red">SKU Not Found</span>'}</td>
          </tr>
        `;
      }).join('');

      notice(`Parsed ${parsedRows.length} price update records from file.`);
    }

    document.querySelector('#price-download-template').onclick = () => {
      const template = 'Model#,Brand,New_Standard_Price,Unit_Cost,Effective_Date\r\nWH-1000XM5,Sony,349.00,278.00,2026-11-01\r\nAP-PRO2,Apple,249.00,185.00,2026-11-01\r\nNB-550,New Balance,110.00,65.00,2026-11-01';
      downloadCsvFile('Brand-Price-Update-Template.csv', template);
      notice('Price Sheet CSV template downloaded.');
    };

    document.querySelector('#price-load-sample').onclick = () => {
      uploadedFileName = `${activeBrand}_Price_Revision_Q4.xlsx`;
      dropTitle.innerHTML = `Loaded Sample Sheet: <b>${esc(uploadedFileName)}</b>`;
      const sampleRows = [
        { model: 'WH-1000XM5', price: 349.00, cost: 278.00, brand: 'Sony' },
        { model: 'AP-PRO2', price: 249.00, cost: 185.00, brand: 'Apple' },
        { model: 'NB-550', price: 110.00, cost: 65.00, brand: 'New Balance' }
      ];
      processPriceRows(sampleRows);
    };
  }

  function exportCSV(items) {
    const headers = [
      'Model#',
      'SKU',
      'Brand',
      'Title',
      'Status',
      'Standard Price ($)',
      'Unit Cost ($)',
      'On Order',
      'PO Number',
      'On Hold',
      'Available (ATS)',
      'Uploaded Date & Time',
      'Upload Source'
    ];

    const rows = items.map(item => [
      item.model,
      item.sku,
      item.brand,
      item.title,
      item.status,
      item.standardPrice.toFixed(2),
      (item.cost || 0).toFixed(2),
      item.onOrder || 0,
      item.poNumber || '—',
      item.onHold || 0,
      item.totalATS,
      formatDate(item.uploadedAt),
      item.uploadSource
    ]);

    const csvContent = [headers, ...rows].map(row =>
      row.map(cell => {
        let str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(',')
    ).join('\r\n');

    downloadCsvFile(`Enterprise-Item-Master-${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
    notice('Item Master exported successfully.');
  }

  function openAddItemModal() {
    document.querySelector('#im-add-modal-overlay')?.remove();

    const brands = getBrandList(getItemMasterRecords()).map(([b]) => b);
    const existingBrandsHtml = brands.map(b => `<option value="${esc(b)}"${b === 'Sony' ? ' selected' : ''}>${esc(b)}</option>`).join('');

    const overlay = document.createElement('div');
    overlay.className = 'im-add-modal-overlay';
    overlay.id = 'im-add-modal-overlay';

    overlay.innerHTML = `
      <div class="im-add-modal-card" role="dialog" aria-modal="true" aria-labelledby="im-add-title">
        <!-- Header -->
        <div class="im-add-modal-header">
          <div class="im-add-modal-header-left">
            <div class="im-add-modal-icon-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div>
              <h2 class="im-add-modal-title" id="im-add-title">Add New Catalog Item to Master</h2>
              <p class="im-add-modal-subtitle">Create a new master item with catalog, pricing, supplier, and distribution details.</p>
            </div>
          </div>
          <button type="button" class="im-add-modal-close" id="im-add-modal-close" aria-label="Close dialog">×</button>
        </div>

        <form id="im-new-item-form" class="im-add-modal-form">
          <!-- Section 1: Basic Item Info -->
          <section class="im-add-section">
            <div class="im-add-sec-head">
              <span class="im-add-badge">1</span>
              <svg class="im-add-sec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <div>
                <h3 class="im-add-sec-title">Basic Item Info</h3>
                <p class="im-add-sec-desc">Core identification details for this catalog item.</p>
              </div>
            </div>
            <div class="im-add-grid-4">
              <label class="im-add-field">
                <span>Model # (Identifier) <b class="req">*</b></span>
                <input type="text" id="add-model" required placeholder="e.g. WH-1000XM6">
              </label>
              <label class="im-add-field">
                <span>Vendor Item #</span>
                <input type="text" id="add-vendor-item" placeholder="e.g. VND-778899">
              </label>
              <label class="im-add-field">
                <span>Brand <b class="req">*</b></span>
                <select id="add-brand" required>
                  ${existingBrandsHtml}
                  <option value="__NEW__">+ Custom Brand...</option>
                </select>
                <input type="text" id="add-brand-custom" placeholder="Enter new brand name" style="display:none;margin-top:6px;">
              </label>
              <label class="im-add-field">
                <span>UPC</span>
                <input type="text" id="add-upc" placeholder="e.g. 027242923882">
              </label>
            </div>
          </section>

          <!-- Section 2: Product Details -->
          <section class="im-add-section">
            <div class="im-add-sec-head">
              <span class="im-add-badge">2</span>
              <svg class="im-add-sec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <div>
                <h3 class="im-add-sec-title">Product Details</h3>
                <p class="im-add-sec-desc">Provide the product title and detailed description.</p>
              </div>
            </div>
            <div class="im-add-grid-split">
              <label class="im-add-field">
                <span>Product Title <b class="req">*</b></span>
                <input type="text" id="add-title" required placeholder="e.g. WH-1000XM6 Premium Noise Canceling Wireless Headphones">
              </label>
              <label class="im-add-field">
                <span>Catalog Status <b class="req">*</b></span>
                <select id="add-status" required>
                  <option value="Live" selected>Live</option>
                  <option value="fashion">Fashion</option>
                  <option value="internal use">Internal Use</option>
                  <option value="presentation">Presentation</option>
                </select>
              </label>
            </div>
            <label class="im-add-field" style="margin-top: 10px;">
              <span>Description <b class="req">*</b></span>
              <textarea id="add-desc" rows="3" required placeholder="e.g. Premium wireless noise canceling headphones with industry-leading sound quality, 30-hour battery life, and fast USB-C charging..."></textarea>
            </label>
          </section>

          <!-- Section 3: Features -->
          <section class="im-add-section">
            <div class="im-add-sec-head">
              <span class="im-add-badge">3</span>
              <svg class="im-add-sec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              <div>
                <h3 class="im-add-sec-title">Features</h3>
                <p class="im-add-sec-desc">Enter key product features (up to 6).</p>
              </div>
            </div>
            <div class="im-add-features-grid">
              <div class="im-add-feat-item">
                <span class="im-add-feat-lbl">Feature 1</span>
                <input type="text" id="add-feat-1" placeholder="e.g. Active Noise Cancellation">
              </div>
              <div class="im-add-feat-item">
                <span class="im-add-feat-lbl">Feature 4</span>
                <input type="text" id="add-feat-4" placeholder="e.g. USB-C charging">
              </div>
              <div class="im-add-feat-item">
                <span class="im-add-feat-lbl">Feature 2</span>
                <input type="text" id="add-feat-2" placeholder="e.g. Bluetooth 5.3">
              </div>
              <div class="im-add-feat-item">
                <span class="im-add-feat-lbl">Feature 5</span>
                <input type="text" id="add-feat-5" placeholder="e.g. Lightweight and comfortable">
              </div>
              <div class="im-add-feat-item">
                <span class="im-add-feat-lbl">Feature 3</span>
                <input type="text" id="add-feat-3" placeholder="e.g. 30-hour battery life">
              </div>
              <div class="im-add-feat-item">
                <span class="im-add-feat-lbl">Feature 6</span>
                <input type="text" id="add-feat-6" placeholder="e.g. Built-in microphone">
              </div>
            </div>
          </section>

          <!-- Section 4: Commercial Details -->
          <section class="im-add-section">
            <div class="im-add-sec-head">
              <span class="im-add-badge">4</span>
              <svg class="im-add-sec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              <div>
                <h3 class="im-add-sec-title">Commercial Details</h3>
                <p class="im-add-sec-desc">Pricing, sourcing, and manufacturing information.</p>
              </div>
            </div>
            <div class="im-add-grid-6">
              <label class="im-add-field">
                <span>Standard Price ($) <b class="req">*</b></span>
                <input type="number" id="add-price" step="0.01" min="0" required placeholder="e.g. 199.00">
              </label>
              <label class="im-add-field">
                <span>Unit Cost ($) <b class="req">*</b></span>
                <input type="number" id="add-cost" step="0.01" min="0" required placeholder="e.g. 120.00">
              </label>
              <label class="im-add-field">
                <span>Country of Origin <b class="req">*</b></span>
                <select id="add-origin" required>
                  <option value="China" selected>e.g. China</option>
                  <option value="United States">United States</option>
                  <option value="Vietnam">Vietnam</option>
                  <option value="Taiwan">Taiwan</option>
                  <option value="Japan">Japan</option>
                  <option value="Mexico">Mexico</option>
                  <option value="Germany">Germany</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label class="im-add-field">
                <span>HS Code <span class="im-info-tip" title="Harmonized System tariff code">ⓘ</span></span>
                <input type="text" id="add-hscode" placeholder="e.g. 851830">
              </label>
              <label class="im-add-field">
                <span>MOQ</span>
                <input type="number" id="add-moq" min="1" step="1" placeholder="e.g. 100">
              </label>
              <label class="im-add-field">
                <span>Lead Time</span>
                <input type="text" id="add-leadtime" placeholder="e.g. 4-6 weeks">
              </label>
            </div>
          </section>

          <!-- Bottom Row: 5 Customer Feed & 6 Item Measurements -->
          <div class="im-add-bottom-row">
            <!-- Section 5: Customer Feed -->
            <section class="im-add-section">
              <div class="im-add-sec-head">
                <span class="im-add-badge">5</span>
                <svg class="im-add-sec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <div>
                  <h3 class="im-add-sec-title">Customer Feed</h3>
                  <p class="im-add-sec-desc">Select which customers will receive this item in their catalog feed.</p>
                </div>
              </div>
              <div class="im-add-field">
                <span>Select Customers to Feed This Item <b class="req">*</b></span>
                <div class="im-add-tag-box" id="im-add-tag-box">
                  <span class="im-add-tag" data-cust="Amazon">Amazon <span class="im-add-tag-remove">&times;</span></span>
                  <span class="im-add-tag" data-cust="Best Buy">Best Buy <span class="im-add-tag-remove">&times;</span></span>
                  <span class="im-add-tag" data-cust="Walmart">Walmart <span class="im-add-tag-remove">&times;</span></span>
                  <span class="im-add-tag" data-cust="Target">Target <span class="im-add-tag-remove">&times;</span></span>
                  <span class="im-add-tag-chevron">⌄</span>
                </div>
                <input type="text" class="im-add-tag-input" id="add-customer-feed" placeholder="e.g. Amazon, Best Buy, Walmart, Target (press Enter to add)...">
              </div>
            </section>

            <!-- Section 6: Item Measurements -->
            <section class="im-add-section">
              <div class="im-add-sec-head">
                <span class="im-add-badge">6</span>
                <svg class="im-add-sec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
                <div>
                  <h3 class="im-add-sec-title">Item Measurements</h3>
                  <p class="im-add-sec-desc">Physical dimensions and weight.</p>
                </div>
              </div>
              <div class="im-add-measure-grid">
                <label class="im-add-field">
                  <span>Length</span>
                  <input type="number" id="add-dim-l" step="0.1" placeholder="e.g. 7.3">
                </label>
                <label class="im-add-field">
                  <span>Width</span>
                  <input type="number" id="add-dim-w" step="0.1" placeholder="e.g. 6.8">
                </label>
                <label class="im-add-field">
                  <span>Height</span>
                  <input type="number" id="add-dim-h" step="0.1" placeholder="e.g. 3.2">
                </label>
                <label class="im-add-field">
                  <span>Weight</span>
                  <input type="number" id="add-dim-wt" step="0.01" placeholder="e.g. 0.25">
                </label>
                <label class="im-add-field">
                  <span>Units</span>
                  <select id="add-dim-units">
                    <option value="in / lb (Imperial)" selected>in / lb (Imperial)</option>
                    <option value="cm / kg (Metric)">cm / kg (Metric)</option>
                  </select>
                </label>
              </div>
            </section>
          </div>

          <!-- Footer Buttons -->
          <div class="im-add-modal-footer">
            <button type="button" class="im-add-btn-cancel" id="im-add-btn-cancel">Cancel</button>
            <button type="submit" class="im-add-btn-create" id="im-add-btn-create">Create Item</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', handleKey);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKey);

    overlay.querySelector('#im-add-modal-close').onclick = close;
    overlay.querySelector('#im-add-btn-cancel').onclick = close;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // Brand custom input toggle
    const brandSelect = overlay.querySelector('#add-brand');
    const brandCustom = overlay.querySelector('#add-brand-custom');
    brandSelect.onchange = () => {
      if (brandSelect.value === '__NEW__') {
        brandCustom.style.display = 'block';
        brandCustom.required = true;
        brandCustom.focus();
      } else {
        brandCustom.style.display = 'none';
        brandCustom.required = false;
      }
    };

    // Customer feed tag removal & addition
    const tagBox = overlay.querySelector('#im-add-tag-box');
    const tagInput = overlay.querySelector('#add-customer-feed');

    const bindTagRemoves = () => {
      tagBox.querySelectorAll('.im-add-tag-remove').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          btn.closest('.im-add-tag')?.remove();
        };
      });
    };
    bindTagRemoves();

    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = tagInput.value.trim();
        if (val) {
          const tag = document.createElement('span');
          tag.className = 'im-add-tag';
          tag.setAttribute('data-cust', val);
          tag.innerHTML = `${esc(val)} <span class="im-add-tag-remove">&times;</span>`;
          tagBox.insertBefore(tag, tagBox.querySelector('.im-add-tag-chevron'));
          tagInput.value = '';
          bindTagRemoves();
        }
      }
    });

    // Form submission
    const form = overlay.querySelector('#im-new-item-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;

      const model = overlay.querySelector('#add-model').value.trim();
      const vendorItem = overlay.querySelector('#add-vendor-item').value.trim() || 'VND-' + Math.floor(100000 + Math.random() * 900000);
      let brand = brandSelect.value === '__NEW__' ? brandCustom.value.trim() : brandSelect.value.trim();
      if (!brand) brand = 'Sony';
      const upc = overlay.querySelector('#add-upc').value.trim() || '0' + Math.floor(10000000000 + Math.random() * 90000000000);
      const title = overlay.querySelector('#add-title').value.trim();
      const status = overlay.querySelector('#add-status').value;
      const desc = overlay.querySelector('#add-desc').value.trim();

      const features = [
        overlay.querySelector('#add-feat-1').value.trim(),
        overlay.querySelector('#add-feat-2').value.trim(),
        overlay.querySelector('#add-feat-3').value.trim(),
        overlay.querySelector('#add-feat-4').value.trim(),
        overlay.querySelector('#add-feat-5').value.trim(),
        overlay.querySelector('#add-feat-6').value.trim()
      ].filter(Boolean);

      const price = Number(overlay.querySelector('#add-price').value) || 199.00;
      const cost = Number(overlay.querySelector('#add-cost').value) || 120.00;
      const origin = overlay.querySelector('#add-origin').value;
      const hsCode = overlay.querySelector('#add-hscode').value.trim() || '851830';
      const moq = Number(overlay.querySelector('#add-moq').value) || 100;
      const leadTime = overlay.querySelector('#add-leadtime').value.trim() || '4-6 weeks';

      const customerFeeds = [...tagBox.querySelectorAll('.im-add-tag')].map(t => t.getAttribute('data-cust') || t.textContent.replace('×', '').trim());

      const measurements = {
        length: Number(overlay.querySelector('#add-dim-l').value) || 7.3,
        width: Number(overlay.querySelector('#add-dim-w').value) || 6.8,
        height: Number(overlay.querySelector('#add-dim-h').value) || 3.2,
        weight: Number(overlay.querySelector('#add-dim-wt').value) || 0.25,
        units: overlay.querySelector('#add-dim-units').value
      };

      const sku = (brand.toUpperCase().replace(/[^A-Z0-9]/g, '') + '-' + model.toUpperCase().replace(/[^A-Z0-9]/g, '')).slice(0, 18);
      const items = getItemMasterRecords();

      const newItem = {
        sku,
        model,
        vendorItem,
        brand,
        upc,
        title,
        description: desc,
        status,
        standardPrice: price,
        cost,
        countryOfOrigin: origin,
        hsCode,
        moq,
        leadTime,
        customerFeeds,
        measurements,
        features,
        tags: [brand, 'Catalog'],
        onOrder: 100,
        poNumber: 'PO-' + Math.floor(38000 + Math.random() * 900),
        onHold: 0,
        totalATS: 50,
        uploadedAt: new Date().toISOString(),
        uploadSource: 'Manual Entry',
        warehouses: [
          { name: 'Sarasota DC', ats: 30 },
          { name: 'Demo_3PL', ats: 15 },
          { name: 'TX DC', ats: 5 }
        ]
      };

      items.unshift(newItem);
      saveCatalog(items);
      close();
      notice(`Item ${model} (${brand}) added to master catalog successfully.`);
      render();
    };
  }

  function openEditItemModal(item) {
    const body = `
      <form class="im-form" id="im-edit-form">
        <div class="im-form-row">
          <label class="im-form-field">
            <span>Model #</span>
            <input type="text" id="edit-model" value="${esc(item.model)}" required>
          </label>
          <label class="im-form-field">
            <span>Brand</span>
            <input type="text" id="edit-brand" value="${esc(item.brand)}" required>
          </label>
        </div>

        <label class="im-form-field full">
          <span>Product Title / Description</span>
          <input type="text" id="edit-title" value="${esc(item.title)}" required>
        </label>

        <div class="im-form-row three">
          <label class="im-form-field">
            <span>Status</span>
            <select id="edit-status">
              <option value="Live" ${item.status === 'Live' ? 'selected' : ''}>Live</option>
              <option value="fashion" ${item.status.toLowerCase() === 'fashion' ? 'selected' : ''}>Fashion</option>
              <option value="internal use" ${item.status.toLowerCase() === 'internal use' ? 'selected' : ''}>Internal Use</option>
              <option value="presentation" ${item.status.toLowerCase() === 'presentation' ? 'selected' : ''}>Presentation</option>
            </select>
          </label>
          <label class="im-form-field">
            <span>Standard Price ($)</span>
            <input type="number" id="edit-price" step="0.01" min="0" value="${item.standardPrice}">
          </label>
          <label class="im-form-field">
            <span>Unit Cost ($)</span>
            <input type="number" id="edit-cost" step="0.01" min="0" value="${item.cost || 0}">
          </label>
        </div>

        <div class="im-form-row three">
          <label class="im-form-field">
            <span>Available (ATS)</span>
            <input type="number" id="edit-ats" min="0" step="1" value="${item.totalATS}">
          </label>
          <label class="im-form-field">
            <span>On Order</span>
            <input type="number" id="edit-onorder" min="0" step="1" value="${item.onOrder || 0}">
          </label>
          <label class="im-form-field">
            <span>On Hold</span>
            <input type="number" id="edit-onhold" min="0" step="1" value="${item.onHold || 0}">
          </label>
        </div>
      </form>
    `;

    window.StarkSystemUI.dialog('Edit Item · ' + item.model, body, () => {
      const model = document.querySelector('#edit-model').value.trim();
      const brand = document.querySelector('#edit-brand').value.trim();
      const title = document.querySelector('#edit-title').value.trim();
      const status = document.querySelector('#edit-status').value;
      const standardPrice = Number(document.querySelector('#edit-price').value) || 0;
      const cost = Number(document.querySelector('#edit-cost').value) || 0;
      const totalATS = Number(document.querySelector('#edit-ats').value) || 0;
      const onOrder = Number(document.querySelector('#edit-onorder').value) || 0;
      const onHold = Number(document.querySelector('#edit-onhold').value) || 0;

      const items = getItemMasterRecords();
      const existing = items.find(x => x.sku === item.sku);
      if (existing) {
        existing.model = model;
        existing.brand = brand;
        existing.title = title;
        existing.status = status;
        existing.standardPrice = standardPrice;
        existing.cost = cost;
        existing.totalATS = totalATS;
        existing.onOrder = onOrder;
        existing.onHold = onHold;
        if (existing.warehouses && existing.warehouses[0]) {
          existing.warehouses[0].ats = Math.round(totalATS * 0.6);
        }
        if (existing.warehouses && existing.warehouses[1]) {
          existing.warehouses[1].ats = Math.round(totalATS * 0.25);
        }
        if (existing.warehouses && existing.warehouses[2]) {
          existing.warehouses[2].ats = Math.max(0, totalATS - (existing.warehouses[0]?.ats || 0) - (existing.warehouses[1]?.ats || 0));
        }
        existing.uploadedAt = new Date().toISOString();
        saveCatalog(items);
      }

      notice(`Updated item ${model} (${brand}).`);
      render();
      return true;
    }, 'Save Changes', { system: true });
  }

  function changeStatusQuickly(sku, newStatus) {
    const items = getItemMasterRecords();
    const item = items.find(x => x.sku === sku);
    if (item) {
      item.status = newStatus;
      item.uploadedAt = new Date().toISOString();
      saveCatalog(items);
      notice(`Status for ${item.model} changed to ${newStatus}.`);
      render();
    }
  }

  // =========================================================================
  // MAIN RENDER FUNCTION (MATCHES media_1792216254947_5371ff9e.png)
  // =========================================================================
  function render() {
    const root = document.querySelector('#item-master-content');
    if (!root) return;

    const allRecords = getItemMasterRecords();
    const brands = getBrandList(allRecords);
    const filtered = filterItems(allRecords);

    // Dynamic Counts for Toolbar Status Chips
    const liveCount = allRecords.filter(i => (i.status || '').toLowerCase() === 'live').length;
    const fashionCount = allRecords.filter(i => (i.status || '').toLowerCase() === 'fashion').length;
    const internalCount = allRecords.filter(i => ['internal use', 'internal_use', 'internal'].includes((i.status || '').toLowerCase())).length;
    const presentationCount = allRecords.filter(i => (i.status || '').toLowerCase() === 'presentation').length;

    let html = `
      <!-- Page Header: Title & Action Buttons -->
      <div class="im-header">
        <div class="im-header-title-block">
          <h1 class="im-page-title">Enterprise Item Master</h1>
          <p class="im-page-subtitle">Central item catalog repository with Available-to-Sell (ATS) brand feeds, real-time multi-warehouse inventory breakdown, and brand price sheets.</p>
        </div>
        <div class="im-header-actions">
          <button class="im-btn-action" id="im-btn-export" type="button" title="Export Master Catalog CSV">
            <svg class="im-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
          <button class="im-btn-action primary" id="im-btn-add" type="button">
            <svg class="im-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add New Item
          </button>
        </div>
      </div>

      <!-- Toolbar Panel -->
      <div class="im-toolbar-panel">
        <!-- Row 1: Search, Brand, Warehouse, Sort, View Toggles, Filters [2] -->
        <div class="im-toolbar-top">
          <div class="im-search-box">
            <svg class="im-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="im-search-input" placeholder="Search by model#, brand, title, SKU, bin..." value="${esc(query)}" autocomplete="off" aria-label="Search catalog items">
            ${query ? `<button type="button" class="im-clear-search" id="im-clear-search-btn" title="Clear search">✕</button>` : ''}
          </div>

          <div class="im-filter-group">
            <label class="im-filter-label" for="im-brand-select">Brand</label>
            <select id="im-brand-select" class="im-select">
              <option value="all">All Brands (${allRecords.length})</option>
              ${brands.map(([b, count]) => `<option value="${esc(b)}" ${selectedBrand.toLowerCase() === b.toLowerCase() ? 'selected' : ''}>${esc(b)} (${count})</option>`).join('')}
            </select>
          </div>

          <div class="im-filter-group">
            <label class="im-filter-label" for="im-warehouse-select">Warehouse</label>
            <select id="im-warehouse-select" class="im-select">
              <option value="all" ${selectedWarehouse === 'all' ? 'selected' : ''}>All Warehouses</option>
              <option value="sarasota" ${selectedWarehouse === 'sarasota' ? 'selected' : ''}>Sarasota DC</option>
              <option value="demo_3pl" ${selectedWarehouse === 'demo_3pl' ? 'selected' : ''}>Demo_3PL</option>
              <option value="ny" ${selectedWarehouse === 'ny' ? 'selected' : ''}>NY DC</option>
              <option value="fl" ${selectedWarehouse === 'fl' ? 'selected' : ''}>FL DC</option>
              <option value="tx" ${selectedWarehouse === 'tx' ? 'selected' : ''}>TX DC</option>
              <option value="ca" ${selectedWarehouse === 'ca' ? 'selected' : ''}>CA DC</option>
            </select>
          </div>

          <div class="im-filter-group">
            <label class="im-filter-label" for="im-sort-select">Sort by</label>
            <select id="im-sort-select" class="im-select">
              <option value="model-asc" ${sortBy === 'model-asc' ? 'selected' : ''}>Model # (A → Z)</option>
              <option value="model-desc" ${sortBy === 'model-desc' ? 'selected' : ''}>Model # (Z → A)</option>
              <option value="brand-asc" ${sortBy === 'brand-asc' ? 'selected' : ''}>Brand (A → Z)</option>
              <option value="price-low" ${sortBy === 'price-low' ? 'selected' : ''}>Price (Low → High)</option>
              <option value="price-high" ${sortBy === 'price-high' ? 'selected' : ''}>Price (High → Low)</option>
              <option value="ats-high" ${sortBy === 'ats-high' ? 'selected' : ''}>ATS Available (High → Low)</option>
              <option value="ats-low" ${sortBy === 'ats-low' ? 'selected' : ''}>ATS Available (Low → High)</option>
              <option value="date-desc" ${sortBy === 'date-desc' ? 'selected' : ''}>Upload Date (Newest)</option>
            </select>
          </div>

          <div class="im-view-toggles">
            <button class="im-view-btn ${viewMode === 'table' ? 'active' : ''}" id="im-toggle-table" type="button" title="Dense Table View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <button class="im-view-btn ${viewMode === 'cards' ? 'active' : ''}" id="im-toggle-cards" type="button" title="Enhanced 4-Column Grid View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </button>
          </div>

          <button class="im-filters-btn" id="im-filters-btn" type="button" title="Advanced filter toggles">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            <span>Filters</span>
            <span class="im-filters-badge">2</span>
          </button>
        </div>

        <!-- Row 2: Status Chips + Price Filters -->
        <div class="im-toolbar-bottom">
          <div class="im-status-chips" role="tablist" aria-label="Catalog Status Filter">
            <button class="im-status-chip ${selectedStatus === 'all' ? 'active' : ''}" data-status="all" type="button">
              All Items (${allRecords.length})
            </button>
            <button class="im-status-chip ${selectedStatus.toLowerCase() === 'live' ? 'active' : ''}" data-status="Live" type="button">
              <span class="im-chip-dot live">●</span> Live (${liveCount})
            </button>
            <button class="im-status-chip ${selectedStatus.toLowerCase() === 'fashion' ? 'active' : ''}" data-status="fashion" type="button">
              <span class="im-chip-dot fashion">●</span> Fashion (${fashionCount})
            </button>
            <button class="im-status-chip ${selectedStatus.toLowerCase() === 'internal use' ? 'active' : ''}" data-status="internal use" type="button">
              <span class="im-chip-dot internal">●</span> Internal Use (${internalCount})
            </button>
            <button class="im-status-chip ${selectedStatus.toLowerCase() === 'presentation' ? 'active' : ''}" data-status="presentation" type="button">
              <span class="im-chip-dot presentation">●</span> Presentation (${presentationCount})
            </button>
          </div>

          <div class="im-price-toolbar">
            <span class="im-price-label">Price:</span>
            <button class="im-price-chip ${priceTier === 'all' ? 'active' : ''}" data-tier="all" type="button">All</button>
            <button class="im-price-chip ${priceTier === 'under50' ? 'active' : ''}" data-tier="under50" type="button">&lt; $50</button>
            <button class="im-price-chip ${priceTier === '50-150' ? 'active' : ''}" data-tier="50-150" type="button">$50 – $150</button>
            <button class="im-price-chip ${priceTier === '150-300' ? 'active' : ''}" data-tier="150-300" type="button">$150 – $300</button>
            <button class="im-price-chip ${priceTier === '300plus' ? 'active' : ''}" data-tier="300plus" type="button">$300+</button>

            <div class="im-price-inputs">
              <span class="im-price-currency">$</span>
              <input type="number" class="im-price-input" id="im-min-price" placeholder="Min" value="${esc(minPrice)}" min="0" step="10">
              <span class="im-price-currency">– $</span>
              <input type="number" class="im-price-input" id="im-max-price" placeholder="Max" value="${esc(maxPrice)}" min="0" step="10">
              <button class="im-price-apply-btn" id="im-apply-price" type="button">Apply</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Sub-Bar -->
      <div class="im-subbar">
        <div class="im-subbar-count">
          Showing <strong>${filtered.length}</strong> of <strong>${allRecords.length}</strong> items
        </div>
        <div class="im-subbar-controls">
          <span class="im-subbar-view-label">View:</span>
          <select class="im-subbar-select" id="im-subbar-view-select">
            <option value="all">All items</option>
            <option value="8">8 per page</option>
            <option value="16">16 per page</option>
          </select>
          <div class="im-pagination-arrows">
            <button class="im-page-arrow" disabled type="button" aria-label="Previous page">‹</button>
            <button class="im-page-arrow" type="button" aria-label="Next page">›</button>
          </div>
        </div>
      </div>
    `;

    // 4-Column Enhanced Cards Grid View or Dense Table View
    if (viewMode === 'cards') {
      html += `
        <div class="im-cards-grid">
          ${filtered.length === 0 ? `
            <div class="im-empty-card" style="grid-column: 1 / -1; background:#ffffff; border-radius:14px; padding:48px 20px; border:1px solid #e2e8f0; text-align:center">
              <h3>No items match your filter criteria</h3>
              <p style="color:#64748b; margin:8px 0 16px">Try resetting filters or adjusting search keywords.</p>
              <button class="im-btn-action" id="im-empty-reset" type="button">Reset All Filters</button>
            </div>
          ` : filtered.map(item => {
            const svg = productSVGs[item.sku] || fallbackProductSVG;
            const onOrder = Number(item.onOrder) || 0;
            const onHold = Number(item.onHold) || 0;
            const available = Number(item.totalATS) || 0;
            const isMenuOpen = activeMenuSku === item.sku;

            return `
              <div class="im-product-card" data-sku="${esc(item.sku)}">
                <!-- 1. Top Split: Left Image, Right Details -->
                <div class="im-card-top-split">
                  <div class="im-card-image-box">
                    ${svg}
                  </div>

                  <div class="im-card-meta-col">
                    <div class="im-card-header-line">
                      ${getStatusBadgeHtml(item.status)}
                      <button class="im-card-kebab-btn" data-more="${esc(item.sku)}" type="button" title="More options" aria-haspopup="true">⋮</button>
                    </div>

                    <h3 class="im-card-product-title" title="${esc(item.title)}">${esc(item.title)}</h3>
                    <div class="im-card-subline">${esc(item.brand)} &nbsp;|&nbsp; ${esc(item.model)}</div>
                    <div class="im-card-sku-line">SKU: ${esc(item.sku)}</div>

                    <div class="im-card-tags-row">
                      ${(item.tags || []).map(t => `<span class="im-card-tag">${esc(t)}</span>`).join('')}
                    </div>

                    <div class="im-card-price-bottom">
                      <span class="im-card-product-price">${money(item.standardPrice)}</span>
                    </div>
                  </div>
                </div>

                <!-- 2. Middle 3-Cell KPI Metrics Row -->
                <div class="im-card-kpi-row">
                  <!-- On Order (Blue) -->
                  <div class="im-kpi-cell blue">
                    <div class="im-kpi-icon-wrap blue">
                      <svg class="im-kpi-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    </div>
                    <div class="im-kpi-text-wrap">
                      <span class="im-kpi-title">On Order</span>
                      <strong class="im-kpi-number">${num(onOrder)}</strong>
                      <span class="im-kpi-po">${esc(item.poNumber || 'PO: —')}</span>
                    </div>
                  </div>

                  <!-- On Hold (Amber) -->
                  <div class="im-kpi-cell amber">
                    <div class="im-kpi-icon-wrap amber">
                      <svg class="im-kpi-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <div class="im-kpi-text-wrap">
                      <span class="im-kpi-title">On Hold</span>
                      <strong class="im-kpi-number">${num(onHold)}</strong>
                    </div>
                  </div>

                  <!-- Available (Green) -->
                  <div class="im-kpi-cell green">
                    <div class="im-kpi-icon-wrap green">
                      <svg class="im-kpi-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 10.5 10.5 13.5 16.5 7.5"/></svg>
                    </div>
                    <div class="im-kpi-text-wrap">
                      <span class="im-kpi-title">Available</span>
                      <strong class="im-kpi-number">${num(available)}</strong>
                    </div>
                  </div>
                </div>

                <!-- 3. Warehouse Breakdown Stacked List -->
                <div class="im-card-wh-section">
                  <div class="im-card-wh-heading">Inventory by Warehouse</div>
                  <div class="im-card-wh-list">
                    ${(item.warehouses || []).slice(0, 3).map(w => `
                      <a href="${S.url('warehouse-management/inventory-bins.html?sku=' + encodeURIComponent(item.sku))}" class="im-wh-row" title="View warehouse stock and bin locations">
                        <div class="im-wh-row-left">
                          <svg class="im-wh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                          <span class="im-wh-title">${esc(w.name)}</span>
                        </div>
                        <div class="im-wh-row-right">
                          <span class="im-wh-qty">${num(w.ats)}</span>
                          <span class="im-wh-chevron">›</span>
                        </div>
                      </a>
                    `).join('')}
                  </div>
                </div>

                <!-- 4. Card Bottom Actions -->
                <div class="im-card-actions">
                  <button class="im-card-more-btn" data-more="${esc(item.sku)}" type="button" title="More options" aria-haspopup="true">···</button>
                  <button class="im-card-edit-btn" data-edit="${esc(item.sku)}" type="button">Edit</button>

                  ${isMenuOpen ? `
                    <div class="im-card-menu">
                      <button type="button" class="im-card-menu-item" data-quick-status="${esc(item.sku)}" data-val="Live">● Set to Live</button>
                      <button type="button" class="im-card-menu-item" data-quick-status="${esc(item.sku)}" data-val="fashion">● Set to Fashion</button>
                      <button type="button" class="im-card-menu-item" data-quick-status="${esc(item.sku)}" data-val="internal use">● Set to Internal Use</button>
                      <button type="button" class="im-card-menu-item" data-quick-status="${esc(item.sku)}" data-val="presentation">● Set to Presentation</button>
                      <hr style="margin:4px 0; border:none; border-top:1px solid #e2e8f0">
                      <a href="${S.url('warehouse-management/inventory-bins.html?sku=' + encodeURIComponent(item.sku))}" class="im-card-menu-item">📦 View Warehouse Bins</a>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      // Dense Table View
      html += `
        <div class="im-table-wrapper">
          <table class="im-data-table" id="im-main-table">
            <thead>
              <tr>
                <th style="width:160px">Model # / SKU</th>
                <th style="width:130px">Brand</th>
                <th style="min-width:240px">Title / Product Description</th>
                <th style="width:140px">Status</th>
                <th style="width:120px">Standard Price</th>
                <th style="width:180px">Available (ATS)</th>
                <th style="min-width:260px">Warehouse Breakdown</th>
                <th style="width:100px;text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="8" class="im-empty-row">
                    <div class="im-empty-state">
                      <h3>No catalog items found</h3>
                      <button class="im-btn-action" id="im-empty-reset" type="button">Clear All Filters</button>
                    </div>
                  </td>
                </tr>
              ` : filtered.map(item => `
                <tr data-sku="${esc(item.sku)}">
                  <td class="im-model-cell">
                    <strong class="im-model-badge">${esc(item.model)}</strong>
                    <code class="im-sku-code">${esc(item.sku)}</code>
                  </td>
                  <td class="im-brand-cell">
                    <span class="im-brand-badge">${esc(item.brand)}</span>
                  </td>
                  <td class="im-title-cell">
                    <div class="im-product-title">${esc(item.title)}</div>
                    <small class="im-product-meta">${(item.tags || []).join(' · ')}</small>
                  </td>
                  <td class="im-status-cell">
                    ${getStatusBadgeHtml(item.status)}
                  </td>
                  <td class="im-price-cell">
                    <strong>${money(item.standardPrice)}</strong>
                    ${item.cost > 0 ? `<small class="im-cost-sub">Cost: ${money(item.cost)}</small>` : ''}
                  </td>
                  <td class="im-ats-column">
                    <div class="im-ats-metric ${item.totalATS > 20 ? 'ats-healthy' : item.totalATS > 0 ? 'ats-warning' : 'ats-danger'}">
                      <strong>${num(item.totalATS)}</strong>
                      <span>units ATS</span>
                    </div>
                    <div class="im-ats-upload-stamp">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span>${esc(formatDate(item.uploadedAt))}</span>
                    </div>
                  </td>
                  <td class="im-wh-column">
                    <div class="im-wh-matrix">
                      ${(item.warehouses || []).map(w => `
                        <div class="im-wh-pill ${w.ats > 0 ? 'primary-wh' : ''}">
                          <span>${esc(w.name)}</span>
                          <b>${num(w.ats)} ATS</b>
                        </div>
                      `).join('')}
                    </div>
                  </td>
                  <td class="im-actions-cell" style="text-align:right">
                    <button class="im-btn-action" data-edit="${esc(item.sku)}" type="button" style="padding:4px 10px; font-size:12px">Edit</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    root.innerHTML = html;
    bindEvents(allRecords, filtered);
  }

  function bindEvents(allRecords, filtered) {
    // Search input
    const searchInput = document.querySelector('#im-search-input');
    if (searchInput) {
      searchInput.oninput = e => {
        query = e.target.value;
        render();
        const next = document.querySelector('#im-search-input');
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      };
    }

    const clearSearch = document.querySelector('#im-clear-search-btn');
    if (clearSearch) {
      clearSearch.onclick = () => {
        query = '';
        render();
      };
    }

    // Brand filter
    const brandSelect = document.querySelector('#im-brand-select');
    if (brandSelect) {
      brandSelect.onchange = e => {
        selectedBrand = e.target.value;
        render();
      };
    }

    // Warehouse filter
    const whSelect = document.querySelector('#im-warehouse-select');
    if (whSelect) {
      whSelect.onchange = e => {
        selectedWarehouse = e.target.value;
        render();
      };
    }

    // Sort select
    const sortSelect = document.querySelector('#im-sort-select');
    if (sortSelect) {
      sortSelect.onchange = e => {
        sortBy = e.target.value;
        render();
      };
    }

    // Status chips
    document.querySelectorAll('.im-status-chip').forEach(chip => {
      chip.onclick = () => {
        selectedStatus = chip.dataset.status;
        render();
      };
    });

    // Price tier chips
    document.querySelectorAll('.im-price-chip').forEach(chip => {
      chip.onclick = () => {
        priceTier = chip.dataset.tier;
        minPrice = '';
        maxPrice = '';
        render();
      };
    });

    // Price range inputs
    const applyPriceBtn = document.querySelector('#im-apply-price');
    if (applyPriceBtn) {
      applyPriceBtn.onclick = () => {
        minPrice = document.querySelector('#im-min-price').value.trim();
        maxPrice = document.querySelector('#im-max-price').value.trim();
        priceTier = 'all';
        render();
      };
    }

    // Reset filters
    const resetBtn = document.querySelector('#im-empty-reset');
    if (resetBtn) {
      resetBtn.onclick = () => {
        query = '';
        selectedBrand = 'all';
        selectedStatus = 'all';
        selectedWarehouse = 'all';
        minPrice = '';
        maxPrice = '';
        priceTier = 'all';
        sortBy = 'model-asc';
        render();
      };
    }

    // View toggles
    const toggleTable = document.querySelector('#im-toggle-table');
    const toggleCards = document.querySelector('#im-toggle-cards');
    if (toggleTable) {
      toggleTable.onclick = () => {
        viewMode = 'table';
        activeMenuSku = null;
        render();
      };
    }
    if (toggleCards) {
      toggleCards.onclick = () => {
        viewMode = 'cards';
        activeMenuSku = null;
        render();
      };
    }

    // Card more buttons (both kebab and triple dots)
    document.querySelectorAll('[data-more]').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        const sku = btn.dataset.more;
        activeMenuSku = activeMenuSku === sku ? null : sku;
        render();
      };
    });

    // Close menu on click elsewhere
    document.addEventListener('click', e => {
      if (activeMenuSku && !e.target.closest('.im-card-actions, .im-card-header-line')) {
        activeMenuSku = null;
        render();
      }
    }, { once: true });

    // Quick status changes from more menu
    document.querySelectorAll('[data-quick-status]').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        const sku = btn.dataset.quickStatus;
        const val = btn.dataset.val;
        activeMenuSku = null;
        changeStatusQuickly(sku, val);
      };
    });

    // Edit item buttons
    document.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => {
        const sku = btn.dataset.edit;
        const item = allRecords.find(x => x.sku === sku);
        if (item) openEditItemModal(item);
      };
    });

    // Add item button
    const addBtn = document.querySelector('#im-btn-add');
    if (addBtn) addBtn.onclick = () => { window.location.href = 'add-item.html'; };

    // ATS Upload button
    const atsUploadBtn = document.querySelector('#im-btn-ats-upload');
    if (atsUploadBtn) atsUploadBtn.onclick = () => openAtsUploadModal(selectedBrand !== 'all' ? selectedBrand : '');

    // Price Update button
    const priceUpdateBtn = document.querySelector('#im-btn-price-update');
    if (priceUpdateBtn) priceUpdateBtn.onclick = () => openPriceUpdateModal(selectedBrand !== 'all' ? selectedBrand : '');

    // Export CSV button
    const exportBtn = document.querySelector('#im-btn-export');
    if (exportBtn) exportBtn.onclick = () => exportCSV(filtered);
  }

  // Helper to reliably detect browser page reload / refresh
  function isPageReload() {
    try {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries && navEntries.length > 0) {
        return navEntries[0].type === 'reload';
      }
      if (window.performance && window.performance.navigation) {
        return window.performance.navigation.type === 1;
      }
    } catch (err) {}
    return false;
  }

  // Initialization & URL action trigger
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const toastMsg = sessionStorage.getItem('stark-toast-msg');
      if (toastMsg) {
        sessionStorage.removeItem('stark-toast-msg');
        setTimeout(() => notice(toastMsg), 250);
      }
    } catch (err) {}

    render();

    // NEVER auto-open any action modal on page refresh / reload
    if (isPageReload()) {
      try {
        sessionStorage.removeItem('stark-action-intent');
      } catch (err) {}
      return;
    }

    // Only open if there was an explicit intent or fresh unconsumed action
    if (initialAction) {
      const consumedKey = 'stark-action-consumed:' + initialAction;
      let hasIntent = false;
      try {
        const intent = sessionStorage.getItem('stark-action-intent');
        sessionStorage.removeItem('stark-action-intent');
        hasIntent = intent === initialAction;
      } catch (err) {}

      let alreadyConsumed = false;
      try {
        alreadyConsumed = !!sessionStorage.getItem(consumedKey);
      } catch (err) {}

      if (hasIntent || !alreadyConsumed) {
        try {
          sessionStorage.setItem(consumedKey, '1');
        } catch (err) {}

        if (initialAction === 'new') {
          setTimeout(openAddItemModal, 300);
        } else if (initialAction === 'ats-upload') {
          setTimeout(() => openAtsUploadModal(initialActionBrand), 300);
        } else if (initialAction === 'price-update') {
          setTimeout(() => openPriceUpdateModal(initialActionBrand), 300);
        }
      }
    }
  });

  window.addEventListener('stark:system-change', () => {
    if (!document.querySelector('.sys-modal-backdrop')) {
      render();
    }
  });

  window.addEventListener('stark:region-change', render);

  // Global export
  window.StarkItemMaster = {
    render,
    openAddItemModal,
    openAtsUploadModal,
    openPriceUpdateModal,
    exportCSV
  };
})();
