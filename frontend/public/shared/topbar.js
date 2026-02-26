(function () {
  const mount = document.getElementById("site-topbar");
  if (!mount) return;

  const activeKey = document.body?.getAttribute("data-nav") || "";
  const currentScript = document.currentScript;
  const sharedBase = currentScript?.src
    ? new URL("./", currentScript.src)
    : new URL("shared/", window.location.href);
  const topbarUrl = new URL("topbar.html", sharedBase);

  fetch(topbarUrl, { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load topbar");
      }
      return response.text();
    })
    .then((html) => {
      mount.innerHTML = html;
      if (!activeKey) return;
      const activeLink = mount.querySelector(`[data-nav="${activeKey}"]`);
      if (activeLink) activeLink.classList.add("active");
      if (activeKey === "tester") {
        const cta = mount.querySelector(".topbar-cta");
        if (cta) cta.classList.add("active");
      }
    })
    .catch(() => {
      mount.innerHTML = "";
    });
})();
