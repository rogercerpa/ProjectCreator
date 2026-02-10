# Agile Workqueue DOM Selectors

The Agile Monitor feature scrapes the workqueue page at  
`https://agile.acuitybrandslighting.net/applications/workqueue2`  
by connecting to the user's Microsoft Edge (via CDP) and running DOM extraction in the page context.

## Current behavior

The extraction logic lives in **`main-process/services/AgileScrapingService.js`** in the function **`getWorkqueueExtractionScript()`**. It uses several fallback strategies:

1. **Strategy 1**: Standard HTML `<table>` with `<thead>` / `<tbody>` — maps header cells to column names (RFA Number, Type, Project Name, Status, Agent, ECD, etc.) and reads data rows.
2. **Strategy 2**: ARIA grid — `[role="grid"]` with `[role="row"]` and `[role="gridcell"]` / `[role="columnheader"]`.
3. **Strategy 3**: RFA links — any `<a>` with `requestnav`/`rfa` in `href` or `data-rfa`, plus closest row container to gather cell text.

If the actual Agile workqueue markup differs (e.g. custom components, different class names, or a JS-rendered table), the scraper may return no rows or wrong columns until selectors are updated.

## How to discover the correct selectors (requires VPN)

1. **Connect to VPN** and open the workqueue in Edge:  
   `https://agile.acuitybrandslighting.net/applications/workqueue2`

2. **Open DevTools** (F12) and use **Elements** (or **Inspector**) to:
   - Find the container that holds the list/table of RFAs (e.g. a `<table>`, a div with a grid, or a list of cards).
   - Note the **tag names**, **class names**, and any **data attributes** (e.g. `data-testid`, `data-column`, `data-rfa`).
   - For tables: identify the **header row** (e.g. `thead th` or first `tr` with `th`/`td`) and the **data rows** (`tbody tr` or subsequent `tr`).
   - For each column you need (RFA #, Type, Project Name, Status, Agent, ECD, Assigned To, Priority, Last Updated), note the **header text** or **column index** (0-based).

3. **Update the extraction script** in `AgileScrapingService.js`:
   - Open `getWorkqueueExtractionScript()`.
   - Adjust the `document.querySelectorAll(...)` and row/cell traversal to match the real DOM (e.g. replace `table`/`thead`/`tbody` with the actual container and row/cell selectors).
   - Map the resulting text to the same object shape:  
     `rfaNumber`, `rfaType`, `projectName`, `projectContainer`, `status`, `agentNumber`, `ecd`, `assignedTo`, `priority`, `lastUpdated`.

4. **Test**: In Project Creator, open **Agile Workqueue**, connect Edge (with remote debugging on port 9222), then click **Scrape now**. Confirm the table in the UI fills with the expected columns and values.

## Column mapping

The scraper expects to produce objects with these keys (empty string if not found):

| Key              | Description                    |
|------------------|--------------------------------|
| `rfaNumber`      | RFA number (e.g. 12345-0)     |
| `rfaType`        | Request type                   |
| `projectName`    | Project name                   |
| `projectContainer`| Container / project ID        |
| `status`         | Status (Open, In Progress, …)  |
| `agentNumber`    | Agent / Rep number             |
| `ecd`            | Estimated completion date     |
| `assignedTo`     | Assignee                       |
| `priority`       | Priority                       |
| `lastUpdated`    | Last updated timestamp         |

Once you have the real selectors, replace or narrow the strategies in `getWorkqueueExtractionScript()` so the first matching strategy matches the live workqueue DOM.
