/**
 * MK97 SUPPLY CHAIN PLATFORM STUDIO & CONFIGURATION ENGINE
 * Universal, Industry-Agnostic Enterprise Operating System
 * Enables real-time customization to any business, vertical, market, or ERP ecosystem.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'sci.platform.config.v2';

  const INDUSTRY_PRESETS = {
    retail_ecommerce: {
      id: 'retail_ecommerce',
      name: 'Retail & Omnichannel E-Commerce',
      badge: 'B2C / Omnichannel',
      icon: '🛍️',
      description: 'Optimized for high-velocity SKU catalogs, DTC fulfillment, marketplace syndication, and return logistics.',
      primaryColor: '#087f78',
      accentColor: '#0ea5e9',
      terms: {
        item: 'SKU / Product',
        customer: 'Customer / Buyer',
        order: 'Sales Order (DTC/B2B)',
        location: 'Fulfillment Center'
      },
      recommendedModules: ['itemMaster', 'planning', 'crm', 'orders', 'shipping', 'warehouse', 'tpl', 'analytics']
    },
    discrete_manufacturing: {
      id: 'discrete_manufacturing',
      name: 'Discrete & Process Manufacturing',
      badge: 'OEM / Industrial',
      icon: '🏭',
      description: 'BOM hierarchies, production work centers, supplier lead-time variance, and Kanban raw-material replenishment.',
      primaryColor: '#1e3a8a',
      accentColor: '#3b82f6',
      terms: {
        item: 'Part Number / Material',
        customer: 'OEM / Distributor',
        order: 'Production / Customer PO',
        location: 'Plant / Assembly Staging'
      },
      recommendedModules: ['itemMaster', 'planning', 'orders', 'vendor', 'procurement', 'warehouse', 'transportation', 'analytics']
    },
    tpl_logistics: {
      id: 'tpl_logistics',
      name: '3PL & Multi-Tenant Logistics',
      badge: 'Third-Party Logistics',
      icon: '🚚',
      description: 'Multi-client inventory segmentation, cross-dock routing, EDI 940/945 order feeds, and freight billing.',
      primaryColor: '#0f766e',
      accentColor: '#14b8a6',
      terms: {
        item: 'Client SKU / Barcode',
        customer: 'Brand Account',
        order: 'Fulfillment Transmission',
        location: 'Cross-Dock / Staging Bay'
      },
      recommendedModules: ['warehouse', 'tpl', 'transportation', 'orders', 'shipping', 'vendor', 'analytics']
    },
    food_beverage: {
      id: 'food_beverage',
      name: 'Cold Chain, Food & Beverage',
      badge: 'Cold Chain / Perishables',
      icon: '🍏',
      description: 'FEFO lot rotation, shelf-life expiration countdowns, real-time temperature breach telemetry, and rapid mock recalls.',
      primaryColor: '#047857',
      accentColor: '#10b981',
      terms: {
        item: 'Batch / Lot Code',
        customer: 'Grocery / Wholesaler',
        order: 'Distribution Order',
        location: 'Cold Storage Vault'
      },
      recommendedModules: ['itemMaster', 'planning', 'procurement', 'warehouse', 'transportation', 'shipping', 'analytics']
    },
    pharma_lifesciences: {
      id: 'pharma_lifesciences',
      name: 'Pharmaceuticals & Life Sciences',
      badge: 'GxP / Regulated',
      icon: '💊',
      description: 'DSCSA serialization, 21 CFR Part 11 audit trails, electronic signatures, temperature mapping, and quarantine release.',
      primaryColor: '#4338ca',
      accentColor: '#6366f1',
      terms: {
        item: 'NDC / Serialized Compound',
        customer: 'Hospital / Pharmacy',
        order: 'Controlled Release Order',
        location: 'Validated GxP Suite'
      },
      recommendedModules: ['itemMaster', 'planning', 'procurement', 'warehouse', 'vendor', 'analytics', 'data']
    },
    high_tech: {
      id: 'high_tech',
      name: 'High-Tech, Electronics & Aerospace',
      badge: 'Electronics / Aerospace',
      icon: '⚡',
      description: 'Component lifecycle obsolescence, revision management, dual-sourcing matrices, and ITAR/export compliance.',
      primaryColor: '#0284c7',
      accentColor: '#38bdf8',
      terms: {
        item: 'Component / Rev SKU',
        customer: 'Contract Mfg / Tier-1',
        order: 'Build Schedule PO',
        location: 'Cleanroom / Warehouse'
      },
      recommendedModules: ['itemMaster', 'planning', 'vendor', 'procurement', 'warehouse', 'orders', 'analytics']
    },
    automotive: {
      id: 'automotive',
      name: 'Automotive & Heavy Equipment',
      badge: 'Just-in-Time / JIS',
      icon: '🚗',
      description: 'Just-In-Time (JIT) / Just-In-Sequence (JIS), OEM release schedules, container return loops, and EDI 830/862 integration.',
      primaryColor: '#b45309',
      accentColor: '#f59e0b',
      terms: {
        item: 'Assembly Part / Tag',
        customer: 'OEM Assembly Plant',
        order: 'JIT Release / Call-Off',
        location: 'Sequencing Center'
      },
      recommendedModules: ['itemMaster', 'orders', 'procurement', 'vendor', 'shipping', 'transportation', 'warehouse', 'analytics']
    }
  };

  const DEFAULT_CONFIG = {
    brandName: 'MK97 ERP',
    brandSubtitle: 'Supply Chain Intelligence',
    brandWordmark: 'SK',
    brandLogoUrl: '',
    industry: 'retail_ecommerce',
    themeMode: 'light',
    uiDensity: 'comfortable',
    activeRole: 'executive',
    primaryColor: '#087f78',
    accentColor: '#0ea5e9',
    terms: {
      item: 'SKU / Product',
      customer: 'Customer / Buyer',
      order: 'Sales Order',
      location: 'Fulfillment Center'
    },
    enabledModules: [
      'itemMaster', 'planning', 'crm', 'orders', 'vendor',
      'procurement', 'shipping', 'warehouse', 'tpl', 'transportation',
      'analytics', 'data'
    ]
  };

  const store=window.StarkWorkspace?.localStorage||window.localStorage;
  const string=(value,fallback,limit)=>typeof value==='string'&&value.trim()?value.trim().slice(0,limit):fallback;
  const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value))?value:fallback;
  function normalize(config) {
    const next={...DEFAULT_CONFIG,...config};
    return {
      ...next,
      brandName:string(next.brandName,DEFAULT_CONFIG.brandName,64),
      brandSubtitle:string(next.brandSubtitle,DEFAULT_CONFIG.brandSubtitle,100),
      brandWordmark:string(next.brandWordmark,DEFAULT_CONFIG.brandWordmark,12).replace(/[^\p{L}\p{N}]/gu,'').slice(0,3).toUpperCase()||'SK',
      industry:Object.hasOwn(INDUSTRY_PRESETS,next.industry)?next.industry:DEFAULT_CONFIG.industry,
      themeMode:next.themeMode==='dark'?'dark':'light',
      uiDensity:next.uiDensity==='compact'?'compact':'comfortable',
      activeRole:['executive','planner','logistics','procurement'].includes(next.activeRole)?next.activeRole:DEFAULT_CONFIG.activeRole,
      primaryColor:color(next.primaryColor,DEFAULT_CONFIG.primaryColor),
      accentColor:color(next.accentColor,DEFAULT_CONFIG.accentColor),
      terms:Object.fromEntries(Object.entries(DEFAULT_CONFIG.terms).map(([key,value])=>[key,string(next.terms?.[key],value,40)])),
      enabledModules:DEFAULT_CONFIG.enabledModules.filter(id=>!Array.isArray(next.enabledModules)||next.enabledModules.includes(id))
    };
  }

  function loadConfig() {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return normalize(parsed);
      }
    } catch (_) {}
    return normalize({});
  }

  let currentConfig = loadConfig();

  function saveConfig(updates) {
    currentConfig = normalize({...currentConfig,...updates});
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
    } catch (_) {}
    applyConfigToDom();
    window.dispatchEvent(new CustomEvent('sci:config-changed', { detail: currentConfig }));
    return currentConfig;
  }

  function applyConfigToDom() {
    const root = document.documentElement;
    if (!root) return;

    // 1. CSS Theme Variables
    root.style.setProperty('--sc-brand-primary', currentConfig.primaryColor);
    root.style.setProperty('--sc-brand-accent', currentConfig.accentColor);
    root.setAttribute('data-sci-theme', currentConfig.themeMode);
    root.setAttribute('data-sci-density', currentConfig.uiDensity);
    root.setAttribute('data-sci-industry', currentConfig.industry);
    root.setAttribute('data-sci-role', currentConfig.activeRole);

    // 2. Brand texts in Header
    const brandTitle = document.querySelector('.system-brand-text b');
    if (brandTitle) brandTitle.textContent = currentConfig.brandName;

    const brandSub = document.querySelector('.system-brand-text small');
    if (brandSub) brandSub.textContent = currentConfig.brandSubtitle;

    const wordmark = document.querySelector('.system-wordmark');
    if (wordmark && currentConfig.brandWordmark) {
      const mark=document.createElement('span');mark.textContent='◆';wordmark.replaceChildren(currentConfig.brandWordmark,mark);
      wordmark.style.backgroundColor=currentConfig.primaryColor;
    }

    // 3. Document Title Brand Suffix
    if (document.title && !document.title.includes(currentConfig.brandName)) {
      document.title = document.title.replace(/MK97 ERP|Stark ERP/g, currentConfig.brandName);
    }
  }

  function applyPreset(presetId) {
    const preset = INDUSTRY_PRESETS[presetId];
    if (!preset) return;

    saveConfig({
      industry: presetId,
      terms: {...preset.terms}
    });
  }

  // Ensure DOM updates immediately upon script execution and on ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyConfigToDom);
  } else {
    applyConfigToDom();
  }

  window.MK97Platform = window.StarkPlatform = {
    getConfig: () => normalize(currentConfig),
    saveConfig,
    applyPreset,
    getIndustryPresets: () => INDUSTRY_PRESETS,
    getPreset: id => INDUSTRY_PRESETS[id] || INDUSTRY_PRESETS.retail_ecommerce,
    getIndustryPreset: id => INDUSTRY_PRESETS[id] || INDUSTRY_PRESETS.retail_ecommerce,
    resetToDefaults: () => {
      store.removeItem(STORAGE_KEY);
      currentConfig = normalize({});
      applyConfigToDom();
      window.dispatchEvent(new CustomEvent('sci:config-changed', { detail: currentConfig }));
      return currentConfig;
    }
  };
})();
