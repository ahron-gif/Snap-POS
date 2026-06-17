/**
 * In-product help content map — single source of truth for:
 *
 *   1. The contextual help drawer (HelpDrawer.tsx).
 *   2. The full Help Center page (/help).
 *   3. The chatbot RAG corpus (exported via helpAsJson() and the
 *      /help-topics.json static endpoint — see CHATBOT-INTEGRATION.md).
 *
 * Adding a new topic? Just add an entry to `topics` below. It will show up
 * automatically in the drawer (if a route matches), the Help Center, and the
 * chatbot dataset.
 */

export interface HelpTopic {
  /** Stable identifier — used in URLs (/help?topic=key) and chatbot retrieval. */
  key: string
  title: string
  /** Short summary used in search results and chatbot previews. */
  summary: string
  /** Markdown body. Headings start at H2. */
  body: string
  /** Which Help Center category this topic belongs to. */
  category:
    | "getting-started"
    | "screens"
    | "reports"
    | "how-to"
    | "troubleshooting"
    | "reference"
    | "explanation"
  /** Searchable keywords. Boost the chatbot RAG hit rate. */
  keywords: string[]
  /** App route this topic should auto-open for (if any). */
  route?: string
}

/** Category metadata for the Help Center sidebar. */
export const CATEGORIES: Record<HelpTopic["category"], { label: string; description: string }> = {
  "getting-started": {
    label: "Getting started",
    description: "New here? Start with these.",
  },
  screens: {
    label: "Screens",
    description: "What each page in BackOffice is for and how to use it.",
  },
  reports: {
    label: "Reports",
    description: "Generating, customizing, and exporting reports.",
  },
  "how-to": {
    label: "How-to guides",
    description: "Step-by-step recipes for common tasks.",
  },
  troubleshooting: {
    label: "Troubleshooting",
    description: "Specific errors and how to fix them.",
  },
  reference: {
    label: "Reference",
    description: "Exact field names, endpoints, settings.",
  },
  explanation: {
    label: "Explanation",
    description: "How and why things work the way they do.",
  },
}

