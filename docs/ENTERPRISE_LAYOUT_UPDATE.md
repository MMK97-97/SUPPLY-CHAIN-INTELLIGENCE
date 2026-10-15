# Enterprise layout — v48

The approved reference is applied to the existing multi-page system through one shared shell. The left navigation is dark, the header is compact, and the control tower has a port hero, six KPI cards, regional fulfillment graphic, activity chart, stock-health donut, supplier PO bars, exceptions and a record register. Existing module pages use the shared shell and retain their forms and workflows.

The dashboard uses existing records and the selected region. Report inventory takes priority when a regional report is connected. Matching imported models use their current reservation-aware operations balances; other models retain the report snapshot. Metrics distinguish current stock/open commitments from dated activity. Delivery performance needs recorded delivery dates; absent data displays an unavailable value. Credit currencies are kept separate. The regional graphic shows supported workspace regions and SKU counts. It does not claim carrier tracking positions. Demo workspaces stay visibly marked as sample records.

Period and chart-series controls are functional. Inventory health opens filtered SKU rows. The record tabs retain order-stage views, supplier POs, shipment records, inventory health, vendor exceptions and upcoming event POs with their linked customer-order route. Search stays limited to order/vendor/procurement screens. 3PL and transportation remain separate.

On dashboard screens at least 1380px wide, the existing MK analyst docks beside the main workspace with Chat, Insights and Actions tabs and execution queues below it. The minimize control expands the dashboard; the header AI button restores the same panel and conversation. Smaller screens use the full-width dashboard with the existing overlay analyst. Resizing preserves the panel. Other module screens keep the overlay and the dedicated analyst workspace keeps its original embedded panel.

The UI adapter moves the original analyst DOM node and calls its existing public actions. It does not change inference, report calculations, region isolation, conversation history, voice, cancellation or the Hugging Face connector. Draft/order/tracking shortcuts open the existing workflows. No order or supplier transaction is executed automatically by the new layout.

The existing port background and logo are reused. Charts and regional illustration are native SVG/CSS and require no new chart dependency. Keyboard tab navigation, accessible controls, focus restoration, declared contrast, reduced motion and responsive breakpoints are included. Tests are source/DOM checks; rendered desktop/mobile layouts still require a browser check.

Publish the whole source bundle to main / root using Deploy from a branch. Keep .nojekyll and the removed custom workflows as configured. The release is 2026.10.12-unified-enterprise-layout48 with layout cache version 20261012-1. It has not been published remotely by this request.
