(() => {
  "use strict";

  if (window.__STARK_MOBILE_SHELL__) return;
  window.__STARK_MOBILE_SHELL__ = true;

  const mobile = window.matchMedia("(max-width: 820px)");
  let observedRail = null;
  let railObserver = null;
  let touchStartX = 0;
  let touchStartY = 0;

  const setExpanded = (group, parent, expanded) => {
    group.classList.toggle("mobile-open", expanded);
    parent.setAttribute("aria-expanded", String(expanded));
  };

  const enhanceNestedNavigation = rail => {
    if (!rail || rail.dataset.mobileNestedReady === "true") return;
    const group = rail.querySelector(".premium-nav-group");
    const parent = group?.querySelector(".premium-nav-parent");
    const submenu = group?.querySelector(".premium-nav-submenu");
    if (!group || !parent || !submenu) return;

    rail.dataset.mobileNestedReady = "true";
    submenu.id ||= "mobile-inventory-submenu";
    parent.setAttribute("role", "button");
    parent.setAttribute("tabindex", "0");
    parent.setAttribute("aria-controls", submenu.id);
    const hasActiveChild = Boolean(submenu.querySelector("a.active, a[aria-current='page']"));
    setExpanded(group, parent, hasActiveChild);

    if (!parent.querySelector(".mobile-nest-chevron")) {
      parent.insertAdjacentHTML("beforeend", '<svg class="mobile-nest-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');
    }

    const toggle = event => {
      if (!mobile.matches) return;
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      setExpanded(group, parent, !group.classList.contains("mobile-open"));
    };
    parent.addEventListener("click", toggle);
    parent.addEventListener("keydown", toggle);

    rail.addEventListener("touchstart", event => {
      if (!mobile.matches || event.touches.length !== 1) return;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    }, { passive: true });
    rail.addEventListener("touchend", event => {
      if (!mobile.matches || !event.changedTouches.length) return;
      const deltaX = event.changedTouches[0].clientX - touchStartX;
      const deltaY = event.changedTouches[0].clientY - touchStartY;
      if (deltaX < -65 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) closeRail();
    }, { passive: true });
  };

  const closeRail = () => {
    document.body?.classList.remove("premium-rail-open");
    document.querySelector(".premium-rail-toggle")?.setAttribute("aria-expanded", "false");
  };

  const restoreDesktopNavigation = rail => {
    const group = rail?.querySelector(".premium-nav-group");
    const parent = group?.querySelector(".premium-nav-parent");
    group?.classList.remove("mobile-open");
    parent?.removeAttribute("role");
    parent?.removeAttribute("tabindex");
    parent?.removeAttribute("aria-controls");
    parent?.removeAttribute("aria-expanded");
    parent?.querySelector(".mobile-nest-chevron")?.remove();
    if (rail) delete rail.dataset.mobileNestedReady;
  };

  const syncMode = () => {
    document.documentElement.classList.toggle("stark-mobile-app", mobile.matches);
    const rail = document.querySelector(".premium-side-rail");
    if (!mobile.matches) {
      closeRail();
      restoreDesktopNavigation(rail);
      observedRail = rail;
      railObserver?.disconnect();
      return;
    }
    const nestedParent = rail?.querySelector(".premium-nav-parent");
    if (rail && (rail !== observedRail || !nestedParent?.querySelector(".mobile-nest-chevron"))) {
      observedRail = rail;
      delete rail.dataset.mobileNestedReady;
      enhanceNestedNavigation(rail);
      railObserver?.disconnect();
    }
  };

  const initialize = () => {
    syncMode();
    if (!document.querySelector(".premium-side-rail")) {
      railObserver = new MutationObserver(syncMode);
      railObserver.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener("click", event => {
      if (!mobile.matches || !document.body.classList.contains("premium-rail-open")) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".premium-side-rail, .premium-rail-toggle")) return;
      closeRail();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && mobile.matches) closeRail();
    });
    if (mobile.addEventListener) mobile.addEventListener("change", syncMode);
    else mobile.addListener?.(syncMode);
    window.addEventListener("stark:region-change", () => window.setTimeout(syncMode, 0));
    window.addEventListener("orientationchange", closeRail, { passive: true });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
