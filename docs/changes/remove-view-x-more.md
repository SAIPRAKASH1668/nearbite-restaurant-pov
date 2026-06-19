# Remove "View x more" item truncation on order cards

**Date:** 2026-06-19
**Area:** Restaurant POV app — Orders feature (`src/app/features/orders/`)

## Goal
Order cards used to show only a few items and hide the rest behind a
"View x more" button. Show **all** items on the card instead, and remove
the "View x more" affordance (and the analogous "+x more added items"
truncation in swap groups).

## Changes

### `orders.component.ts`
- `getOrderCardItems()` — return **all** source items (after filtering out
  swap-replacement ids). Removed the `.slice(0, visibleLimit)` truncation.
- Removed `getHiddenOrderCardItemCount()` — only the "View x more" button used it.
- Removed `getOrderCardVisibleItemLimit()` — only used by the two methods above.
- `getOrderCardSwapGroup()` — return all `addedItems` (removed `.slice(0, 3)`
  and the `hiddenAddedCount` field).
- `OrderCardSwapGroup` interface — dropped the `hiddenAddedCount` field.

### `orders.component.html`
- Removed the `<button class="ord-see-more">View {{ ... }} more</button>` block.
- Removed the `<div class="ord-card-swap-more">+{{ ... }} more added item…</div>` block.

### `orders.component.scss`
- Removed the now-unused `.ord-see-more` and `.ord-card-swap-more` rules.

### `orders.component.scss` (follow-up)
- `.ord-items` had a desktop `height: 148px; overflow: hidden`, which still
  visually clipped the list to ~4 rows even after the TS/HTML truncation was
  removed — orders with 5+ items showed only 4. Changed to `min-height: 148px;
  overflow: visible` so short cards keep a consistent baseline while taller
  orders grow to show every item. Mobile/tablet baseline relaxed to `min-height: 0`.

## Notes
- `expandOrder()` is still used (the "View details" icon button at the card header),
  so it was left intact.
- `hasMoreItems()` was already dead code (no template usage) and is unrelated to
  this change, so it was left untouched.
