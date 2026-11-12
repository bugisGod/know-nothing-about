// 文章配图点击放大（2026-11-12）。
// 正文 figure 按 720px 排版（不突破正文列、不盖目录），但信息图内文字缩到 0.51 倍后读不清；
// 点开后看原始尺寸。渐进增强：脚本失效时图片仍正常显示，只是不能放大。
// 不引入新视觉语言：灯箱只用 --bg / --border / --text-2 / --accent。
(function () {
  function init() {
    const figures = document.querySelectorAll<HTMLElement>(".prose figure");
    if (!figures.length) return;

    let dialog = document.querySelector<HTMLDialogElement>("dialog.figure-lightbox");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "figure-lightbox";
      dialog.setAttribute("aria-label", "图片放大查看，窄屏可左右滑动看细节，点空白处关闭");

      const close = document.createElement("button");
      close.type = "button";
      close.className = "figure-lightbox-close";
      close.setAttribute("aria-label", "关闭放大视图");
      close.textContent = "×";

      const big = document.createElement("img");
      big.className = "figure-lightbox-img";
      big.alt = "";

      dialog.append(close, big);
      document.body.appendChild(dialog);

      const closeIt = () => dialog?.close();
      close.addEventListener("click", closeIt);
      // 点灯箱空白处关闭；点大图本身不关
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) closeIt();
      });
    }

    const big = dialog.querySelector<HTMLImageElement>(".figure-lightbox-img");
    if (!big) return;

    figures.forEach((fig) => {
      const img = fig.querySelector<HTMLImageElement>("img");
      if (!img || fig.querySelector(".figure-zoom-trigger")) return;
      // 作者已自行包了链接的图不重复包装
      if (img.closest("a")) return;

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "figure-zoom-trigger";
      trigger.setAttribute("aria-label", `放大查看：${img.alt || "文章配图"}`);
      img.parentNode?.insertBefore(trigger, img);
      trigger.appendChild(img);

      trigger.addEventListener("click", () => {
        big.src = img.currentSrc || img.src;
        big.alt = img.alt;
        dialog?.showModal();
      });
    });
  }

  init();
  document.addEventListener("astro:page-load", init);
})();
