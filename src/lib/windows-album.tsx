import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Poster } from "@/components/poster";
import { sheets } from "@/data/sheets";

const sourceFiles = import.meta.glob(
  ["../components/*.{ts,tsx}", "../data/sheets.ts", "../styles.css", "../routes/index.tsx", "./*.tsx"],
  { query: "?raw", import: "default" },
);

const FIT_SCRIPT = `
function fitSheet(frame) {
  var page = frame.querySelector(".a4-sheet");
  var content = frame.querySelector(".a4-content");
  if (!page || !content) return;
  var pageW = page.clientWidth;
  var pageH = page.clientHeight;
  if (pageW < 2 || pageH < 2) return;
  content.style.transform = "none";
  content.style.width = pageW + "px";
  var baseH = content.scrollHeight;
  if (baseH <= pageH + 2) {
    content.style.width = "100%";
    content.style.transform = "none";
  } else {
    var lo = Math.max(0.42, pageH / baseH);
    var hi = 1;
    var best = lo;
    for (var step = 0; step < 8; step++) {
      var scale = (lo + hi) / 2;
      content.style.width = pageW / scale + "px";
      var height = content.scrollHeight;
      if (height * scale <= pageH + 2) {
        best = scale;
        lo = scale;
      } else {
        hi = scale;
      }
    }
    content.style.width = pageW / best + "px";
    content.style.transformOrigin = "top left";
    content.style.transform = "scale(" + best + ")";
  }
  if (window.matchMedia("print").matches) {
    page.style.transform = "none";
    return;
  }
  var natural = page.offsetWidth || 1;
  page.style.transformOrigin = "top left";
  page.style.transform = "scale(" + frame.clientWidth / natural + ")";
}
function fitAll() {
  document.querySelectorAll(".a4-frame").forEach(fitSheet);
}
window.addEventListener("beforeprint", fitAll);
window.addEventListener("afterprint", fitAll);
window.addEventListener("resize", fitAll);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
window.addEventListener("load", fitAll);
fitAll();
`;

function blobToData(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function collectedCss() {
  let css = "";
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) css += `${rule.cssText}\n`;
  }
  const urls = [...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((match) => match[2]);
  const unique = [...new Set(urls)].filter((url) => !url.startsWith("data:"));
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (url) => {
      try {
        const response = await fetch(new URL(url, location.href));
        if (!response.ok) return;
        map.set(url, await blobToData(await response.blob()));
      } catch {
        /* leave the original url */
      }
    }),
  );
  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (all, _quote, url) => {
    const data = map.get(url);
    return data ? `url("${data}")` : all;
  });
}

function crc32(data: Uint8Array) {
  let crc = ~0;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function zipStore(files: { name: string; data: Uint8Array }[]) {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, file.data);
    const entry = new Uint8Array(46 + name.length);
    const directory = new DataView(entry.buffer);
    directory.setUint32(0, 0x02014b50, true);
    directory.setUint16(4, 20, true);
    directory.setUint16(6, 20, true);
    directory.setUint32(16, crc, true);
    directory.setUint32(20, file.data.length, true);
    directory.setUint32(24, file.data.length, true);
    directory.setUint16(28, name.length, true);
    directory.setUint32(42, offset, true);
    entry.set(name, 46);
    central.push(entry);
    offset += local.length + file.data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const tail = new DataView(end.buffer);
  tail.setUint32(0, 0x06054b50, true);
  tail.setUint16(8, files.length, true);
  tail.setUint16(10, files.length, true);
  tail.setUint32(12, centralSize, true);
  tail.setUint32(16, offset, true);
  const chunks = [...locals, ...central, end].map(
    (part) => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer,
  );
  return new Blob(chunks, { type: "application/zip" });
}

