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
      recommendedModules: ['itemMaster', 'planning', 'crm', 'orders', 'shipping', 'warehouse', 'tpl', 'analytics'],
      kpis: [
        { label: 'DTC Fill Rate', value: '99.1%', trend: '+0.4%', status: 'good' },
        { label: 'Return Velocity', value: '4.2%', trend: '-0.8%', status: 'good' },
        { label: 'Days of Supply (DOS)', value: '18.5 Days', trend: 'Balanced', status: 'neutral' },
        { label: 'Marketplace SLA', value: '99.8%', trend: 'Prime Safe', status: 'good' }
      ]
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
      recommendedModules: ['itemMaster', 'planning', 'orders', 'vendor', 'procurement', 'warehouse', 'transportation', 'analytics'],
      kpis: [
        { label: 'BOM Readiness', value: '98.6%', trend: 'Full Kit', status: 'good' },
        { label: 'Work-in-Progress (WIP)', value: '$1.42M', trend: '12 Active Lines', status: 'neutral' },
        { label: 'Supplier Lead Drift', value: '-0.4 Days', trend: 'Ahead', status: 'good' },
        { label: 'Defect PPM', value: '42 PPM', trend: 'Six Sigma', status: 'good' }
      ]
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
      recommendedModules: ['warehouse', 'tpl', 'transportation', 'orders', 'shipping', 'vendor', 'analytics'],
      kpis: [
        { label: 'Cross-Dock Velocity', value: '4.8 Hours', trend: '-1.2h', status: 'good' },
        { label: 'Bay Utilization', value: '87.2%', trend: 'Optimal', status: 'good' },
        { label: 'Active 3PL SLA', value: '98.9%', trend: '+0.5%', status: 'good' },
        { label: 'Outbound ASN Uptime', value: '99.9%', trend: 'All EDI Active', status: 'good' }
      ]
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
      recommendedModules: ['itemMaster', 'planning', 'procurement', 'warehouse', 'transportation', 'shipping', 'analytics'],
      kpis: [
        { label: 'FEFO Compliance', value: '100%', trend: '0 Expiries', status: 'good' },
        { label: 'Shelf Life <15d', value: '1.2%', trend: 'Auto-Discounted', status: 'neutral' },
        { label: 'Temp Breaches', value: '0 Event', trend: 'Ambient 4°C Safe', status: 'good' },
        { label: 'Shelf-Life Retention', value: '94.2%', trend: 'Fresh Priority', status: 'good' }
      ]
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
      recommendedModules: ['itemMaster', 'planning', 'procurement', 'warehouse', 'vendor', 'analytics', 'data'],
      kpis: [
        { label: 'DSCSA Serialized', value: '100%', trend: 'Verified 2D Matrix', status: 'good' },
        { label: 'Quarantine Batches', value: '2 Pending', trend: 'Lab Sampling', status: 'neutral' },
        { label: 'GxP Audit Readiness', value: '99.4%', trend: 'Audit Locked', status: 'good' },
        { label: 'COA Validation', value: 'Instant', trend: 'Chain-of-Custody', status: 'good' }
      ]
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
      recommendedModules: ['itemMaster', 'planning', 'vendor', 'procurement', 'warehouse', 'orders', 'analytics'],
      kpis: [
        { label: 'Dual-Sourcing Ratio', value: '84.5%', trend: '+3.2%', status: 'good' },
        { label: 'Obsolescence Risk', value: 'Low', trend: '6-Mo Buffer', status: 'good' },
        { label: 'Revision Parity', value: '100%', trend: 'ECN Synced', status: 'good' },
        { label: 'Export Control', value: 'Cleared', trend: 'ITAR Verified', status: 'good' }
      ]
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
      recommendedModules: ['itemMaster', 'orders', 'procurement', 'vendor', 'shipping', 'transportation', 'warehouse', 'analytics'],
      kpis: [
        { label: 'JIT Delivery Sync', value: '99.8%', trend: 'Zero Delay', status: 'good' },
        { label: 'Line-Stoppage Risk', value: '0.0%', trend: 'Safety Buffer Safe', status: 'good' },
        { label: 'Returnable Racks', value: '94.2%', trend: 'Loop Active', status: 'good' },
        { label: 'EDI 830 Variance', value: '±1.8%', trend: 'Forecast Stable', status: 'good' }
      ]
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

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Object.assign({}, DEFAULT_CONFIG, parsed);
      }
    } catch (_) {}
    return Object.assign({}, DEFAULT_CONFIG);
  }

  let currentConfig = loadConfig();

  function saveConfig(updates) {
    currentConfig = Object.assign({}, currentConfig, updates);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
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
      wordmark.innerHTML = `${currentConfig.brandWordmark}<span>◆</span>`;
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
      primaryColor: preset.primaryColor,
      accentColor: preset.accentColor,
      terms: Object.assign({}, preset.terms),
      enabledModules: [...preset.recommendedModules]
    });
  }

  // Ensure DOM updates immediately upon script execution and on ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyConfigToDom);
  } else {
    applyConfigToDom();
  }

  window.MK97Platform = window.StarkPlatform = {
    getConfig: () => Object.assign({}, currentConfig),
    saveConfig,
    applyPreset,
    getIndustryPresets: () => INDUSTRY_PRESETS,
    getPreset: id => INDUSTRY_PRESETS[id] || INDUSTRY_PRESETS.retail_ecommerce,
    getIndustryPreset: id => INDUSTRY_PRESETS[id] || INDUSTRY_PRESETS.retail_ecommerce,
    resetToDefaults: () => {
      localStorage.removeItem(STORAGE_KEY);
      currentConfig = Object.assign({}, DEFAULT_CONFIG);
      applyConfigToDom();
      window.dispatchEvent(new CustomEvent('sci:config-changed', { detail: currentConfig }));
      return currentConfig;
    }
  };
})();
