const fs = require('fs');
const path = require('path');

const cssStyles = `
/* ==========================================================================
   SUPPLYCHAINPRO GLOBAL TOP BAR (.scp-top-nav)
   Pixel-perfect match to attached Enterprise Item Master & Item Details
   ========================================================================== */
.scp-top-nav {
  background: #0b1a30 !important;
  color: #ffffff !important;
  height: 52px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 0 24px !important;
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  font-size: 13.5px !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 1000 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
  box-sizing: border-box !important;
}

.scp-left-group {
  display: flex !important;
  align-items: center !important;
  gap: 28px !important;
}

.scp-brand {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  text-decoration: none !important;
  color: #ffffff !important;
}

.scp-brand-icon {
  width: 24px !important;
  height: 24px !important;
  color: #06b6d4 !important;
}

.scp-brand-text {
  font-size: 16px !important;
  font-weight: 700 !important;
  letter-spacing: -0.3px !important;
  color: #ffffff !important;
}

.scp-nav-links {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  list-style: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

.scp-nav-link {
  color: #94a3b8 !important;
  font-size: 13.5px !important;
  font-weight: 500 !important;
  padding: 6px 14px !important;
  border-radius: 6px !important;
  text-decoration: none !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  transition: all 0.15s ease !important;
}

.scp-nav-link svg {
  width: 15px !important;
  height: 15px !important;
  opacity: 0.8 !important;
}

.scp-nav-link:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

.scp-nav-link.active {
  color: #ffffff !important;
  background: #173359 !important;
  font-weight: 600 !important;
}

.scp-right-controls {
  display: flex !important;
  align-items: center !important;
  gap: 16px !important;
}

.scp-search-box {
  background: rgba(255, 255, 255, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  border-radius: 20px !important;
  height: 32px !important;
  width: 260px !important;
  display: flex !important;
  align-items: center !important;
  padding: 0 12px !important;
  gap: 8px !important;
  box-sizing: border-box !important;
}

.scp-search-icon {
  width: 14px !important;
  height: 14px !important;
  color: #7e9bbd !important;
  flex-shrink: 0 !important;
}

.scp-search-input {
  background: transparent !important;
  border: none !important;
  outline: none !important;
  color: #ffffff !important;
  font-size: 12.5px !important;
  width: 100% !important;
}

.scp-search-input::placeholder {
  color: #7e9bbd !important;
}

.scp-icon-btn {
  background: transparent !important;
  border: none !important;
  color: #94a3b8 !important;
  cursor: pointer !important;
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 30px !important;
  height: 30px !important;
  border-radius: 6px !important;
  padding: 0 !important;
  transition: all 0.15s ease !important;
}

.scp-icon-btn:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

.scp-icon-btn svg {
  width: 17px !important;
  height: 17px !important;
}

.scp-badge-dot {
  position: absolute !important;
  top: 4px !important;
  right: 5px !important;
  width: 7px !important;
  height: 7px !important;
  border-radius: 50% !important;
  background: #ef4444 !important;
  border: 1.5px solid #0b1a30 !important;
}

.scp-user-pill {
  display: flex !important;
  align-items: center !important;
  gap: 9px !important;
  cursor: pointer !important;
  padding: 3px 6px !important;
  border-radius: 6px !important;
}

.scp-user-pill:hover {
  background: rgba(255, 255, 255, 0.06) !important;
}

.scp-user-avatar {
  width: 32px !important;
  height: 32px !important;
  border-radius: 50% !important;
  background: #0284c7 !important;
  color: #ffffff !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

.scp-user-info {
  display: flex !important;
  flex-direction: column !important;
  line-height: 1.25 !important;
  text-align: left !important;
}

.scp-user-name {
  font-size: 12.5px !important;
  font-weight: 600 !important;
  color: #ffffff !important;
}

.scp-user-role {
  font-size: 10.5px !important;
  color: #94a3b8 !important;
}

/* ==========================================================================
   ENTERPRISE ITEM MASTER PAGE (.eim-)
   Pixel-perfect match to media_1792540283194_b31b72ce.png
   ========================================================================== */
.eim-page-wrap {
  background: #f4f6fb !important;
  min-height: calc(100vh - 52px) !important;
  padding: 24px 32px 48px !important;
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  color: #0f172a !important;
  box-sizing: border-box !important;
}

.eim-header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  margin-bottom: 20px !important;
}

.eim-header-left {
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
}

.eim-header-icon {
  width: 44px !important;
  height: 44px !important;
  border-radius: 10px !important;
  background: #e0f2fe !important;
  color: #0284c7 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
}

.eim-header-icon svg {
  width: 24px !important;
  height: 24px !important;
}

.eim-title {
  font-size: 22px !important;
  font-weight: 700 !important;
  color: #0f172a !important;
  margin: 0 !important;
  letter-spacing: -0.2px !important;
}

.eim-subtitle {
  font-size: 13px !important;
  color: #64748b !important;
  margin: 3px 0 0 !important;
}

.eim-btn-add {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  background: #0284c7 !important;
  color: #ffffff !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  padding: 9px 18px !important;
  border-radius: 6px !important;
  border: none !important;
  cursor: pointer !important;
  text-decoration: none !important;
  box-shadow: 0 1px 2px rgba(2, 132, 199, 0.2) !important;
  transition: all 0.15s ease !important;
}

.eim-btn-add:hover {
  background: #0369a1 !important;
}

.eim-btn-add svg {
  width: 15px !important;
  height: 15px !important;
}

/* Word Search Card */
.eim-word-search-card {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  padding: 10px 16px !important;
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03) !important;
  margin-bottom: 18px !important;
  box-sizing: border-box !important;
}

.eim-ws-label {
  font-size: 13px !important;
  font-weight: 700 !important;
  color: #1e293b !important;
  display: flex !important;
  align-items: center !important;
  gap: 7px !important;
  white-space: nowrap !important;
}

.eim-ws-label svg {
  width: 16px !important;
  height: 16px !important;
  color: #475569 !important;
}

.eim-ws-input {
  flex: 1 !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  padding: 8px 14px !important;
  font-size: 13px !important;
  color: #0f172a !important;
  outline: none !important;
  box-sizing: border-box !important;
}

.eim-ws-input:focus {
  border-color: #0284c7 !important;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15) !important;
}

.eim-ws-btn-reset {
  background: #ffffff !important;
  border: 1px solid #cbd5e1 !important;
  color: #475569 !important;
  font-size: 12.5px !important;
  font-weight: 600 !important;
  padding: 8px 16px !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
  white-space: nowrap !important;
}

.eim-ws-btn-reset:hover {
  background: #f8fafc !important;
  color: #0f172a !important;
}

.eim-ws-btn-search {
  background: #0284c7 !important;
  border: none !important;
  color: #ffffff !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  padding: 8px 18px !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  white-space: nowrap !important;
  transition: all 0.15s ease !important;
}

.eim-ws-btn-search:hover {
  background: #0369a1 !important;
}

.eim-ws-btn-search svg {
  width: 14px !important;
  height: 14px !important;
}

/* Filter Layout Grid */
.eim-filter-layout {
  display: grid !important;
  grid-template-columns: 1fr 270px !important;
  gap: 16px !important;
  margin-bottom: 20px !important;
  align-items: start !important;
}

.eim-filter-left {
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
}

/* Filter Card Styles */
.eim-card {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 8px !important;
  padding: 12px 16px !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02) !important;
  box-sizing: border-box !important;
}

.eim-card-head {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  cursor: pointer !important;
  user-select: none !important;
  padding-bottom: 8px !important;
  border-bottom: 1px solid #f1f5f9 !important;
  margin-bottom: 10px !important;
}

.eim-card-title {
  font-size: 13px !important;
  font-weight: 700 !important;
  color: #1e293b !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.eim-card-title svg {
  width: 15px !important;
  height: 15px !important;
  color: #0284c7 !important;
}

.eim-card-chevron {
  color: #94a3b8 !important;
  font-size: 11px !important;
  transition: transform 0.2s ease !important;
}

.eim-card.collapsed .eim-card-body {
  display: none !important;
}

.eim-card.collapsed .eim-card-chevron {
  transform: rotate(180deg) !important;
}

.eim-form-row-4 {
  display: grid !important;
  grid-template-columns: repeat(4, 1fr) !important;
  gap: 12px !important;
  margin-bottom: 10px !important;
}

.eim-form-row-3 {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr) !important;
  gap: 12px !important;
  margin-bottom: 10px !important;
}

.eim-form-row-5 {
  display: grid !important;
  grid-template-columns: repeat(5, 1fr) !important;
  gap: 10px !important;
}

.eim-field {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
}

.eim-field-label {
  font-size: 11.5px !important;
  font-weight: 600 !important;
  color: #475569 !important;
}

.eim-input {
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  padding: 6px 10px !important;
  font-size: 12.5px !important;
  color: #0f172a !important;
  background: #ffffff !important;
  outline: none !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

.eim-input:focus {
  border-color: #0284c7 !important;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.12) !important;
}

.eim-select {
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  padding: 6px 10px !important;
  font-size: 12.5px !important;
  color: #0f172a !important;
  background: #ffffff !important;
  outline: none !important;
  width: 100% !important;
  box-sizing: border-box !important;
  cursor: pointer !important;
}

.eim-input-prefix-wrap {
  display: flex !important;
  align-items: center !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  background: #ffffff !important;
  overflow: hidden !important;
}

.eim-input-prefix {
  padding: 0 8px !important;
  font-size: 12px !important;
  color: #64748b !important;
  font-weight: 600 !important;
  background: #f8fafc !important;
  border-right: 1px solid #e2e8f0 !important;
  height: 29px !important;
  display: flex !important;
  align-items: center !important;
}

.eim-input-prefix-wrap input {
  border: none !important;
  outline: none !important;
  padding: 6px 8px !important;
  font-size: 12.5px !important;
  width: 100% !important;
}

.eim-price-toggle-group {
  display: flex !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  overflow: hidden !important;
  width: fit-content !important;
  margin-top: 2px !important;
}

.eim-price-toggle-btn {
  padding: 5px 14px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  border: none !important;
  cursor: pointer !important;
  background: #f1f5f9 !important;
  color: #475569 !important;
}

.eim-price-toggle-btn.active {
  background: #0284c7 !important;
  color: #ffffff !important;
}

/* Visibility & Status Card */
.eim-vis-grid {
  display: grid !important;
  grid-template-columns: 140px 1fr 1fr !important;
  gap: 16px !important;
  align-items: start !important;
}

.eim-toggles-col {
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
}

.eim-toggle-label {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-size: 12px !important;
  color: #334155 !important;
  cursor: pointer !important;
  user-select: none !important;
}

.eim-switch {
  position: relative !important;
  display: inline-block !important;
  width: 30px !important;
  height: 16px !important;
  flex-shrink: 0 !important;
}

.eim-switch input {
  opacity: 0 !important;
  width: 0 !important;
  height: 0 !important;
}

.eim-slider {
  position: absolute !important;
  cursor: pointer !important;
  inset: 0 !important;
  background-color: #cbd5e1 !important;
  border-radius: 20px !important;
  transition: 0.2s !important;
}

.eim-slider::before {
  position: absolute !important;
  content: "" !important;
  height: 12px !important;
  width: 12px !important;
  left: 2px !important;
  bottom: 2px !important;
  background-color: white !important;
  border-radius: 50% !important;
  transition: 0.2s !important;
}

.eim-switch input:checked + .eim-slider {
  background-color: #0284c7 !important;
}

.eim-switch input:checked + .eim-slider::before {
  transform: translateX(14px) !important;
}

/* Customer & Event Filters Card */
.eim-cust-filters-grid {
  display: grid !important;
  grid-template-columns: 2fr 1fr !important;
  gap: 16px !important;
  align-items: start !important;
}

.eim-cust-selects-row {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr) !important;
  gap: 12px !important;
}

/* Brands Sidebar */
.eim-brands-card {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 8px !important;
  padding: 12px 14px !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02) !important;
  box-sizing: border-box !important;
}

.eim-brands-head {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  margin-bottom: 10px !important;
}

.eim-brands-title {
  font-size: 13px !important;
  font-weight: 700 !important;
  color: #1e293b !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.eim-brands-title svg {
  width: 15px !important;
  height: 15px !important;
  color: #0284c7 !important;
}

.eim-brands-select-all {
  font-size: 12px !important;
  font-weight: 600 !important;
  color: #0284c7 !important;
  text-decoration: none !important;
  cursor: pointer !important;
}

.eim-brands-select-all:hover {
  text-decoration: underline !important;
}

.eim-brands-search {
  position: relative !important;
  margin-bottom: 10px !important;
}

.eim-brands-search input {
  width: 100% !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  padding: 6px 10px 6px 28px !important;
  font-size: 12px !important;
  outline: none !important;
  box-sizing: border-box !important;
}

.eim-brands-search-icon {
  position: absolute !important;
  left: 8px !important;
  top: 7px !important;
  color: #94a3b8 !important;
  pointer-events: none !important;
  width: 13px !important;
  height: 13px !important;
}

.eim-brands-list {
  max-height: 380px !important;
  overflow-y: auto !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 5px !important;
  padding-right: 4px !important;
}

.eim-brand-item {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-size: 12px !important;
  color: #334155 !important;
  cursor: pointer !important;
  padding: 3px 4px !important;
  border-radius: 4px !important;
  user-select: none !important;
}

.eim-brand-item:hover {
  background: #f8fafc !important;
}

.eim-brand-item input[type="checkbox"] {
  accent-color: #0284c7 !important;
  cursor: pointer !important;
}

/* Metrics Summary Row (4 KPI Cards) */
.eim-metrics-grid {
  display: grid !important;
  grid-template-columns: repeat(4, 1fr) !important;
  gap: 16px !important;
  margin-bottom: 20px !important;
}

.eim-metric-card {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  padding: 14px 18px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03) !important;
  box-sizing: border-box !important;
}

.eim-metric-left {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}

.eim-metric-icon-wrap {
  width: 40px !important;
  height: 40px !important;
  border-radius: 10px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.eim-metric-icon-wrap svg {
  width: 20px !important;
  height: 20px !important;
}

.eim-metric-icon-wrap.blue { background: #e0f2fe !important; color: #0284c7 !important; }
.eim-metric-icon-wrap.green { background: #dcfce7 !important; color: #16a34a !important; }
.eim-metric-icon-wrap.purple { background: #f3e8ff !important; color: #9333ea !important; }
.eim-metric-icon-wrap.yellow { background: #fef9c3 !important; color: #ca8a04 !important; }

.eim-metric-label {
  font-size: 12px !important;
  font-weight: 600 !important;
  color: #64748b !important;
}

.eim-metric-val {
  font-size: 22px !important;
  font-weight: 800 !important;
  color: #0f172a !important;
  line-height: 1.1 !important;
  margin-top: 2px !important;
}

.eim-metric-right {
  text-align: right !important;
}

.eim-metric-trend {
  font-size: 11.5px !important;
  font-weight: 700 !important;
  color: #16a34a !important;
  display: flex !important;
  align-items: center !important;
  gap: 3px !important;
  justify-content: flex-end !important;
}

.eim-metric-trend-sub {
  font-size: 10.5px !important;
  color: #94a3b8 !important;
  margin-top: 2px !important;
}

/* Search Results Card & Table */
.eim-results-card {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  overflow: hidden !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03) !important;
}

.eim-results-head {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding: 12px 18px !important;
  border-bottom: 1px solid #e2e8f0 !important;
  background: #ffffff !important;
}

.eim-results-title {
  font-size: 13px !important;
  font-weight: 700 !important;
  color: #1e293b !important;
}

.eim-results-controls {
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
}

.eim-per-page-wrap {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  font-size: 12px !important;
  color: #64748b !important;
}

.eim-per-page-select {
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  padding: 4px 8px !important;
  font-size: 12px !important;
  color: #334155 !important;
  outline: none !important;
  background: #fff !important;
  cursor: pointer !important;
}

.eim-pagination {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}

.eim-page-btn {
  min-width: 28px !important;
  height: 28px !important;
  border: 1px solid #e2e8f0 !important;
  background: #ffffff !important;
  color: #334155 !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  border-radius: 4px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 6px !important;
}

.eim-page-btn:hover {
  background: #f1f5f9 !important;
}

.eim-page-btn.active {
  background: #0284c7 !important;
  color: #ffffff !important;
  border-color: #0284c7 !important;
}

.eim-table-wrap {
  width: 100% !important;
  overflow-x: auto !important;
}

.eim-table {
  width: 100% !important;
  border-collapse: collapse !important;
  font-size: 12.5px !important;
  text-align: left !important;
}

.eim-table th {
  background: #f8fafc !important;
  color: #475569 !important;
  font-weight: 600 !important;
  padding: 10px 12px !important;
  border-bottom: 1px solid #e2e8f0 !important;
  white-space: nowrap !important;
  font-size: 11.5px !important;
}

.eim-table td {
  padding: 10px 12px !important;
  border-bottom: 1px solid #f1f5f9 !important;
  color: #1e293b !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

.eim-table tbody tr {
  transition: background 0.12s ease !important;
}

.eim-table tbody tr:hover {
  background: #f8fafc !important;
}

.eim-item-cell {
  display: flex !important;
  flex-direction: column !important;
  gap: 2px !important;
}

.eim-item-title-link {
  color: #0284c7 !important;
  font-weight: 600 !important;
  text-decoration: none !important;
  cursor: pointer !important;
}

.eim-item-title-link:hover {
  text-decoration: underline !important;
}

.eim-item-subtitle {
  color: #64748b !important;
  font-size: 11px !important;
}

.eim-table-thumb {
  width: 36px !important;
  height: 36px !important;
  border-radius: 6px !important;
  border: 1px solid #e2e8f0 !important;
  background: #f8fafc !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
}

.eim-table-thumb svg {
  width: 28px !important;
  height: 28px !important;
}

.eim-status-badge {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  font-size: 11.5px !important;
  font-weight: 600 !important;
  color: #16a34a !important;
}

.eim-status-dot {
  width: 6px !important;
  height: 6px !important;
  border-radius: 50% !important;
  background: #16a34a !important;
}

.eim-action-menu-btn {
  background: transparent !important;
  border: none !important;
  color: #94a3b8 !important;
  cursor: pointer !important;
  font-size: 16px !important;
  padding: 4px 8px !important;
  border-radius: 4px !important;
}

.eim-action-menu-btn:hover {
  background: #f1f5f9 !important;
  color: #0f172a !important;
}

/* ==========================================================================
   ITEM DETAILS PAGE (.id-)
   Pixel-perfect match to media_1792540258777_6929dafd.png
   ========================================================================== */
.id-page-wrap {
  background: #f4f6fb !important;
  min-height: calc(100vh - 52px) !important;
  padding: 18px 32px 48px !important;
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  color: #0f172a !important;
  box-sizing: border-box !important;
}

.id-breadcrumb {
  font-size: 12.5px !important;
  color: #64748b !important;
  margin-bottom: 14px !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.id-breadcrumb a {
  color: #0284c7 !important;
  text-decoration: none !important;
}

.id-breadcrumb a:hover {
  text-decoration: underline !important;
}

.id-breadcrumb-sep {
  color: #94a3b8 !important;
}

.id-breadcrumb-current {
  color: #1e293b !important;
  font-weight: 600 !important;
}

/* Header with Title and Actions */
.id-header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: flex-start !important;
  margin-bottom: 16px !important;
}

.id-header-left {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
}

.id-title-row {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  flex-wrap: wrap !important;
}

.id-title {
  font-size: 26px !important;
  font-weight: 800 !important;
  color: #0f172a !important;
  margin: 0 !important;
  letter-spacing: -0.3px !important;
}

.id-pill {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 3px 10px !important;
  border-radius: 12px !important;
  font-size: 11.5px !important;
  font-weight: 600 !important;
  line-height: 1.2 !important;
}

.id-pill.active { background: #ecfdf5 !important; color: #059669 !important; }
.id-pill.core { background: #eff6ff !important; color: #2563eb !important; }
.id-pill.stock { background: #f0fdfa !important; color: #0d9488 !important; }

.id-subtitle {
  font-size: 14px !important;
  color: #475569 !important;
  margin: 0 !important;
}

.id-header-actions {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.id-btn-dup {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  background: #ffffff !important;
  border: 1px solid #cbd5e1 !important;
  color: #0284c7 !important;
  font-size: 12.5px !important;
  font-weight: 600 !important;
  padding: 7px 14px !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
}

.id-btn-dup:hover {
  background: #f8fafc !important;
}

.id-btn-dup svg {
  width: 14px !important;
  height: 14px !important;
}

.id-btn-edit {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  background: #0284c7 !important;
  border: none !important;
  color: #ffffff !important;
  font-size: 12.5px !important;
  font-weight: 600 !important;
  padding: 7px 16px !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
}

.id-btn-edit:hover {
  background: #0369a1 !important;
}

.id-btn-edit svg {
  width: 14px !important;
  height: 14px !important;
}

.id-btn-icon {
  background: #ffffff !important;
  border: 1px solid #cbd5e1 !important;
  color: #475569 !important;
  padding: 7px 10px !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.id-btn-icon:hover {
  background: #f8fafc !important;
  color: #0f172a !important;
}

.id-pager-group {
  display: flex !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  overflow: hidden !important;
  background: #ffffff !important;
}

.id-pager-btn {
  background: transparent !important;
  border: none !important;
  padding: 7px 11px !important;
  color: #475569 !important;
  cursor: pointer !important;
  font-size: 13px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.id-pager-btn:hover {
  background: #f1f5f9 !important;
  color: #0f172a !important;
}

.id-pager-btn:first-child {
  border-right: 1px solid #e2e8f0 !important;
}

/* Product Hero Box */
.id-hero-card {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  padding: 16px 20px !important;
  margin-bottom: 16px !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03) !important;
  display: grid !important;
  grid-template-columns: 240px 1fr !important;
  gap: 24px !important;
  align-items: center !important;
  box-sizing: border-box !important;
}

.id-hero-gallery {
  display: flex !important;
  gap: 10px !important;
  align-items: center !important;
}

.id-hero-main-img {
  width: 150px !important;
  height: 130px !important;
  border-radius: 8px !important;
  border: 1px solid #e2e8f0 !important;
  background: #f8fafc !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
  padding: 6px !important;
  box-sizing: border-box !important;
}

.id-hero-main-img svg {
  max-width: 100% !important;
  max-height: 100% !important;
}

.id-hero-thumbs-stack {
  display: flex !important;
  flex-direction: column !important;
  gap: 6px !important;
}

.id-hero-thumb-item {
  width: 38px !important;
  height: 38px !important;
  border-radius: 6px !important;
  border: 1px solid #cbd5e1 !important;
  background: #f8fafc !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  overflow: hidden !important;
  padding: 2px !important;
  box-sizing: border-box !important;
}

.id-hero-thumb-item svg {
  width: 26px !important;
  height: 26px !important;
}

.id-hero-thumb-item.active {
  border-color: #0284c7 !important;
  box-shadow: 0 0 0 1.5px #0284c7 !important;
}

.id-hero-specs {
  display: grid !important;
  grid-template-columns: repeat(5, 1fr) !important;
  gap: 14px 18px !important;
}

.id-spec-cell {
  display: flex !important;
  flex-direction: column !important;
  gap: 3px !important;
}

.id-spec-label {
  font-size: 11px !important;
  font-weight: 600 !important;
  color: #64748b !important;
}

.id-spec-val {
  font-size: 13px !important;
  font-weight: 700 !important;
  color: #0f172a !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.id-spec-val .copy-icon {
  color: #94a3b8 !important;
  cursor: pointer !important;
  font-size: 12px !important;
}

.id-spec-val .copy-icon:hover {
  color: #0284c7 !important;
}

.id-color-dot {
  width: 10px !important;
  height: 10px !important;
  border-radius: 50% !important;
  background: #111827 !important;
  display: inline-block !important;
  vertical-align: middle !important;
}

/* Tab Navigation Bar (17 Tabs) */
.id-tabs-bar {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 8px !important;
  margin-bottom: 16px !important;
  display: flex !important;
  overflow-x: auto !important;
  padding: 0 6px !important;
  scrollbar-width: none !important;
}

.id-tabs-bar::-webkit-scrollbar {
  display: none !important;
}

.id-tab-btn {
  background: transparent !important;
  border: none !important;
  padding: 12px 14px !important;
  font-size: 12.5px !important;
  font-weight: 600 !important;
  color: #64748b !important;
  cursor: pointer !important;
  white-space: nowrap !important;
  position: relative !important;
  transition: all 0.15s ease !important;
}

.id-tab-btn:hover {
  color: #0f172a !important;
}

.id-tab-btn.active {
  color: #0284c7 !important;
  font-weight: 700 !important;
}

.id-tab-btn.active::after {
  position: absolute !important;
  bottom: 0 !important;
  left: 10px !important;
  right: 10px !important;
  height: 2.5px !important;
  background-color: #0284c7 !important;
  content: "" !important;
  border-radius: 2px !important;
}

/* Two Column Layout for Main Tab */
.id-main-layout {
  display: grid !important;
  grid-template-columns: 58% 42% !important;
  gap: 16px !important;
  margin-bottom: 16px !important;
  align-items: start !important;
}

.id-left-col {
  display: flex !important;
  flex-direction: column !important;
  gap: 16px !important;
}

.id-right-col {
  display: flex !important;
  flex-direction: column !important;
  gap: 16px !important;
}

/* Shared Card Styles */
.id-card {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  padding: 16px !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03) !important;
  box-sizing: border-box !important;
}

.id-card-title {
  font-size: 14.5px !important;
  font-weight: 700 !important;
  color: #0f172a !important;
  margin: 0 0 14px !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.id-card-title svg {
  width: 16px !important;
  height: 16px !important;
  color: #0284c7 !important;
}

/* Left Form Grid */
.id-form-grid-2 {
  display: grid !important;
  grid-template-columns: repeat(2, 1fr) !important;
  gap: 12px 20px !important;
}

.id-form-col {
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
}

.id-field {
  display: flex !important;
  flex-direction: column !important;
  gap: 3px !important;
}

.id-field-label {
  font-size: 11.5px !important;
  font-weight: 600 !important;
  color: #475569 !important;
}

.id-input {
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  padding: 6px 10px !important;
  font-size: 12.5px !important;
  color: #0f172a !important;
  background: #ffffff !important;
  outline: none !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

.id-input:read-only, .id-input:disabled {
  background: #f8fafc !important;
  color: #64748b !important;
}

.id-input:focus {
  border-color: #0284c7 !important;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.12) !important;
}

.id-select {
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  padding: 6px 10px !important;
  font-size: 12.5px !important;
  color: #0f172a !important;
  background: #ffffff !important;
  outline: none !important;
  width: 100% !important;
  box-sizing: border-box !important;
  cursor: pointer !important;
}

.id-input-date-wrap {
  position: relative !important;
}

.id-input-date-wrap input {
  padding-right: 28px !important;
}

.id-input-date-icon {
  position: absolute !important;
  right: 8px !important;
  top: 7px !important;
  color: #94a3b8 !important;
  pointer-events: none !important;
  width: 14px !important;
  height: 14px !important;
}

.id-toggle-row {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding: 3px 0 !important;
}

.id-toggle-label {
  font-size: 12px !important;
  font-weight: 500 !important;
  color: #334155 !important;
}

/* Stock & Availability Card */
.id-stock-container {
  display: grid !important;
  grid-template-columns: 140px 1fr !important;
  gap: 16px !important;
  align-items: start !important;
}

.id-stock-kpi-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 6px !important;
  border-right: 1px solid #f1f5f9 !important;
  padding-right: 12px !important;
}

.id-stock-kpi-row {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  font-size: 11.5px !important;
}

.id-stock-kpi-row span {
  color: #64748b !important;
  font-weight: 500 !important;
}

.id-stock-kpi-row strong {
  color: #0f172a !important;
  font-weight: 700 !important;
}

.id-wh-table-wrap {
  width: 100% !important;
  overflow-x: auto !important;
}

.id-wh-table {
  width: 100% !important;
  border-collapse: collapse !important;
  font-size: 12px !important;
  text-align: left !important;
}

.id-wh-table th {
  background: #f8fafc !important;
  color: #475569 !important;
  font-weight: 600 !important;
  padding: 6px 8px !important;
  border-bottom: 1px solid #e2e8f0 !important;
}

.id-wh-table td {
  padding: 6px 8px !important;
  border-bottom: 1px solid #f1f5f9 !important;
  color: #1e293b !important;
}

.id-wh-legend {
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
  margin-top: 10px !important;
  padding-top: 8px !important;
  border-top: 1px solid #f1f5f9 !important;
  font-size: 11px !important;
  color: #64748b !important;
  grid-column: 1 / -1 !important;
}

.id-legend-item {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}

.id-legend-dot {
  width: 6px !important;
  height: 6px !important;
  border-radius: 50% !important;
}

.id-legend-dot.green { background: #16a34a !important; }
.id-legend-dot.blue { background: #2563eb !important; }
.id-legend-dot.orange { background: #f59e0b !important; }
.id-legend-dot.gray { background: #94a3b8 !important; }

/* Product Images Card */
.id-images-row {
  display: flex !important;
  gap: 10px !important;
  align-items: center !important;
  flex-wrap: wrap !important;
}

.id-img-card {
  width: 68px !important;
  height: 68px !important;
  border-radius: 8px !important;
  border: 1px solid #cbd5e1 !important;
  background: #f8fafc !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  position: relative !important;
  cursor: pointer !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

.id-img-card svg {
  max-width: 80% !important;
  max-height: 80% !important;
}

.id-img-card.selected {
  border: 2px solid #0284c7 !important;
}

.id-img-grip {
  position: absolute !important;
  top: 3px !important;
  left: 3px !important;
  color: #94a3b8 !important;
  font-size: 9px !important;
  line-height: 1 !important;
}

.id-img-add-btn {
  width: 68px !important;
  height: 68px !important;
  border-radius: 8px !important;
  border: 1.5px dashed #cbd5e1 !important;
  background: #ffffff !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 3px !important;
  color: #0284c7 !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
  box-sizing: border-box !important;
}

.id-img-add-btn:hover {
  border-color: #0284c7 !important;
  background: #f0f9ff !important;
}

.id-img-add-btn svg {
  width: 16px !important;
  height: 16px !important;
}

.id-images-caption {
  font-size: 11px !important;
  color: #94a3b8 !important;
  margin-top: 8px !important;
}

/* Quick Info Card */
.id-quick-grid {
  display: grid !important;
  grid-template-columns: repeat(2, 1fr) !important;
  gap: 8px 16px !important;
}

.id-quick-row {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  font-size: 11.5px !important;
}

.id-quick-label {
  color: #64748b !important;
  font-weight: 500 !important;
}

.id-quick-val {
  color: #0f172a !important;
  font-weight: 700 !important;
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}

/* Bottom Title/Description Card */
.id-desc-card {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  padding: 16px !important;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03) !important;
  box-sizing: border-box !important;
}

.id-desc-field {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
  margin-bottom: 12px !important;
}

.id-desc-textarea {
  width: 100% !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  padding: 10px 12px !important;
  font-size: 12.5px !important;
  color: #0f172a !important;
  outline: none !important;
  box-sizing: border-box !important;
  min-height: 70px !important;
  resize: vertical !important;
  font-family: inherit !important;
}

.id-desc-textarea:focus {
  border-color: #0284c7 !important;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.12) !important;
}

.id-char-counter {
  font-size: 11px !important;
  color: #94a3b8 !important;
  text-align: right !important;
  margin-top: 4px !important;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .eim-filter-layout { grid-template-columns: 1fr !important; }
  .eim-metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
  .id-main-layout { grid-template-columns: 1fr !important; }
  .id-hero-card { grid-template-columns: 1fr !important; }
  .id-hero-specs { grid-template-columns: repeat(3, 1fr) !important; }
}
`;

const targetFile = path.resolve(__dirname, '..', 'enterprise-layout.css');
const assetFile = path.resolve(__dirname, '..', 'assets', 'enterprise-layout.css');

let content = fs.readFileSync(targetFile, 'utf8');
if (!content.includes('.scp-top-nav')) {
  content += '\n' + cssStyles;
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('Appended styles to enterprise-layout.css');
} else {
  console.log('Styles already present in enterprise-layout.css');
}

fs.writeFileSync(assetFile, fs.readFileSync(targetFile));
console.log('Synchronized to assets/enterprise-layout.css');