/** Master list of help topics. */
export const topics: HelpTopic[] = [
  // ─── Getting started ──────────────────────────────────────────────────────
  {
    key: "what-is-the-print-helper",
    title: "What is the Print Helper?",
    summary: "Quick overview of the local printing service and why it exists.",
    category: "getting-started",
    keywords: ["overview", "intro", "introduction", "what is", "print helper", "agent"],
    body: `The **Print Helper** is a small Windows service that runs in the background on your PC. It lets SmartKart BackOffice send print jobs directly to your local printers — receipts, invoices, barcode labels, shelf tags, and reports — without going through your browser's print dialog.

## How it fits together

The web app at SmartKart cannot reach printers directly — browsers don't allow that. The Print Helper bridges the gap by accepting print requests at \`https://localhost:9443\` on your own PC and forwarding them to the right Windows printer.

## What it doesn't do

- It doesn't print anything by itself — BackOffice drives every print.
- It doesn't connect to the internet — all traffic is local.
- It doesn't install printer drivers — install printers in Windows first.

## Next steps

- New PC? See **Install the Print Helper**.
- Installed but not detecting? See **Agent not detected**.`,
  },
  {
    key: "install-the-print-helper",
    title: "Install the Print Helper",
    summary: "Run the Windows installer on a new PC, set up the service, accept the cert.",
    category: "getting-started",
    keywords: ["install", "installation", "setup", "new pc", "setup.exe", "windows service"],
    body: `Run the installer (\`BackOfficePrintAgentSetup-x.y.z.exe\`) on each PC that needs to print. The installer needs Administrator rights, Windows 10/11 64-bit, and Google Chrome (or Edge).

## Quick steps

1. Get the installer from your administrator or the **Settings → Printer Settings** download link.
2. Double-click. Approve the UAC prompt.
3. **Service Account page** — pick **LocalSystem** unless your printer is on a USB \`DOT4_\` port or installed only under one user.
4. Click **Install**. Takes about 10 seconds.
5. At the end, check **"Open SmartKart BackOffice now"** to confirm everything works.

## What the installer does

- Stops and removes any previous Print Helper service.
- Copies files to \`C:\\Program Files\\BackOffice Print Agent\\\`.
- Registers the \`BackOfficePrintAgent\` Windows service, auto-start at boot.
- Installs the self-signed HTTPS certificate to your machine's trust store.
- Drops a **SmartKart BackOffice** shortcut on the desktop.
- Registers Chrome / Edge Local Network Access permission for the SmartKart URL.`,
  },
  {
    key: "first-print",
    title: "Your first print",
    summary: "Pair the browser, assign printers to documents, and verify with a test print.",
    category: "getting-started",
    keywords: ["first print", "test", "test print", "verify", "setup"],
    body: `After install, do this once per browser on each PC.

## Steps

1. Open SmartKart via the **SmartKart BackOffice** desktop shortcut.
2. Settings → Printer Settings.
3. Click **Pair** in the status strip. It should flip to green.
4. For each document type (Invoice, Receipt, Label, etc.) pick the matching printer from the dropdown.
5. Click **Test print** on a row. A small test page should appear on that printer.

If any test fails, see **Print job fails or no paper comes out**.`,
  },

  // ─── How-to ───────────────────────────────────────────────────────────────
  {
    key: "pair-this-browser",
    title: "Pair this browser",
    summary: "Authorize this browser tab to send prints to the Print Helper.",
    category: "how-to",
    keywords: ["pair", "pairing", "handshake", "authorize", "browser"],
    route: "/settings/printer-settings",
    body: `Pairing is the one-time handshake that authorizes one browser to send prints. The Print Helper stores exactly one paired origin at a time.

## Steps

1. Open Settings → Printer Settings.
2. Click the blue **Pair** button in the status strip.
3. After a second or two, **Pairing** flips to *Paired (https://...)* in green.

## To unpair

Click the red **Unpair** button. Useful when handing the PC to another user.

## When things go wrong

- Amber banner *"paired to a different site"* → click **Re-pair to this browser**.
- *"Pairing reset blocked by the local agent"* → update the Print Helper to the latest version.`,
  },
  {
    key: "map-printers",
    title: "Map printers to document types",
    summary: "Choose which physical printer handles invoices, receipts, labels, etc.",
    category: "how-to",
    keywords: ["map", "printer", "mapping", "assign", "document type", "default", "custom"],
    route: "/settings/printer-settings",
    body: `BackOffice prints seven document types. Each can be assigned to a different printer.

## Default vs. Custom

| Tab | Storage | Who edits |
|---|---|---|
| **Default settings** | Tenant database | Administrators |
| **My custom settings** | Browser local storage | Anyone, this browser only |

Your custom mapping (if any) wins over the default.

## Steps

1. Open Settings → Printer Settings.
2. Pick the tab (**Default settings** if admin; **My custom settings** otherwise).
3. For each row, pick a printer.
4. Click **Test print** to confirm.

## Document types

- **Items List / Reports** — office laser
- **Invoice Printer** — office laser
- **Receipt Printer** — 80mm thermal (ESC/POS)
- **Barcode Label Printer** — Zebra / TSC (ZPL)
- **Shelf Label Printer** — same as barcode or dedicated
- **Statement Printer** — office laser
- **Other Reports** — office laser

## Adding printers manually

If a printer isn't in the dropdown, type its exact Windows name in **Manual printer list** and click **Add printer**.`,
  },
  {
    key: "switch-environment",
    title: "Switch to a new environment (QA → Prod)",
    summary: "For developers: how to repoint the Print Helper at a different SmartKart URL.",
    category: "how-to",
    keywords: ["environment", "qa", "prod", "production", "url", "change", "rebuild", "deploy"],
    body: `For developers and release engineers. The SmartKart URL lives in two places — both must change together.

## Two files to update

1. \`BackOffice.PrintAgent/appsettings.json\` → add the new URL to \`Agent.AllowedOrigins\`.
2. \`BackOffice.PrintAgent/Installer/BackOfficePrintAgent.iss\` → change \`#define SmartKartUrl\` near the top.

## Rebuild

\`\`\`powershell
cd path\\to\\BackOffice.PrintAgent\\Installer
.\\publish.ps1 -BuildInstaller
\`\`\`

Distribute the new \`Output\\BackOfficePrintAgentSetup-*.exe\` to all PCs. The installer upgrades in place — printer settings are preserved.

## What you don't need to change

- The React web app self-adjusts via \`window.location.origin\`.
- The backend API is environment-agnostic.
- \`LaunchSmartKart.vbs\` falls back to its constant only if no argument is passed; the shortcut always passes one.`,
  },
  {
    key: "uninstall",
    title: "Uninstall the Print Helper",
    summary: "Cleanly remove the Print Helper, including registry and config.",
    category: "how-to",
    keywords: ["uninstall", "remove", "delete", "cleanup"],
    body: `Use Windows Settings → Apps to remove cleanly. The uninstaller takes care of the service, shortcut, and Chrome policy entries automatically.

## Steps

1. Windows *Settings → Apps → Installed apps*.
2. Find **BackOffice Print Agent**.
3. Three-dot menu → **Uninstall**. UAC → Yes.
4. About 5 seconds.

## Optional deep clean

The uninstaller leaves \`C:\\ProgramData\\BackOfficePrintAgent\\\` in place (pairing, cert, logs). To wipe it:

\`\`\`powershell
Remove-Item "C:\\ProgramData\\BackOfficePrintAgent" -Recurse -Force
\`\`\`

The self-signed cert in the LocalMachine\\Root trust store also stays — remove via *certlm.msc*.`,
  },

  // ─── Troubleshooting ──────────────────────────────────────────────────────
  {
    key: "agent-not-detected",
    title: "Agent not detected",
    summary: "Status strip shows 'Agent: Not detected' in red. Five possible causes.",
    category: "troubleshooting",
    keywords: ["not detected", "not running", "agent not detected", "service stopped", "ERR_CONNECTION_REFUSED"],
    body: `When the Settings page shows *Agent: Not detected*, the page tried to reach the Print Helper on \`https://localhost:9443\` and got nothing back.

## Quick check

Open a new tab and paste \`https://localhost:9443/health\`.

- **JSON response** → agent is fine, Chrome is blocking the page. See **Chrome is blocking access to loopback**.
- **Cert warning** → click Advanced → Proceed once, then fully restart Chrome.
- **"Site can't be reached"** → service isn't running. See below.

## Service not running

\`\`\`powershell
Get-Service BackOfficePrintAgent
\`\`\`

- *Stopped* → \`Start-Service BackOfficePrintAgent\` (admin shell).
- *Cannot find* → reinstall the Print Helper.

If the service refuses to start, look at the latest log:

\`\`\`powershell
Get-Content "C:\\ProgramData\\BackOfficePrintAgent\\logs\\agent-$(Get-Date -f yyyyMMdd).log" -Tail 50
\`\`\``,
  },
  {
    key: "chrome-blocking-loopback",
    title: "Chrome is blocking access to the loopback address space",
    summary: "Chrome's Local Network Access protection is denying the call. Fix: use the desktop shortcut.",
    category: "troubleshooting",
    keywords: ["chrome", "blocking", "loopback", "lna", "cors", "permission denied", "private network access"],
    body: `Since Chrome 138 (mid-2024), public sites cannot reach loopback addresses (\`localhost\`, \`127.0.0.1\`) without explicit permission. The Print Helper installer ships a shortcut that bypasses this.

## The error

\`\`\`
Access to fetch at 'https://localhost:9443/health' from origin 'https://qa.smartkart.app'
has been blocked by CORS policy: Permission was denied for this request to access the
\`loopback\` address space.
\`\`\`

## Fix in 3 steps

1. **Close every Chrome window** — including any in the system tray. Confirm via Task Manager.
2. Double-click the **SmartKart BackOffice** desktop shortcut. It opens Chrome with LNA enforcement off.
3. Use SmartKart normally — agent is detected, prints work.

## What the shortcut does

It launches Chrome with \`--disable-features=BlockInsecurePrivateNetworkRequests,LocalNetworkAccessChecks\`. Only that window has LNA off; your other Chrome windows still have full enforcement, so your overall security isn't reduced.

## If the shortcut is missing

The installer didn't complete. Reinstall the Print Helper.`,
  },
  {
    key: "pairing-stuck-on-old-origin",
    title: "Print Helper is paired to a different site",
    summary: "Amber banner about a stale pairing. One-click fix.",
    category: "troubleshooting",
    keywords: ["stale", "old origin", "paired to a different site", "re-pair", "wrong site"],
    body: `When you see the amber banner *"This Print Helper is paired to..."*, the agent was paired from a different URL earlier (often a developer's machine). The fix is one click.

## Fix

Click **Re-pair to this browser** in the amber banner. The web app resets the agent and re-pairs from your current origin.

## If the button errors

- *"Pairing reset blocked by the local agent"* → the Print Helper version is too old. Update to the latest installer.
- *"Origin not authorized to reset pairing"* → your SmartKart URL isn't in the agent's allowlist. Get the installer built for your environment.

## Manual workaround (admin PowerShell)

\`\`\`powershell
Stop-Service BackOfficePrintAgent
Remove-Item "$env:PROGRAMDATA\\BackOfficePrintAgent\\pairing.json" -Force
Start-Service BackOfficePrintAgent
\`\`\`

Then reload SmartKart and click **Pair**.`,
  },
  {
    key: "print-job-fails",
    title: "Print job fails or no paper comes out",
    summary: "Agent reports success but nothing prints — or an explicit print error.",
    category: "troubleshooting",
    keywords: ["print fails", "not printing", "no paper", "stuck job", "origin mismatch", "spooler"],
    body: `When prints don't come out, the cause depends on what error you see.

## "Origin mismatch"

The token claims a different origin than the request. Caused by switching environments without re-pairing. **Unpair → Pair** again.

## "Token expired"

Tokens last about 5 minutes. Reload the page and retry. If it keeps happening, check that your PC clock is correct.

## "Printer not found: X"

Windows doesn't know about a printer named *X* — it was renamed, removed, or installed under a different user account. In Windows *Printers & scanners*, verify the name matches. If installed under your user only, re-run the Print Helper installer and pick **Run as a specific user**.

## Success but no paper

The agent sent the job. Find where it is:

\`\`\`powershell
Get-PrintJob -PrinterName "Your printer name"
\`\`\`

If a job is *Error* or *Paused*: the printer is offline / out of paper / jammed. If the queue is empty: maybe the wrong account — see "Printer not found" above.`,
  },

  // ─── Reference ────────────────────────────────────────────────────────────
  {
    key: "settings-page",
    title: "Settings page reference",
    summary: "Every UI element on Settings → Printer Settings.",
    category: "reference",
    keywords: ["settings", "ui reference", "printer settings", "buttons", "controls"],
    route: "/settings/printer-settings",
    body: `Top-down reference for every element on Settings → Printer Settings.

## Status strip

- **Agent** (green/red) — is the Print Helper reachable?
- **Pairing** (green/orange) — is this browser authorized?
- **Refresh** — re-probe.
- **Pair** / **Unpair** — handshake / disconnect.

## Banners (conditional)

- **Red — Chrome blocking loopback** — see *Chrome is blocking access to loopback*.
- **Amber — stale pairing** — see *Print Helper is paired to a different site*.

## Mapping table

Two tabs: **Default settings** (admin, tenant-wide) and **My custom settings** (per-browser overrides). Each row maps one document type to one printer. **Test print** button on each row.

## Manual printer list

Type a printer name that didn't auto-enumerate; it appears in every dropdown.`,
  },
  {
    key: "api-endpoints",
    title: "HTTP API endpoints",
    summary: "Full spec of /health, /pairing, /print, etc. that the agent exposes.",
    category: "reference",
    keywords: ["api", "endpoints", "http", "rest", "/health", "/print", "/pairing"],
    body: `The Print Helper exposes a small REST API on \`https://localhost:9443\`. All HTTPS, all JSON.

## Routes

- **\`GET /health\`** — liveness probe; returns version + paired origin.
- **\`GET /status\`** — extended status with uptime.
- **\`GET /pairing\`** — current pairing state; generates a pairing code if none.
- **\`POST /pairing/handshake\`** — completes pairing; records caller's Origin as paired.
- **\`POST /pairing/reset\`** — clears pairing. Allowed from localhost or any \`AllowedOrigins\` entry.
- **\`GET /printers\`** — enumerates Windows printers on this PC.
- **\`POST /print\`** — submits a print job. Requires \`Authorization: Bearer <jwt>\`.

See the full reference for parameters, response shapes, and rate-limiting details.`,
  },
  {
    key: "configuration-files",
    title: "Configuration files",
    summary: "appsettings.json, pairing.json, cert.pfx, log files — what each field means.",
    category: "reference",
    keywords: ["configuration", "appsettings", "pairing.json", "cert.pfx", "logs"],
    body: `The Print Helper reads / writes files under two folders.

## C:\\Program Files\\BackOffice Print Agent\\

Static install. Contains the EXE, \`appsettings.json\`, SumatraPDF fallback, and the launcher VBS.

## C:\\ProgramData\\BackOfficePrintAgent\\

Runtime state.

- \`pairing.json\` — paired origin, secret, pairing code.
- \`cert.pfx\` — self-signed HTTPS cert (regenerates if expiring).
- \`logs\\agent-YYYYMMDD.log\` — Serilog rolling daily log, 14-day retention.

## appsettings.json highlights

- \`Agent.AllowedOrigins\` — CORS allowlist. Multiple environments can coexist.
- \`Agent.HttpsPort\` — default 9443.
- \`Agent.RateLimit\` — per-IP request limit.`,
  },

  // ─── Explanation ──────────────────────────────────────────────────────────
  {
    key: "architecture-overview",
    title: "Architecture overview",
    summary: "Three layers: web app, local agent, backend API. How they communicate.",
    category: "explanation",
    keywords: ["architecture", "design", "how it works", "system design", "overview"],
    body: `The system has three layers:

1. **SmartKart web app** in the user's browser at \`https://qa.smartkart.app\`.
2. **Print Helper** Windows service on the same PC at \`https://localhost:9443\`.
3. **SmartKart backend** in the cloud.

The browser talks to **both** the backend (business logic) and the local agent (printing). The agent has no outbound connection to the backend — all traffic is local.

## Print flow

1. User clicks Print in the web app.
2. Web app asks backend for a signed print token (JWT, ~5 min).
3. Web app sends document + token to \`POST /print\` on the agent.
4. Agent validates the JWT (signed with the paired secret) and dispatches to Windows.

## Pairing

A four-step handshake exchanges a shared secret between the agent and the backend, tied to the user's account. After pairing, the backend can sign valid print tokens, and the agent can verify them.`,
  },
  {
    key: "why-localhost",
    title: "Why localhost and not a central server?",
    summary: "Browser security forces each PC to have its own local Print Helper.",
    category: "explanation",
    keywords: ["why localhost", "design", "rationale", "central server", "browser limitations"],
    body: `Modern browsers cannot connect to a print server elsewhere on the network. Chrome's LNA enforcement blocks public sites from reaching private addresses.

## What this forces

The Print Helper must be installed on **every PC** that prints, because the browser can only reach a target on the *same physical machine* (loopback).

## Why not a Chrome extension instead?

- Same deployment problem (install per PC).
- Can be disabled by IT policy.
- Adds Chrome Web Store dependency.

## Long-term alternative

An outbound WebSocket from agent → backend would bypass LNA entirely, since the agent makes the connection (not the browser). Bigger architecture change; planned fallback if Chrome ever fully removes the LNA escape hatch.`,
  },
  {
    key: "pairing-security",
    title: "Pairing security model",
    summary: "How the agent decides which prints are legitimate — three barriers.",
    category: "explanation",
    keywords: ["security", "pairing", "jwt", "origin", "secret", "threat model"],
    body: `Three barriers protect the Print Helper from rogue print requests.

## Barrier 1 — CORS allowlist

Only origins listed in \`Agent.AllowedOrigins\` (plus localhost) can even initiate a request. Defense in depth.

## Barrier 2 — Pairing handshake

The agent stores exactly one paired origin and exchanges a 32-byte secret with the backend. After pairing, the backend can issue JWTs; the agent can verify them.

## Barrier 3 — Per-job JWT

Every print request carries an \`Authorization: Bearer <jwt>\`:

- Signed with the paired secret (HMAC-SHA256).
- Expires in ~5 minutes.
- Contains an \`origin\` claim that must match the HTTP Origin header.

## What it defends against

- Rogue websites (Barrier 1).
- Malicious browser extensions replaying tokens (Barrier 3 origin check).
- Token leaks (5-minute expiry).

## What it doesn't defend against

- A compromised backend (would sign legit-looking JWTs).
- An attacker with admin access on the PC.`,
  },
  // ─── Screens: Dashboard ───────────────────────────────────────────────────
  {
    key: "screen-dashboard",
    title: "Dashboard",
    summary: "Your home screen — KPIs, recent activity, and quick links to reports.",
    category: "screens",
    keywords: ["dashboard", "home", "kpi", "overview", "reports", "tabs"],
    route: "/dashboard",
    body: `The Dashboard is your starting point every time you log in. It shows key performance metrics at a glance and gives you fast paths to the rest of the app.

## Tips

- Use the **Reports** button (top-right) to open the Report Manager in a tab.
- The dashboard supports **multiple tabs** — click any sidebar item to open it in a new tab next to the dashboard. Each tab keeps its own state.
- Press **Ctrl+K** to focus the global search.
- Press **F1** anywhere to open the contextual help drawer for the page you're on.

## Common destinations from here

- **Items** → \`Inventory → Item List\`
- **Customers** → \`Customers → Customer List\`
- **Vendor orders** → \`Purchasing → Purchase Orders\`
- **Sales** → \`Register → Transactions\`
- **Printer setup** → \`Settings → Printer Settings\``,
  },

  // ─── Screens: Inventory ───────────────────────────────────────────────────
  {
    key: "screen-items-list",
    title: "Item List",
    summary: "Master list of every item in inventory — search, edit, import, export.",
    category: "screens",
    keywords: ["items", "item list", "inventory", "products", "sku", "barcode"],
    route: "/items-list",
    body: `The Item List is the master record of every SKU in inventory. Add, edit, import, archive, and search items here.

## Tips

- Use the column filters at the top of each column to narrow the list.
- Type in the global search to filter across all visible columns.
- Right-click any row for quick actions (duplicate, archive, view history).
- Select rows with checkboxes to bulk-edit or export.
- Use **Export** in the toolbar to download the visible list as CSV.

## Common tasks

- **Add an item**: click **New Item** in the toolbar. Required fields are highlighted.
- **Bulk-import**: toolbar → Import → choose a CSV. A preview lets you map columns.
- **Print barcode labels**: select rows → **Print labels**. Uses your Barcode Label Printer mapping (configured in Settings → Printer Settings).`,
  },
  {
    key: "screen-items-quick-list",
    title: "Item Quick List",
    summary: "Lightweight, fast-loading view of items for high-volume browsing.",
    category: "screens",
    keywords: ["item quick list", "quick", "fast", "lightweight", "browse"],
    route: "/items-quick-list",
    body: `A stripped-down version of the Item List that loads faster and is meant for rapid lookup. Skips heavy columns (cost, history, attachments) by default.

## When to use

- Looking up an item quickly during a phone call.
- Verifying a price or barcode without needing to edit.
- Working on a slow connection.

For full editing capabilities, use the regular **Item List** instead.`,
  },
  {
    key: "screen-item-groups",
    title: "Item Groups",
    summary: "Group related items (e.g. by hechsher, category, season) for reporting and pricing.",
    category: "screens",
    keywords: ["item groups", "group", "category", "tag", "classify"],
    route: "/item-groups",
    body: `Item Groups let you tag a set of related items so you can apply bulk pricing, run reports, or filter inventory by group.

## Examples

- Hechsher or certification (Kosher, Halal, Organic).
- Seasonal collections (Winter clothing, Holiday décor).
- Promotional bundles.

## Tips

- An item can belong to multiple groups.
- Groups are independent of **Departments**. Departments are typically an item's primary classification; groups are for cross-cutting tags.
- Bulk pricing rules can target a group, so "20% off all Halal items" is one rule, not 80 separate ones.`,
  },
  {
    key: "screen-departments",
    title: "Departments",
    summary: "Top-level item classification (Grocery, Dairy, Electronics, etc.).",
    category: "screens",
    keywords: ["departments", "category", "classification"],
    route: "/departments",
    body: `Departments are the primary classification for an item — typically what shows on receipts as a category total. Each item belongs to exactly one department.

## Tips

- Keep the list short (5–20 entries). Sub-categorization lives in **Item Groups**.
- Department changes affect existing items immediately — no migration step.
- Sales reports break down by department; use thoughtful names.`,
  },
  {
    key: "screen-manufacturers",
    title: "Manufacturers",
    summary: "Brand / manufacturer records linked to items for vendor and reporting use.",
    category: "screens",
    keywords: ["manufacturers", "brand", "vendor"],
    route: "/manufacturers",
    body: `Catalog of manufacturers / brands. Each item can reference one manufacturer. Useful for sourcing, warranty tracking, and brand-level reports.

## Tips

- Don't confuse manufacturer with **Vendor**. Manufacturer = who made it. Vendor = who you buy from. They can be the same or different.
- Merging duplicates (e.g. "P&G" vs "Procter & Gamble") later requires reassigning every item. Keep the list clean from the start.`,
  },
  {
    key: "screen-items-with-inventory",
    title: "Items With Inventory",
    summary: "Items whose stock count is greater than zero — useful for stocktakes.",
    category: "screens",
    keywords: ["inventory", "stock", "on hand", "count", "stocktake"],
    route: "/items-with-inventory",
    body: `Filters the master list to items that currently have on-hand stock. Useful for stocktake printing, value reports, or finding what's actually sellable.

## Tips

- Combine with department or group filters to narrow further.
- Use **Export** to send the list to your stocktake handhelds.`,
  },
  {
    key: "screen-label-designer",
    title: "Label Designer",
    summary: "Design custom barcode and shelf labels visually.",
    category: "screens",
    keywords: ["label", "label designer", "design", "barcode", "shelf label", "zpl", "epl"],
    route: "/label-designer",
    body: `Visual editor for designing label templates that print to your thermal label printers via the Print Helper.

## How it works

- Drop elements (text, barcode, image, line) onto a label canvas sized for your media.
- Bind data fields (item name, price, SKU) to text boxes — they fill in at print time.
- Templates are saved per-tenant and selected when you print labels from the Item List.

## Tips

- Match the canvas size to your physical label stock exactly. Off-by-2mm causes everything to drift.
- Test on real media before bulk-printing — thermal stock varies in heat sensitivity.
- The **Print Helper** must be paired (Settings → Printer Settings) before test prints work.`,
  },
  {
    key: "screen-adjust-inventory",
    title: "Adjust Inventory",
    summary: "Manually correct stock counts for damage, theft, recounts, or transfers.",
    category: "screens",
    keywords: ["adjust", "adjustment", "inventory", "stock", "correction", "shrinkage"],
    route: "/adjust-inventory",
    body: `Make manual stock adjustments. Each adjustment requires a **reason** (Damage, Theft, Recount, Found, Other) for audit trail purposes.

## Tips

- Adjustments are logged — you can see who adjusted what, when, and why, in **Reports → Inventory Adjustment History**.
- For multi-location transfers, use **Stores → Transfers** instead of Adjust Inventory. Transfers preserve the link between the source and destination.
- Bulk adjustment from CSV: toolbar → **Import**.

## Common reasons

- **Damage** — broken or spoiled stock.
- **Theft** — known shrinkage.
- **Recount** — cycle count discovered a discrepancy.
- **Found** — stock turned up that wasn't in the system.`,
  },

  // ─── Screens: Purchasing ──────────────────────────────────────────────────
  {
    key: "screen-vendors-list",
    title: "Vendor List",
    summary: "Suppliers you buy inventory from. Manage contacts, terms, and history.",
    category: "screens",
    keywords: ["vendor", "vendors", "supplier", "ap", "accounts payable"],
    route: "/vendors-list",
    body: `Master list of suppliers. Used by Purchase Orders, Pay Bills, and Return to Vendor screens.

## Tips

- Set **default terms** (Net 30, Net 60, COD) on the vendor — they pre-fill on new POs.
- Vendor IDs are visible in the column toggle if you cross-reference with an external accounting system.
- Disabled vendors are hidden from new-PO pickers but kept in history.`,
  },
  {
    key: "screen-purchase-orders",
    title: "Purchase Orders",
    summary: "Create, send, and track POs to vendors.",
    category: "screens",
    keywords: ["po", "purchase order", "purchase", "buying", "order"],
    route: "/purchase-orders-list",
    body: `Track every PO from creation through receiving. Status column shows: Draft, Sent, Partial, Received, Cancelled.

## Tips

- Click **New PO** to start a fresh order. Pick a vendor first — items default to that vendor's prices.
- Use the duplicate action on a recurring PO instead of recreating it.
- Send a PDF copy via email directly from the row's three-dot menu.

## Receiving workflow

When the goods arrive, go to **Receive Orders** (not back to the PO) to enter quantities received. Partial receives are supported.`,
  },
  {
    key: "screen-receive-orders",
    title: "Receive Orders",
    summary: "Record receipt of PO goods — full or partial quantities.",
    category: "screens",
    keywords: ["receive", "receiving", "receipt", "po", "incoming", "goods received"],
    route: "/receive-orders-list",
    body: `When PO goods arrive at your store, record what came in here. Each receipt updates inventory automatically.

## Tips

- Receive against a PO to keep the chain auditable, not via **Adjust Inventory**.
- Partial receipts are fine — the PO stays open as **Partial** until everything is received or you mark it complete.
- Discrepancies (received 9 of 10) go into the audit log. Open the row to see the variance.`,
  },
  {
    key: "screen-general-order",
    title: "General Order",
    summary: "Non-PO purchases — utilities, services, one-off expenses.",
    category: "screens",
    keywords: ["general order", "expense", "non-po", "service", "utility"],
    route: "/general-order-list",
    body: `For things you pay vendors for that aren't tied to a Purchase Order — rent, electricity, professional services, etc. Creates an AP entry without touching inventory.

## When to use

- Recurring expenses with no inventory implication.
- Service invoices (cleaning, repairs).
- Adjustments to vendor accounts that aren't goods-related.`,
  },
  {
    key: "screen-pay-bills",
    title: "Pay Bills",
    summary: "Process payments to vendors against open invoices.",
    category: "screens",
    keywords: ["pay bills", "payments", "ap", "accounts payable", "vendor payment"],
    route: "/payments-list",
    body: `Apply payments to open vendor invoices. Supports partial payments and splitting one payment across multiple invoices.

## Tips

- Filter by vendor to see all open balances at once.
- Pre-fill payment amount with the **Pay All** quick button on a row.
- Payment methods (Check, ACH, Wire, Card) are configurable in tenant settings.`,
  },
  {
    key: "screen-return-to-vendor",
    title: "Return To Vendor",
    summary: "Send goods back to a vendor — defective, wrong item, overshipment.",
    category: "screens",
    keywords: ["rtv", "return", "vendor return", "credit"],
    route: "/return-to-vendor-list",
    body: `Process returns of received goods back to the vendor. Adjusts inventory down and creates a vendor credit memo.

## Tips

- Always tie a return to the original PO if you can — the audit trail thanks you later.
- Reason codes (Defective, Wrong Item, Overshipment, Other) drive AP credit logic.`,
  },

  // ─── Screens: Customers ───────────────────────────────────────────────────
  {
    key: "screen-customers-list",
    title: "Customer List",
    summary: "Every customer record — contact info, account balance, order history.",
    category: "screens",
    keywords: ["customers", "customer list", "crm", "accounts"],
    route: "/customers-list",
    body: `Master list of customers. Each row links to a detail page with order history, statements, and payment history.

## Tips

- Search across name, phone, email, and account number simultaneously.
- Click any row to open the customer detail in a tab.
- Customer status (Active, Hold, Closed) controls whether new orders can be placed.

## Related screens

- **Phone Order List** — orders taken by phone.
- **Receive Payment** — apply customer payments to invoices.
- **Statement Printer** mapping in **Settings → Printer Settings** governs where statements come out.`,
  },
  {
    key: "screen-phone-orders",
    title: "Phone Order List",
    summary: "Orders captured by phone, awaiting fulfillment.",
    category: "screens",
    keywords: ["phone orders", "phone", "order", "delivery"],
    route: "/phone-orders-list",
    body: `Track orders taken over the phone. Each order links to a customer and has a fulfillment status: Pending, In progress, Completed, Cancelled.

## Tips

- Press **N** on this page to start a new phone order.
- The status dropdown filters the list — useful at end-of-day when checking what still needs to ship.
- Print pick lists in bulk via the **Bulk actions** toolbar.`,
  },
  {
    key: "screen-items-on-phone-order",
    title: "Items On Phone Order",
    summary: "Flat list of line items across all phone orders — useful for picking.",
    category: "screens",
    keywords: ["items on phone order", "pick list", "fulfillment"],
    route: "/items-on-phone-order-list",
    body: `Instead of opening each phone order one-by-one, this screen flattens all line items across orders into one list. Useful for picking and dispatch.

## Tips

- Filter by item to see who ordered it across all open phone orders.
- Group by SKU to consolidate picking across orders.`,
  },
  {
    key: "screen-item-details-on-phone-order",
    title: "Items Details on Phone Order",
    summary: "Per-line detail across phone orders, including substitutions and notes.",
    category: "screens",
    keywords: ["item details", "phone order line", "details"],
    route: "/item-details-on-phone-order-list",
    body: `Deepest view of phone-order line items — including substitution notes, customer instructions, and any flagged issues per line. Use this when investigating fulfillment problems.`,
  },
  {
    key: "screen-replaced-items",
    title: "Replaced Items",
    summary: "Audit trail of items that were substituted on phone orders.",
    category: "screens",
    keywords: ["replaced items", "substitution", "swap"],
    route: "/replaced-items-list",
    body: `When a phone-order item is out of stock and a substitute is sent instead, the swap is logged here. Used for customer follow-up and trend reporting.

## Tips

- Filter by customer to see anyone whose order has been repeatedly substituted — they may want to be called.`,
  },
  {
    key: "screen-receive-payment",
    title: "Receive Payment",
    summary: "Apply customer payments to outstanding invoices.",
    category: "screens",
    keywords: ["receive payment", "ar", "customer payment", "invoice payment"],
    route: "/receive-payments-list",
    body: `Record payments from customers and apply them to one or more open invoices. Supports overpayments (creates a credit on the account) and underpayments.

## Tips

- Use **Apply to oldest** to settle the oldest open invoice first — standard AR practice.
- Payment methods can be split: $50 cash + $200 card = one transaction.`,
  },

  // ─── Screens: Register / POS ──────────────────────────────────────────────
  {
    key: "screen-transactions",
    title: "Transactions",
    summary: "Every sale, refund, and void across all registers and stores.",
    category: "screens",
    keywords: ["transactions", "sales", "register", "pos", "receipts"],
    route: "/transactions-list",
    body: `Master log of every POS transaction. Filter by date, register, store, cashier, or customer to investigate sales activity.

## Tips

- Click any row to see the full receipt detail and line items.
- Use **Export** for sales-tax reporting periods.
- Refund and void transactions are flagged with a red badge in the type column.`,
  },
  {
    key: "screen-registers",
    title: "Registers",
    summary: "Configure each POS register / terminal.",
    category: "screens",
    keywords: ["registers", "register", "pos", "terminal"],
    route: "/registers-list",
    body: `Configure each physical POS terminal: assigned store, default tax group, cash drawer, receipt printer, hardware integrations.

## Tips

- Each register's **Receipt Printer** here is independent of the per-user Print Helper mapping — the register setting wins for POS-side receipts.
- Disabled registers are hidden from cashier sign-in but kept for reporting.`,
  },
  {
    key: "screen-discounts",
    title: "Discount List",
    summary: "All defined discount rules — percentage, fixed-amount, BOGO, and bulk pricing.",
    category: "screens",
    keywords: ["discounts", "discount", "promo", "promotion", "bogo", "pricing"],
    route: "/discounts-list",
    body: `Maintain every active and scheduled discount rule. Discounts can target items, departments, item groups, customers, or specific time windows.

## Tips

- Set **start** and **end** dates on every promotional discount — it will activate and deactivate automatically.
- Stacking rules (can multiple discounts combine?) are configurable per rule.
- BOGO and tiered discounts are supported — see **New Discount** for the full set of types.

## Related

- [New Discount](/discount/new)`,
  },

  // ─── Screens: Stores / Transfers ──────────────────────────────────────────
  {
    key: "screen-stores",
    title: "Store List",
    summary: "Every store / location in the tenant.",
    category: "screens",
    keywords: ["stores", "store", "location", "branch"],
    route: "/stores-list",
    body: `Configure each store location — name, address, time zone, tax group, and feature flags.

## Tips

- Disabling a store hides it from new transactions but keeps its history accessible.
- Per-store overrides (e.g. tax rate, default register) can differ from tenant defaults.`,
  },
  {
    key: "screen-request-transfer",
    title: "Request Transfer",
    summary: "Request goods to be transferred to your store from another location.",
    category: "screens",
    keywords: ["request transfer", "transfer", "movement", "stock movement"],
    route: "/request-transfer-list",
    body: `Inter-store transfer requests. The receiving store creates the request; the sending store fulfills via **Transfers**.

## Tips

- Use this rather than **Adjust Inventory** when stock moves between stores — preserves the chain of custody.
- Status flows: Requested → Approved → In Transit → Received.`,
  },
  {
    key: "screen-transfers",
    title: "Transfers",
    summary: "Inter-store stock movement — outgoing transfers from your store.",
    category: "screens",
    keywords: ["transfers", "outgoing", "send stock"],
    route: "/transfers-list",
    body: `Outgoing transfers from your store to another location. Each row tracks status, quantities, and the receiving acknowledgment.

## Tips

- Print a transfer manifest (pick list) from the row's three-dot menu before packing.
- Transfers in **In Transit** state count down from sending stock but up to receiving stock only when **Receive Transfer** completes.`,
  },
  {
    key: "screen-receive-transfer",
    title: "Transfer Received",
    summary: "Acknowledge transfers arriving at your store.",
    category: "screens",
    keywords: ["receive transfer", "transfer in", "incoming transfer"],
    route: "/receive-transfer-list",
    body: `Confirm receipt of inter-store transfers. Adjusts your store's inventory upward.

## Tips

- Receive against the original transfer — discrepancies are flagged for investigation.
- Damaged or missing items can be marked and re-classified to **Damage** (creates an Adjust Inventory record automatically).`,
  },

  // ─── Screens: Admin ───────────────────────────────────────────────────────
  {
    key: "screen-users-list",
    title: "User List",
    summary: "Every user in your tenant — add, edit roles, disable, reset passwords.",
    category: "screens",
    keywords: ["users", "user list", "accounts", "people", "team"],
    route: "/users-list",
    body: `Manage every user account in your tenant. Each user has one or more roles (administered via **User Roles**) which control their permissions.

## Tips

- Use the search bar to find by name, email, or username.
- Click any row to open user details and edit permissions.
- Disabling a user immediately revokes their sessions; re-enabling restores the role set as it was.

## Common tasks

- **Add a user**: toolbar → **+ User**. Email is the login by default.
- **Reset a password**: open the user → **Security tab** → **Send reset link**. The user gets an email.
- **Change role**: open the user → **Roles tab** → assign/remove roles.`,
  },
  {
    key: "screen-user-roles",
    title: "User Roles",
    summary: "Assign roles to users — the bridge between users and permissions.",
    category: "screens",
    keywords: ["user roles", "permissions", "role assignment"],
    route: "/tenant-admin/user-roles",
    body: `Where you assign which user has which role. Roles themselves are defined in **Roles** (tenant-admin / roles).

## Tips

- A user can have multiple roles; their effective permissions are the union of all assigned roles.
- Removing a role takes effect on the user's next page navigation — no logout needed.`,
  },
  {
    key: "screen-roles",
    title: "Roles",
    summary: "Define what a role can do — the permission template applied to users.",
    category: "screens",
    keywords: ["roles", "permissions", "rbac"],
    route: "/tenant-admin/roles",
    body: `Create and edit roles. Each role is a named bundle of permissions (e.g. *Cashier*, *Manager*, *Auditor*).

## Tips

- Start with the tenant defaults (typically *Admin*, *Manager*, *Cashier*) and copy when you need a variant.
- Use the **permission matrix** to see what each role can and can't do, side-by-side.
- Permission changes apply to every user with that role.`,
  },
  {
    key: "screen-api-logs",
    title: "API Logs",
    summary: "Request/response log for diagnosing integrations and unexpected behavior.",
    category: "screens",
    keywords: ["api", "logs", "request", "response", "diagnostics", "debug"],
    route: "/request-response-logs",
    body: `Audit log of every API call into BackOffice — incoming requests with status codes, response times, and (for errors) the response body. Used to diagnose third-party integrations.

## Tips

- Filter by HTTP method or status code to find failures fast.
- The detail view shows the full request and response payload.
- Older logs roll off automatically — check the retention setting in tenant configuration if you need longer.`,
  },
  {
    key: "screen-licenses-billing",
    title: "Licenses & Billing",
    summary: "View your subscription, plan, usage, and invoices.",
    category: "screens",
    keywords: ["billing", "license", "subscription", "plan", "usage", "invoice"],
    route: "/licenses-billing",
    body: `See your current plan, what you're using, what's included, and your billing history.

## Tips

- Usage updates daily — current-month projections are based on average daily consumption so far.
- Download past invoices as PDF for accounting.
- Upgrade or downgrade requests are sent to your account manager via the **Change plan** button.`,
  },

  // ─── Screens: SmartKart Registration / OpenAPI ────────────────────────────
  {
    key: "screen-smartkart-overview",
    title: "SmartKart Registration — Overview",
    summary: "Landing page for the developer registration / OpenAPI portal.",
    category: "screens",
    keywords: ["smartkart", "registration", "developer", "api", "openapi", "integration"],
    route: "/smartkart-registration",
    body: `Entry point for developers integrating with SmartKart. From here you can register applications, generate API tokens, and grant scopes.

## Sections

- **Applications** — register a new client app.
- **App Registrations** — see all registered clients.
- **Tokens** — issue API tokens.
- **Permissions** — define which scopes exist.
- **Token Permissions** — attach scopes to tokens.
- **Customers** — link tokens to customer records.`,
  },
  {
    key: "screen-smartkart-permissions",
    title: "SmartKart Permissions",
    summary: "Define scopes that API tokens can grant.",
    category: "screens",
    keywords: ["permissions", "scopes", "api", "oauth"],
    route: "/smartkart-registration/permissions",
    body: `Catalog of OAuth-style scopes available to API tokens. Each scope defines what an integrating app is allowed to do.

## Tips

- Scopes are tenant-scoped by default — adding one here makes it available for token attachment in this tenant.
- Naming convention: \`<resource>:<action>\` (e.g. \`items:read\`, \`orders:write\`).`,
  },
  {
    key: "screen-smartkart-tokens",
    title: "SmartKart Tokens",
    summary: "Issue, revoke, and rotate API tokens for integrating applications.",
    category: "screens",
    keywords: ["tokens", "api keys", "auth", "bearer"],
    route: "/smartkart-registration/tokens",
    body: `Generate API tokens for third-party apps. Tokens carry a set of scopes (from **SmartKart Permissions**) and optionally a store-access list.

## Tips

- **Copy the token immediately when generated** — it's shown only once.
- Rotate tokens periodically. Old token revocation is instant.
- Use **Token Store Access** to restrict a token to specific stores.`,
  },
  {
    key: "screen-smartkart-token-store-access",
    title: "SmartKart Token Store Access",
    summary: "Restrict which stores a token can act on.",
    category: "screens",
    keywords: ["token", "store access", "restriction"],
    route: "/smartkart-registration/token-store-access",
    body: `Limit a token's reach to certain stores. By default a token has access to every store in the tenant.

## When to use

- An integration that only services one branch.
- A pilot rollout where you want a token confined to one test location.`,
  },
  {
    key: "screen-smartkart-token-permissions",
    title: "SmartKart Token Permissions",
    summary: "Attach permission scopes to a token.",
    category: "screens",
    keywords: ["token", "permissions", "scopes"],
    route: "/smartkart-registration/token-permissions",
    body: `Pick which scopes a given token includes. The intersection of a token's scopes and the user's permissions is what the integrating app can actually do.`,
  },
  {
    key: "screen-smartkart-customers",
    title: "SmartKart Customers",
    summary: "Link tokens to customer records for customer-scoped API access.",
    category: "screens",
    keywords: ["smartkart customers", "api customers", "customer-scoped"],
    route: "/smartkart-registration/customers",
    body: `Used when an integrating app is acting on behalf of a specific customer. Links a token to a customer record so the API enforces customer-scope checks automatically.`,
  },
  {
    key: "screen-smartkart-applications",
    title: "SmartKart Applications",
    summary: "Register integrating applications (clients) that will call the SmartKart API.",
    category: "screens",
    keywords: ["applications", "client app", "integration", "register"],
    route: "/smartkart-registration/applications",
    body: `Register an application that will integrate with SmartKart's API. Each registration gives you a client ID, used in OAuth flows or token issuance.

## Tips

- Set a **redirect URI** for OAuth-based integrations.
- Public clients (mobile, SPA) have different security implications — pick the right client type.`,
  },
  {
    key: "screen-smartkart-app-registrations",
    title: "SmartKart App Registrations",
    summary: "All currently registered applications, with their tokens and last-seen times.",
    category: "screens",
    keywords: ["app registrations", "applications", "audit"],
    route: "/smartkart-registration/app-registrations",
    body: `View every registered integrating app in your tenant — their type, scopes, last activity, and active tokens. Useful for periodic audits.`,
  },

  // ─── Screens: Super Admin ─────────────────────────────────────────────────
  {
    key: "screen-super-admin-tenants",
    title: "Super Admin — Tenant Management",
    summary: "Provision, suspend, and manage every tenant in the platform.",
    category: "screens",
    keywords: ["tenants", "tenant management", "super admin", "provisioning"],
    route: "/super-admin/tenants",
    body: `For super admins only. Create new tenants, suspend or activate existing ones, and dive into per-tenant details.

## Tips

- Suspending a tenant blocks login for every user in it; data is preserved.
- Use **Tenant Customers** to manage the billing-side customer record (one customer can own multiple tenants).`,
  },
  {
    key: "screen-super-admin-plans",
    title: "Super Admin — Plan Management",
    summary: "Define subscription plans, included features, and limits.",
    category: "screens",
    keywords: ["plans", "subscription", "billing plans", "pricing tier"],
    route: "/super-admin/plans",
    body: `Catalog of subscription plans. Each plan has a feature set, usage limits, and pricing tier. Plans are assigned to tenants and drive what they can access.`,
  },
  {
    key: "screen-super-admin-tenant-customers",
    title: "Super Admin — Tenant Customers",
    summary: "Billing-side customer records that own one or more tenants.",
    category: "screens",
    keywords: ["tenant customers", "billing customer", "account"],
    route: "/super-admin/tenant-customers",
    body: `The billing relationship: a Tenant Customer is the legal entity paying for one or more SmartKart tenants. Manage their contact info, payment method, and tenant ownership here.`,
  },
  {
    key: "screen-super-admin-licenses-billing",
    title: "Super Admin — Licenses & Billing",
    summary: "Platform-wide license and billing overview.",
    category: "screens",
    keywords: ["licenses", "billing", "platform billing", "super admin"],
    route: "/super-admin/licenses-billing",
    body: `Aggregated view of every tenant's license state, usage, and outstanding balance. Use to spot anomalies and dunning candidates.`,
  },
  {
    key: "screen-super-admin-permission-ceiling",
    title: "Super Admin — Permission Ceiling",
    summary: "Cap which permissions a tenant's admins are allowed to grant.",
    category: "screens",
    keywords: ["permission ceiling", "limits", "rbac cap", "super admin"],
    route: "/super-admin/permission-ceiling",
    body: `Set the maximum set of permissions a given tenant's administrators can grant their users. Useful for compliance or trial-tier tenants.

## Tips

- The ceiling is a *maximum*, not a default — tenant admins still pick which subset to actually use.
- Tightening the ceiling immediately removes any user permission that exceeds it.`,
  },
  {
    key: "screen-super-admin-permission-registry",
    title: "Super Admin — Permission Registry",
    summary: "Master list of every permission key the platform knows about.",
    category: "screens",
    keywords: ["permission registry", "permissions", "platform"],
    route: "/super-admin/permission-registry",
    body: `Source of truth for every permission string used across the platform. New permissions added here become available for assignment in every tenant.`,
  },
  {
    key: "screen-super-admin-user-tenants",
    title: "Super Admin — User Tenants",
    summary: "Which users have access to which tenants.",
    category: "screens",
    keywords: ["user tenants", "user access", "multi-tenant"],
    route: "/super-admin/user-tenants",
    body: `For users that span multiple tenants (typical for franchisees and service providers), this screen shows the assignment matrix and lets you grant/revoke per-tenant access.`,
  },
  {
    key: "screen-super-admin-global-pricing",
    title: "Super Admin — Global Pricing",
    summary: "Default item pricing applied across all tenants (catalog-level).",
    category: "screens",
    keywords: ["global pricing", "catalog pricing", "platform pricing"],
    route: "/super-admin/global-pricing",
    body: `Platform-wide default prices that flow into all tenants who use the shared catalog. Tenants can override at their level.`,
  },
  {
    key: "screen-super-admin-billing-overview",
    title: "Super Admin — Billing Overview",
    summary: "Real-time dashboard of platform billing: MRR, churn, outstanding.",
    category: "screens",
    keywords: ["billing overview", "mrr", "metrics", "revenue"],
    route: "/super-admin/billing-overview",
    body: `Live financial dashboard — Monthly Recurring Revenue, new vs. churned customers, total outstanding invoices, and per-plan breakdown.`,
  },
  {
    key: "screen-super-admin-grid-settings",
    title: "Super Admin — Grid Settings",
    summary: "Configure which grid columns are visible per role / tenant.",
    category: "screens",
    keywords: ["grid settings", "column access", "table settings"],
    route: "/super-admin/grid-column-access",
    body: `Govern which data columns are visible to which roles on every grid in the application. Useful for hiding sensitive fields (cost, margin) from cashier roles.`,
  },
  {
    key: "screen-super-admin-security-settings",
    title: "Super Admin — Security Settings",
    summary: "Platform-wide auth, password, and session policies.",
    category: "screens",
    keywords: ["security", "auth", "password policy", "session", "mfa"],
    route: "/super-admin/security-settings",
    body: `Set password complexity rules, session timeout, MFA requirement, and login lockout thresholds. Applies to every tenant unless a tenant has been granted an override.`,
  },
  {
    key: "screen-super-admin-smtp-settings",
    title: "Super Admin — SMTP Settings",
    summary: "Configure email server for outbound notifications and reports.",
    category: "screens",
    keywords: ["smtp", "email", "notifications", "outbound"],
    route: "/super-admin/smtp-settings",
    body: `Set the SMTP server, credentials, and from-address used for all outbound email (password resets, scheduled reports, statements). Test connectivity here before going live.`,
  },

  // ─── Other ────────────────────────────────────────────────────────────────
  {
    key: "screen-profile",
    title: "Your Profile",
    summary: "View and edit your own account — name, contact info, password, MFA.",
    category: "screens",
    keywords: ["profile", "account", "password", "mfa", "personal"],
    route: "/profile",
    body: `Update your own user record: display name, email, contact phone, password, MFA setup, and notification preferences.

## Tips

- Changing your password signs out every other active session on your account.
- Enable MFA from the **Security** tab for stronger account protection.
- Notification preferences let you opt in or out of email alerts per category.`,
  },
  {
    key: "screen-calendar",
    title: "Calendar",
    summary: "Schedule events, appointments, and reminders.",
    category: "screens",
    keywords: ["calendar", "events", "schedule", "appointment"],
    route: "/calendar",
    body: `Visual calendar for scheduling events relevant to your operation — staff schedules, vendor deliveries, promotional periods, etc.

## Tips

- Click any empty slot to create an event.
- Drag an event to reschedule.
- Toggle Month / Week / Day view from the top-right.`,
  },

  // ─── Reports ──────────────────────────────────────────────────────────────
  {
    key: "reports-overview",
    title: "Reports — Overview",
    summary: "Where to find every report, and how the Report Manager works.",
    category: "reports",
    keywords: ["reports", "report manager", "reporting", "analytics"],
    body: `BackOffice reports are managed through the **Report Manager** — open it from the Dashboard's **Reports** button or directly at \`/report-manager\`.

## Report categories

- **Sales** — transactions, daily totals, by department, by item.
- **Inventory** — on-hand value, adjustments, transfers, slow movers.
- **Customers** — receivables, statements, top customers.
- **Vendors** — payables, PO history, RTV history.
- **Audit** — user activity, permission changes, log access.

## Common operations

- Run a report immediately and view in-browser.
- Schedule a report to run nightly / weekly / monthly with email delivery.
- Export to CSV, Excel, or PDF.
- Save filtered views as personal favorites.`,
  },
  {
    key: "reports-sales",
    title: "Sales Reports",
    summary: "Transaction-level and aggregate sales reports.",
    category: "reports",
    keywords: ["sales report", "sales", "transactions report", "daily sales"],
    body: `Sales reports break down revenue by various dimensions.

## Available reports

- **Daily Sales Summary** — totals per day, by tender type.
- **Sales by Department** — revenue split by department over a period.
- **Sales by Item** — top-selling and slow-moving SKUs.
- **Sales by Cashier** — productivity report for register staff.
- **Refund Analysis** — refund frequency and reasons.
- **Tax Summary** — for tax filing periods.

## Tips

- Date range and store filters are at the top of every report.
- Tax Summary export is what your accountant wants for filing — format matches most jurisdictions.`,
  },
  {
    key: "reports-inventory",
    title: "Inventory Reports",
    summary: "Stock levels, valuations, adjustments, and movement history.",
    category: "reports",
    keywords: ["inventory report", "stock", "valuation", "adjustment history"],
    body: `Inventory reports show stock health.

## Available reports

- **On-Hand Valuation** — current stock value at cost or retail.
- **Stock Movement** — every change in stock for a date range.
- **Adjustment History** — every manual adjustment, who and why.
- **Slow Movers** — items with no sales in N days.
- **Out-of-Stock** — items at or below reorder threshold.
- **Stocktake Variance** — expected vs. counted at last stocktake.

## Tips

- On-Hand Valuation as of a past date helps with year-end reporting.
- Schedule **Out-of-Stock** to email the buyer every morning.`,
  },
  {
    key: "reports-customers",
    title: "Customer Reports",
    summary: "Accounts receivable, statements, top customers, activity.",
    category: "reports",
    keywords: ["customer report", "ar", "receivables", "statements", "top customers"],
    body: `Customer-facing reports and AR.

## Available reports

- **Open Receivables** — outstanding balances per customer.
- **Aging Report** — receivables aged into 0–30, 31–60, 61–90, 90+ buckets.
- **Statements** — printable customer statements (one per customer or bulk).
- **Top Customers** — by revenue, transaction count, or items purchased.
- **Customer Activity** — order history per customer.

## Tips

- Bulk-print statements go to your **Statement Printer** mapping (Settings → Printer Settings).
- Aging Report's bucket sizes are configurable in tenant settings.`,
  },
  {
    key: "reports-vendors",
    title: "Vendor Reports",
    summary: "Accounts payable, purchase history, return analysis.",
    category: "reports",
    keywords: ["vendor report", "ap", "payables", "purchase history"],
    body: `Vendor-side financial and procurement reports.

## Available reports

- **Open Payables** — what you owe to each vendor.
- **PO History** — every PO over a period.
- **Receiving Variance** — gaps between PO and received quantities.
- **RTV Analysis** — frequency and reasons for vendor returns.
- **Vendor Performance** — on-time delivery rate, defect rate.

## Tips

- Vendor Performance is most useful with 6+ months of data — let history accumulate.`,
  },
  {
    key: "reports-audit",
    title: "Audit Reports",
    summary: "Who did what, when — for security and compliance reviews.",
    category: "reports",
    keywords: ["audit", "compliance", "security report", "user activity", "permission changes"],
    body: `Audit-trail reports for security and compliance.

## Available reports

- **User Activity Log** — every login, action, and data change per user.
- **Permission Changes** — who granted or revoked what role and when.
- **Failed Logins** — pattern detection for brute-force attempts.
- **Data Export Log** — who exported what data.

## Tips

- For SOC 2 / PCI compliance, schedule the User Activity Log to archive monthly.
- The Failed Logins report alerts thresholds can be tuned in **Security Settings**.`,
  },
  {
    key: "reports-schedule",
    title: "Scheduling reports",
    summary: "Email reports automatically on a daily/weekly/monthly cadence.",
    category: "reports",
    keywords: ["schedule report", "scheduled", "email", "automated reports", "cron"],
    body: `Most reports can be scheduled to run automatically and email the result.

## How to schedule

1. Open the report you want.
2. Configure filters as you want them to run.
3. Click **Schedule** in the toolbar.
4. Pick frequency (daily, weekly, monthly), time, and recipient email(s).
5. Save.

## Tips

- Output format options: PDF, Excel, CSV. PDF is best for fixed layouts; Excel for analysis.
- Multiple recipients are comma-separated.
- Failed deliveries are logged and visible in the **Scheduled Reports** management page.`,
  },

  {
    key: "glossary",
    title: "Glossary",
    summary: "Definitions of every term used in the docs.",
    category: "explanation",
    keywords: ["glossary", "terms", "definitions", "vocabulary"],
    body: `Quick lookups for terminology used throughout SmartKart.

- **Agent / Print Agent / Print Helper** — Same thing. *Print Helper* in user docs, *Print Agent* in dev docs.
- **AllowedOrigins** — CORS allowlist inside \`appsettings.json\`.
- **CORS** — Cross-Origin Resource Sharing. Browser-enforced.
- **ESC/POS** — Receipt printer command language.
- **JWT** — JSON Web Token. Carries the print authorization.
- **Kestrel** — The HTTP server inside the agent.
- **LNA** — Local Network Access. Chrome 138+ feature blocking public → loopback calls.
- **LocalSystem** — Windows built-in account with broad privileges; default for the agent service.
- **Origin** — \`scheme://host:port\`, e.g. \`https://qa.smartkart.app\`.
- **Pairing** — One-time handshake authorizing one origin to print.
- **PDFium** — Chrome's PDF engine, embedded in the agent for rendering.
- **PNA** — Private Network Access; older name for what LNA replaced.
- **ZPL** — Zebra Programming Language; for thermal label printers.`,
  },
]

