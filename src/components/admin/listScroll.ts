/**
 * Shared scroll-container classes for long admin list/table views.
 *
 * Caps the table region to the viewport height so the *page* itself doesn't
 * scroll: the user sees the full frame (page header, tabs, filters, count, and
 * the window bottom) on initial load and scrolls the list internally instead.
 * Pair this with a sticky `<thead>` (see {@link ADMIN_LIST_THEAD}) so the
 * column headers stay visible while the rows scroll under them.
 *
 * The `22rem` reserve approximates the admin chrome stacked above the table —
 * top bar (4rem) + page header (~8rem) + tab strip (~4rem) + filter row +
 * count line. It only needs to be close: if it's a touch too small the page
 * scrolls a few pixels (today's behavior), if a touch too large there's a
 * little extra whitespace below the list. Neither breaks the layout. Tune here
 * once rather than in each table. `100dvh` (not `vh`) keeps it correct under
 * mobile browser chrome. `min-h` stops the region collapsing on short windows.
 */
export const ADMIN_LIST_SCROLL =
  "overflow-auto max-h-[calc(100dvh-22rem)] min-h-[14rem]";

/** Sticky header row for tables inside an {@link ADMIN_LIST_SCROLL} region. */
export const ADMIN_LIST_THEAD = "sticky top-0 z-10 bg-card";
