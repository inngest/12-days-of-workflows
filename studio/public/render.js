// A small helper that updates the page without redrawing it. Nothing here knows about cards.

export const esc = (text) =>
  String(text).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

/** Sets innerHTML only when it changed, so a quiet tick touches nothing. */
export function setHtml(el, html) {
  if (el.dataset.html === html) return;
  el.innerHTML = html;
  el.dataset.html = html;
}