/** Helpers used by the drawer + Help Center. */

/** Look up topic by key. */
export function getTopic(key: string): HelpTopic | undefined {
  return topics.find((t) => t.key === key)
}

/** Find the topic that matches an app route. Returns null if none. */
export function getTopicForRoute(pathname: string): HelpTopic | null {
  const exact = topics.find((t) => t.route === pathname)
  if (exact) return exact
  const keys = topics.filter((t) => !!t.route).sort((a, b) => (b.route!.length - a.route!.length))
  for (const t of keys) {
    if (pathname.startsWith(t.route! + "/")) return t
  }
  return null
}

/** Fallback topic when no route or key matches. */
export const defaultTopic: HelpTopic = topics.find((t) => t.key === "what-is-the-print-helper")!

/** Group topics by category. */
export function topicsByCategory(): Record<HelpTopic["category"], HelpTopic[]> {
  return topics.reduce(
    (acc, t) => {
      acc[t.category].push(t)
      return acc
    },
    {
      "getting-started": [] as HelpTopic[],
      screens: [] as HelpTopic[],
      reports: [] as HelpTopic[],
      "how-to": [] as HelpTopic[],
      troubleshooting: [] as HelpTopic[],
      reference: [] as HelpTopic[],
      explanation: [] as HelpTopic[],
    } as Record<HelpTopic["category"], HelpTopic[]>
  )
}

