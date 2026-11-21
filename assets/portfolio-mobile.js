(function(){
  'use strict';
  const S=window.StarkSystem;if(!S)return;
  function init(){
    if(!document.querySelector('.system-header')||document.querySelector('.portfolio-mobile-nav'))return;
    const nav=document.createElement('nav');nav.className='portfolio-mobile-nav';nav.setAttribute('aria-label','Mobile workspace navigation');
    const routes=[['workspace.html','Overview','home'],['order-management/index.html','Orders','orders'],['warehouse-management/index.html','Stock','warehouse'],['mk-brain.html','Analyst','data']];
    const gridIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
    nav.innerHTML=routes.map(([route,label,icon])=>`<a href="${S.url(route)}" ${location.pathname===new URL(route,S.rootURL).pathname?'aria-current="page"':''}>${window.StarkSystemUI.glyph(icon)}<span>${label}</span></a>`).join('')+`<button type="button" aria-label="Open all modules and nested pages" aria-controls="mobile-modules-sheet" aria-expanded="false">${gridIcon}<span>More</span></button>`;
    document.body.append(nav);
    const more=nav.querySelector('button');

    function createModuleSheet() {
      const allGroups = window.StarkModuleNavigation?.groups ? window.StarkModuleNavigation.groups() : [];
      const backdrop = document.createElement('div');
      backdrop.className = 'mobile-modules-sheet-backdrop';
      backdrop.id = 'mobile-modules-sheet';
      backdrop.hidden = true;

      backdrop.innerHTML = `
        <div class="mobile-modules-sheet" role="dialog" aria-modal="true" aria-label="ERP Modules and Nested Pages">
          <div class="mobile-sheet-header">
            <div class="mobile-sheet-title-group">
              <h3>ERP Modules &amp; Pages</h3>
              <p>12 Modules · Direct System Access</p>
            </div>
            <button type="button" class="mobile-sheet-close" aria-label="Close menu">×</button>
          </div>

          <div class="mobile-sheet-quick-actions">
            <a href="${S.url('workspace.html')}" class="mobile-sheet-quick-btn"><span>🏠</span> Overview</a>
            <a href="${S.url('create-order.html')}" class="mobile-sheet-quick-btn"><span>📦</span> Create Order</a>
            <a href="${S.url('create-vendor-po.html')}" class="mobile-sheet-quick-btn"><span>📋</span> Create PO</a>
            <a href="${S.url('scan.html')}" class="mobile-sheet-quick-btn"><span>📷</span> Scan</a>
            <a href="${S.url('mail.html')}" class="mobile-sheet-quick-btn"><span>✉️</span> Mail</a>
            <a href="${S.url('tasks.html')}" class="mobile-sheet-quick-btn"><span>✅</span> Tasks</a>
          </div>

          <div class="mobile-sheet-list">
            ${allGroups.map(([id, label, subtitle, color, items, primaryUrl]) => `
              <details class="mobile-sheet-group" style="--grp-accent:${color}">
                <summary class="mobile-sheet-summary">
                  <span class="mobile-sheet-grp-icon" style="background:${color}">${window.StarkSystemUI?.glyph ? window.StarkSystemUI.glyph(id) : ''}</span>
                  <div class="mobile-sheet-grp-titles">
                    <strong>${label}</strong>
                    <small>${subtitle}</small>
                  </div>
                  <span class="mobile-sheet-badge">${items.length} pages</span>
                  <span class="mobile-sheet-chevron">▾</span>
                </summary>
                <div class="mobile-sheet-nested-links">
                  ${items.map(([path, itemLabel, isHot]) => `
                    <a href="${S.url(path)}" class="mobile-sheet-link ${isHot?'highlighted':''}">
                      <span>${itemLabel}</span>
                      ${isHot?'<span class="module-card-badge">Active</span>':''}
                      <span class="mobile-sheet-arrow">›</span>
                    </a>
                  `).join('')}
                  <a href="${S.url(primaryUrl)}" class="mobile-sheet-primary-link">Launch ${label} ↗</a>
                </div>
              </details>
            `).join('')}
          </div>
        </div>
      `;
      document.body.append(backdrop);

      function openSheet() {
        backdrop.hidden = false;
        document.body.classList.add('mobile-sheet-open');
        more.setAttribute('aria-expanded', 'true');
        backdrop.querySelector('.mobile-sheet-close')?.focus();
      }
      function closeSheet() {
        backdrop.hidden = true;
        document.body.classList.remove('mobile-sheet-open');
        more.setAttribute('aria-expanded', 'false');
        more.focus();
      }

      backdrop.querySelector('.mobile-sheet-close')?.addEventListener('click', closeSheet);
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) closeSheet();
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !backdrop.hidden) closeSheet();
      });

      return { open: openSheet, close: closeSheet, isOpen: () => !backdrop.hidden };
    }

    const sheet = createModuleSheet();
    more.onclick = (e) => {
      e.preventDefault();
      if (sheet.isOpen()) {
        sheet.close();
      } else {
        sheet.open();
      }
    };

    const menu=document.querySelector('.system-menu');if(menu){new MutationObserver(()=>more.setAttribute('aria-expanded',menu.getAttribute('aria-expanded'))).observe(menu,{attributes:true,attributeFilter:['aria-expanded']});}
    // Tables keep every field; keyboard and touch users get an explicit scroll region.
    function tables(){document.querySelectorAll('.table-wrap,.sys-table-wrap,.tower-table-wrap,.table-scroll').forEach(el=>{if(el.dataset.mobileTableReady)return;el.dataset.mobileTableReady='true';el.setAttribute('role','region');el.setAttribute('aria-label','Records table; scroll horizontally for all columns');el.tabIndex=0;});}
    tables();new MutationObserver(tables).observe(document.body,{childList:true,subtree:true});
    document.querySelector('#system-module-tabs a.active')?.scrollIntoView?.({block:'nearest',inline:'center'});
  }
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
