export function initNav(): void {
  const nav = document.getElementById("nav");
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 16);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}
