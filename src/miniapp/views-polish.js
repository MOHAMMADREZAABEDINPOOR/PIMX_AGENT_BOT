// ─────────────────────────────────────────────
// ✨ Mini App view polish layer
// یک لایهٔ افزایشی (نه بازنویسی) که بعد از رندر هر View اجرا میشود و
// زبان طراحی واحد را روی همهٔ صفحهها اعمال میکند:
//   ۱) سرصفحهٔ استاندارد (اگر صفحه ندارد)
//   ۲) انیمیشن ورود ظریف برای کارتهای اصلی
//   ۳) aria-label برای دکمههای فقط-آیکن
//   ۴) اصلاح رنگهای inline قدیمی در تم روشن
// هیچ منطق تجاری و هیچ APIای تغییر نمیکند.
// ─────────────────────────────────────────────
export const VIEWS_POLISH = String.raw`
(function () {
  "use strict";
  var A = window.AFTER = window.AFTER || {};

  var ROUTES = [
    "chat", "council", "playground",
    "providers", "provider", "models", "model", "compare", "routing",
    "agents", "agent", "runs", "run", "tools", "memory", "knowledge", "prompts", "projects",
    "automation", "monitor", "costs", "eval", "alerts", "approvals", "settings", "tenants"
  ];

  /* ── ۴) تم روشن: هم‌رنگ‌سازی overlay های inline قدیمی ── */
  function normAlpha(a) {
    a = Number(a);
    if (!isFinite(a)) return 0.04;
    return Math.min(0.1, Math.max(0.02, a * 0.9));
  }
  function normalizeInline(root) {
    var nodes = root.querySelectorAll('[style*="rgba(255, 255, 255"], [style*="rgba(255,255,255"], [style*="rgba(15, 23, 42"], [style*="rgba(15,23,42"], [style*="rgba(12, 17, 30"], [style*="rgba(12,17,30"]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute("data-px-norm") === "1") return;
      if (el.classList.contains("skeleton") || el.classList.contains("spark") || el.classList.contains("dot")) return;
      var st = el.getAttribute("style") || "";
      var out = st
        .replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)/g, function (_, a) {
          return "rgba(15, 23, 42, " + normAlpha(a) + ")";
        })
        .replace(/rgba\(\s*15\s*,\s*23\s*,\s*42\s*,\s*[0-9.]+\s*\)/g, "var(--bg2)")
        .replace(/rgba\(\s*12\s*,\s*17\s*,\s*30\s*,\s*[0-9.]+\s*\)/g, "var(--surface)");
      if (out !== st) { el.setAttribute("style", out); el.setAttribute("data-px-norm", "1"); }
    });
  }

  /* ── ۳) دکمه‌های فقط-آیکن بدون برچسب ── */
  function labelIcons(root) {
    Array.prototype.forEach.call(root.querySelectorAll("button"), function (b) {
      if (b.getAttribute("aria-label")) return;
      var txt = (b.textContent || "").trim();
      if (txt) return;
      var t = b.getAttribute("title");
      b.setAttribute("aria-label", t || "اقدام");
    });
  }

  /* ── ۱ و ۲) سرصفحه + انیمیشن ورود ── */
  function polish() {
    var view = document.getElementById("view");
    if (!view) return;
    var route = (window.S && S.route) || "home";

    if (route !== "chat" && !view.querySelector(".ph")) {
      var meta = (typeof TITLES !== "undefined" && TITLES[route]) || [route, ""];
      try {
        view.insertAdjacentHTML("afterbegin", pageHead({ title: meta[0], sub: meta[1] }));
      } catch (e) { }
    }

    if (route !== "chat") {
      var kids = view.children;
      for (var i = 0; i < kids.length && i < 6; i++) {
        if (kids[i].classList.contains("ph")) continue;
        kids[i].classList.add("px-in");
        if (i > 0 && i < 5) kids[i].classList.add("px-in-" + i);
      }
    }

    labelIcons(view);
    if (document.documentElement.getAttribute("data-px-theme") === "light") {
      try { normalizeInline(view); } catch (e) { }
    }
  }
  window.pxPolishView = polish;

  /* ── زنجیره‌کردن روی AFTERهای موجود (بدون حذف آن‌ها) ── */
  ROUTES.forEach(function (r) {
    var prev = A[r];
    A[r] = async function () {
      if (typeof prev === "function") { try { await prev.apply(null, arguments); } catch (e) { console.warn("[AFTER prev]", r, e); } }
      try { polish(); } catch (e) { console.warn("[polish]", r, e); }
    };
  });

  /* در تم روشن، داده‌های قدیمی inline هم دوباره هم‌رنگ می‌شوند */
  var _setTheme = window.pxSetTheme;
  window.pxSetTheme = function (mode) {
    if (typeof _setTheme === "function") _setTheme(mode);
    setTimeout(function () { if (window.render) render(); }, 30);
  };
})();
`;
