/**
 * Returns true when `href` should be considered the active route for `pathname`.
 * Root ("/") requires an exact match; all other paths use startsWith so that
 * nested routes (e.g. /admin/analytics) also activate the /admin nav item.
 */
export function isNavActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