export async function downloadWindowsAlbum() {
  const host = document.createElement("div");
  host.className = "wall";
  host.style.cssText = "position:fixed;left:-200vw;top:0;width:1100px;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(
        <>
          {sheets.map((sheet) => (
            <Poster key={sheet.id} sheet={sheet} />
          ))}
        </>,
      );
    });
    if (document.fonts?.ready) await document.fonts.ready;
    const liveImages = [...host.querySelectorAll("img")];
    await Promise.all(
      liveImages.map(
        (img) =>
          img.complete && img.naturalWidth > 0
            ? null
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              }),
      ),
    );

    const css = await collectedCss();
    const clone = host.cloneNode(true) as HTMLElement;
    clone.querySelectorAll<HTMLElement>(".a4-sheet, .a4-content").forEach((node) => {
      node.style.transform = "";
      node.style.width = "";
      node.style.transformOrigin = "";
    });
    const clonedImages = [...clone.querySelectorAll("img")];
    await Promise.all(
      liveImages.map(async (img, index) => {
        const src = img.getAttribute("src");
        if (!src || src.startsWith("data:")) return;
        const response = await fetch(img.src);
        if (!response.ok) return;
        clonedImages[index]?.setAttribute("src", await blobToData(await response.blob()));
      }),
    );

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Наглядные листы</title>
<style>
${css.replace(/<\/style/gi, "<\\/style")}
.winbar{display:flex;flex-wrap:wrap;gap:.6rem 1rem;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:#12180f;color:#efe4c8;font-family:"Segoe UI",sans-serif}
.winbar p{margin:0;max-width:42rem;font-size:.95rem}
.winbar button{font:inherit;cursor:pointer;border:0;background:#3e4a2e;color:#efe4c8;padding:.55rem .9rem;letter-spacing:.04em;text-transform:uppercase}
</style>
</head>
<body class="app">
<header class="winbar no-print">
  <div>
    <strong>Наглядные листы</strong>
    <p>Весь альбом, 16 листов. Печать кладёт каждый лист на одну страницу A4 с полями 10 мм. В окне печати включите фоновые рисунки.</p>
  </div>
  <button type="button" onclick="window.print()">Печать всех листов</button>
</header>
${clone.outerHTML}
<script>
${FIT_SCRIPT}
</script>
</body>
</html>`;

    const readme = `Наглядные листы — весь проект для Windows

1. Распакуйте архив в любую папку.
2. Дважды щёлкните Otkryt.bat — откроется весь альбом из 16 листов.
3. Можно открыть и сам index.html.
4. Кнопка «Печать всех листов» печатает каждый лист на одну страницу A4.
   В окне печати выберите бумагу A4 и включите фоновые рисунки.
5. Папка foto — фотографии листов. Папка ishodniki — исходные файлы альбома.
`;
    const bat = `@echo off\r\ncd /d "%~dp0"\r\nstart "" "%~dp0index.html"\r\n`;
    const encoder = new TextEncoder();
    const files: { name: string; data: Uint8Array }[] = [
      { name: "Naglyadnye-listy-Windows/Otkryt.bat", data: encoder.encode(bat) },
      {
        name: "Naglyadnye-listy-Windows/Prochti.txt",
        data: encoder.encode(`\uFEFF${readme}`),
      },
      { name: "Naglyadnye-listy-Windows/index.html", data: encoder.encode(html) },
    ];

    const photos = [...new Set(sheets.flatMap((sheet) => (sheet.photo ? [sheet.photo.src] : [])))];
    await Promise.all(
      photos.map(async (src) => {
        const response = await fetch(src);
        if (!response.ok) return;
        const name = src.split("/").pop() ?? "photo.jpg";
        files.push({
          name: `Naglyadnye-listy-Windows/foto/${name}`,
          data: new Uint8Array(await response.arrayBuffer()),
        });
      }),
    );

    await Promise.all(
      Object.entries(sourceFiles).map(async ([path, load]) => {
        const text = String(await load());
        const name = path.replace(/^\.\.\//, "").replace(/^\.\//, "lib/");
        files.push({
          name: `Naglyadnye-listy-Windows/ishodniki/${name}`,
          data: encoder.encode(text),
        });
      }),
    );

    const blob = zipStore(files);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Naglyadnye-listy-Windows.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  } finally {
    root.unmount();
    host.remove();
  }
}
