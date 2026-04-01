# LoadingBoard Open Performance Guide

## Goal
Reduce LoadingBoard open latency by separating script startup costs from sheet render/recalculation costs.

## Startup Guardrails (Code)

- Keep exactly one active `onOpen` in modular deployment:
  - Use `LoadingBoardGS/24_startup_open.gs` as the production startup entry.
  - Do not deploy `Code.js` `onOpen` as active startup logic.
- Keep `onOpen` scope minimal:
  - date-column resolution only
  - one activation call
  - no modal rendering
  - no heavy maintenance work
- Keep optional startup features disabled by default in config for max speed:
  - `ONOPEN_ENABLE_MENU: false`
  - `ONOPEN_ENABLE_DEFERRED_STARTUP: false`

## What was optimized in code

- Startup:
  - cached open-date column lookup in `24_startup_open.gs`
  - extracted `resolveTodayFocusColumn_()` to reduce repeated work
  - deferred startup queue with trigger dedupe (`PropertiesService` + `LockService`) available but opt-in
  - manual fallback command remains callable: `RunDeferredStartupMaintenance`
- Name list loaders:
  - switched from full-board reads to column-A-only reads
  - added document-cache for repeated modal opens
- QC/Productivity:
  - reduced `Data 2` fetches from `500x225` to `1x225` where only row 1 is used

## Spreadsheet UI Checklist (High Impact)

Apply this in the Google Sheet itself (not script files):

1. **Conditional formatting ranges**
   - Replace whole-column/whole-sheet ranges with bounded ranges.
   - Remove duplicate or stale rules.
2. **Formula ranges**
   - Replace `A:A` style references with finite ranges.
   - Limit `ARRAYFORMULA`, `VLOOKUP`, `INDEX/MATCH` spans to active windows.
3. **Volatile formulas**
   - Minimize `NOW`, `TODAY`, `RAND`, `OFFSET`, `INDIRECT`.
   - If needed, centralize into one helper cell and reference it.
4. **Sheet dimensions**
   - Delete unused extra rows/columns.
   - Remove stale filters and protected ranges no longer needed.
5. **External dependencies**
   - Audit `IMPORTRANGE` or connector formulas and reduce refresh scope/frequency.

## Benchmark Steps

### A) Script lookup benchmark
- Run `BenchmarkOpenFocus(10)` from Apps Script editor.
- Record min/avg/max from execution logs.

### B) Deferred startup benchmark
- Run `BenchmarkDeferredStartup(3)` from Apps Script editor.
- Record min/avg/max from execution logs.

### C) Real open benchmark
- Perform 3 cold and 3 warm opens:
  - Cold: fully close all spreadsheet tabs, reopen file.
  - Warm: reload current file/tab.
- Record:
  - time until sheet becomes interactive
  - time until current-date focus is visible
  - time until deferred startup logs completion

Use this table:

| Run | Type | Interactive (s) | Date Focus Visible (s) | Notes |
| --- | --- | ---: | ---: | --- |
| 1 | Cold |  |  |  |
| 2 | Cold |  |  |  |
| 3 | Cold |  |  |  |
| 4 | Warm |  |  |  |
| 5 | Warm |  |  |  |
| 6 | Warm |  |  |  |

## Scripted Render Optimization (New)

Use these Apps Script functions for a fast, safe render/recalc pass on `DAS Board`:

- `AnalyzeRenderRecalcHotspots()`
  - reports per-sheet grid size, used area, formula count, volatile formula count, and conditional format rule count.
- `OptimizeDASBoardRenderPerformance()`
  - clamps oversized conditional-format ranges to board bounds (+small buffer).
  - trims extra rows/columns beyond configured board footprint + buffer.
- `RunQuickRenderOptimization()`
  - runs before/after analysis and optimization in one pass.

Recommended order:

1. Run `AnalyzeRenderRecalcHotspots()`.
2. Run `RunQuickRenderOptimization()`.
3. Re-test cold/warm open timings.

## Regression Checklist

- Open focuses near current workday date.
- User Revs dialog opens and user list loads.
- Start/QC/Complete flows still function.