/** Common English words that don't help disambiguate help topics — stripped before scoring. */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "could", "did", "do", "does",
  "for", "from", "had", "has", "have", "he", "her", "here", "his", "how", "i", "if", "in", "is",
  "it", "its", "may", "me", "my", "of", "on", "or", "our", "she", "should", "so", "that", "the",
  "their", "them", "then", "there", "these", "they", "this", "to", "too", "us", "was", "we",
  "were", "what", "when", "where", "which", "who", "why", "will", "with", "would", "you", "your",
  "doesn", "doesnt", "don", "dont", "won", "wont", "isn", "isnt",
])

/** Tokenize a string into searchable lowercase words, stripping punctuation and stopwords. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length > 1 && !STOPWORDS.has(tok))
}

/**
 * Full-text search across topics with simple BM25-style scoring.
 *
 * For each topic we count how many query tokens appear in each field and weight
 * by field importance: title (×5), keywords (×4), summary (×3), body (×1). The
 * exact-phrase match in title or summary gets a large bonus so short queries
 * like "items list" still rank that page highest.
 */
export function searchTopics(query: string): HelpTopic[] {
  const raw = query.trim().toLowerCase()
  if (!raw) return topics

  const tokens = tokenize(raw)
  if (tokens.length === 0) {
    // Query was entirely stopwords — fall back to literal substring matching.
    return topics.filter((t) =>
      [t.title, t.summary, t.body, ...t.keywords].some((f) => f.toLowerCase().includes(raw))
    )
  }

  const scored = topics.map((t) => {
    const titleLc = t.title.toLowerCase()
    const summaryLc = t.summary.toLowerCase()
    const bodyLc = t.body.toLowerCase()
    const keywordsLc = t.keywords.map((k) => k.toLowerCase())

    let score = 0

    for (const tok of tokens) {
      if (titleLc.includes(tok)) score += 5
      if (keywordsLc.some((k) => k.includes(tok))) score += 4
      if (summaryLc.includes(tok)) score += 3
      if (bodyLc.includes(tok)) score += 1
    }

    // Exact-phrase bonuses for short queries.
    if (raw.length >= 3) {
      if (titleLc.includes(raw)) score += 15
      else if (summaryLc.includes(raw)) score += 8
      else if (keywordsLc.some((k) => k.includes(raw))) score += 8
    }

    return { topic: t, score }
  })

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.topic)
}

/**
 * Export the help corpus as a flat JSON-friendly structure for the chatbot.
 *
 * The shape is intentionally simple so any RAG indexer can consume it. See
 * docs/CHATBOT-HELP-INTEGRATION.md for how to wire this into the chatbot.
 */
export function helpAsJson() {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    // All documentation is hosted inside the BackOffice app itself.
    // Each topic is reachable at /help?topic=<key>.
    categories: CATEGORIES,
    topics: topics.map((t) => ({
      key: t.key,
      title: t.title,
      summary: t.summary,
      body: t.body,
      category: t.category,
      keywords: t.keywords,
      route: t.route ?? null,
      // Internal in-app link to this topic (same domain as the running web app).
      inAppUrl: `/help?topic=${t.key}`,
    })),
  }
}
