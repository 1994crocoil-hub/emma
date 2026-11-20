const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const root = document.documentElement;
const motionToggle = document.querySelector(".motion-toggle");
const scrollProgress = document.querySelector(".reading-progress");
const postcard = document.querySelector("[data-parallax]");
const pointerPreference = window.matchMedia("(hover: hover) and (pointer: fine)");
const activeAnimations = new Set();

try {
  if (sessionStorage.getItem("kansai-motion") === "off") root.dataset.motion = "off";
} catch {
  // The toggle also works in browsers that disable session storage.
}

function motionEnabled() {
  return !motionPreference.matches && root.dataset.motion !== "off";
}

function animatePart(element, keyframes, options) {
  if (!motionEnabled() || !element.animate) return;
  const animation = element.animate(keyframes, options);
  activeAnimations.add(animation);
  animation.finished.then(
    () => activeAnimations.delete(animation),
    () => activeAnimations.delete(animation)
  );
}

if ("IntersectionObserver" in window) {
  const reveal = new IntersectionObserver((entries, observer) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      if (target.hasAttribute("data-reveal-photo")) {
        animatePart(target,
          [{ clipPath: "inset(0 0 20% 0)" }, { clipPath: "inset(0)" }],
          { duration: 810, easing: "cubic-bezier(.22, 1, .36, 1)" });
        return;
      }
      animatePart(target,
        [{ opacity: .52, transform: "translateY(22px)" }, { opacity: 1, transform: "none" }],
        { duration: 600, easing: "cubic-bezier(.22, 1, .36, 1)" });
    });
  }, { threshold: .12 });

  document.querySelectorAll("[data-reveal], [data-reveal-photo]").forEach((element) => reveal.observe(element));
}

let scrollFrame;
function updateReadingProgress() {
  if (scrollFrame || !motionEnabled()) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = undefined;
    if (!motionEnabled()) return;
    const scrollRoom = Math.max(1, root.scrollHeight - root.clientHeight);
    const progress = Math.min(1, Math.max(0, window.scrollY / scrollRoom));
    scrollProgress.style.transform = "scaleX(" + progress + ")";
  });
}

function resetPointer() {
  postcard.style.removeProperty("--pointer-x");
  postcard.style.removeProperty("--pointer-y");
}

function syncMotion() {
  motionToggle.hidden = motionPreference.matches;
  motionToggle.textContent = motionEnabled() ? "關閉動畫" : "開啟動畫";
  if (motionEnabled()) {
    updateReadingProgress();
    return;
  }
  activeAnimations.forEach((animation) => animation.cancel());
  resetPointer();
  scrollProgress.style.removeProperty("transform");
}

motionToggle.addEventListener("click", () => {
  root.dataset.motion = motionEnabled() ? "off" : "on";
  try {
    sessionStorage.setItem("kansai-motion", root.dataset.motion);
  } catch {
    // The current page still keeps the selected setting.
  }
  syncMotion();
});
motionPreference.addEventListener("change", syncMotion);
window.addEventListener("scroll", updateReadingProgress, { passive: true });
window.addEventListener("resize", updateReadingProgress, { passive: true });

postcard.addEventListener("pointermove", (event) => {
  if (!pointerPreference.matches || event.pointerType === "touch" || !motionEnabled()) return;
  const { left, top, width, height } = postcard.getBoundingClientRect();
  postcard.style.setProperty("--pointer-x", ((event.clientX - left) / width - .5) * 19 + "px");
  postcard.style.setProperty("--pointer-y", ((event.clientY - top) / height - .5) * 14 + "px");
}, { passive: true });
postcard.addEventListener("pointerleave", resetPointer);
syncMotion();
