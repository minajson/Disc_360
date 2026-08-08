/**
 * Declares A4 as the paper for one route's print output.
 *
 * `@page` is document-scoped — there is no selector that limits it — so a
 * rule in globals.css would silently impose A4 on every printable surface in
 * the product: the participant report, the shared profile, the room QR sheet,
 * the presentation deck, the marketing pages. Rendering the rule from a route
 * scopes it by *where it loads* rather than by cascade, which is the only
 * mechanism CSS offers here.
 *
 * The Team Intelligence report does not need this: it carries its own named
 * `@page report`, which applies only to the element that asks for it. This is
 * for a designed report laid out for A4 that has no such page context of its
 * own — currently the Executive Brief.
 */
export function ReportPaperSize() {
  return (
    <style
      // Raw CSS: an at-rule cannot be expressed as a style object.
      dangerouslySetInnerHTML={{ __html: "@media print{@page{size:A4;}}" }}
    />
  );
}
