import { useLayoutEffect, useRef } from "react";
import type { Sheet, SheetBlock } from "@/data/sheets";

export function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1.8 14.7 8.2 21.6 8.8 16.4 13.3 18 20.1 12 16.6 6 20.1 7.6 13.3 2.4 8.8 9.3 8.2 12 1.8Z"
      />
    </svg>
  );
}

function BlockView({ block }: { block: SheetBlock }) {
  switch (block.type) {
    case "facts":
      return (
        <div className="facts">
          {block.items.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      );
    case "prose":
      return (
        <div className="prose">
          {block.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      );
    case "heading":
      return <h3 className="block-title">{block.text}</h3>;
    case "bullets":
      return (
        <ul className="plain-list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="step-list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "note":
      return <p className="note">{block.text}</p>;
    case "warning":
      return (
        <div className="warn">
          <strong>{block.title}</strong>
          <p>{block.text}</p>
        </div>
      );
    case "specs":
      return (
        <dl className="specs">
          {block.rows.map((row) => (
            <div key={row.k}>
              <dt>{row.k}</dt>
              <dd>{row.v}</dd>
            </div>
          ))}
        </dl>
      );
    case "table":
      return <DataTable block={block} />;
    case "matrix":
      return <Matrix block={block} />;
    case "groups":
      return (
        <div className={block.columns === 3 ? "cards cols-3" : "cards cols-2"}>
          {block.items.map((item) => (
            <section className="group-card" key={item.title}>
              <h3>{item.title}</h3>
              <ul>
                {item.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      );
    case "sign":
      return (
        <div className="sign">
          {block.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      );
    default:
      return null;
  }
}

function DataTable({
  block,
}: {
  block: Extract<SheetBlock, { type: "table" }>;
}) {
  const rest = Math.max(block.columns.length - 1, 1);
  return (
    <div>
      {block.caption ? <p className="caption">{block.caption}</p> : null}
      <div
        className={`grid-table only-wide ${block.variant}`}
        style={{ ["--rest" as string]: String(rest) }}
      >
        {block.columns.map((column) => (
          <div className="cell th" key={column}>
            {column}
          </div>
        ))}
        {block.rows.map((row, rowIndex) =>
          row.map((cell, cellIndex) => (
            <div
              className={rowIndex % 2 === 1 ? "cell alt" : "cell"}
              key={`${row[0]}-${cellIndex}`}
            >
              {cell}
            </div>
          )),
        )}
      </div>
      <div className="stack-table only-narrow">
        {block.rows.map((row) => (
          <article className="stack-card" key={row[0]}>
            <header>{row[0]}</header>
            {row.slice(1).map((cell, index) => (
              <p key={block.columns[index + 1]}>
                <span>{block.columns[index + 1]}</span>
                {cell}
              </p>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}

function Matrix({ block }: { block: Extract<SheetBlock, { type: "matrix" }> }) {
  const rest = block.columns.length;
  return (
    <div>
      {block.caption ? <p className="caption">{block.caption}</p> : null}
      <div className="grid-table code only-wide" style={{ ["--rest" as string]: String(rest) }}>
        <div className="cell th">{block.corner}</div>
        {block.columns.map((column) => (
          <div className="cell th" key={column}>
            {column}
          </div>
        ))}
        {block.rows.map((row, rowIndex) => (
          <MatrixRow key={row.code} row={row} alt={rowIndex % 2 === 1} />
        ))}
      </div>
      <div className="stack-table only-narrow">
        {block.rows.map((row) => (
          <article className="stack-card" key={row.code}>
            <header>
              {block.corner} {row.code}
            </header>
            {row.cells.map((cell, index) => (
              <p key={block.columns[index]}>
                <span>{block.columns[index]}</span>
                {cell}
              </p>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}

function MatrixRow({
  row,
  alt,
}: {
  row: { code: string; cells: string[] };
  alt: boolean;
}) {
  return (
    <>
      <div className="cell code">{row.code}</div>
      {row.cells.map((cell, index) => (
        <div className={alt ? "cell alt" : "cell"} key={`${row.code}-${index}`}>
          {cell}
        </div>
      ))}
    </>
  );
}

const PHOTO_FOCUS: Record<string, string> = {
  "06": "74% 52%",
  "08": "32% 42%",
  "12": "center 16%",
  "13": "62% 50%",
  "16": "center 12%",
};

function useA4Fit(sheetId: string) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const page = pageRef.current;
    const content = contentRef.current;
    if (!frame || !page || !content) return;

    const fit = () => {
      const pageW = page.clientWidth;
      const pageH = page.clientHeight;
      if (pageW < 2 || pageH < 2) return;

      content.style.transform = "none";
      content.style.width = `${pageW}px`;
      const baseH = content.scrollHeight;

      if (baseH <= pageH + 2) {
        content.style.width = "100%";
        content.style.transform = "none";
      } else {
        let lo = Math.max(0.42, pageH / baseH);
        let hi = 1;
        let best = lo;
        for (let step = 0; step < 8; step += 1) {
          const scale = (lo + hi) / 2;
          content.style.width = `${pageW / scale}px`;
          const height = content.scrollHeight;
          if (height * scale <= pageH + 2) {
            best = scale;
            lo = scale;
          } else {
            hi = scale;
          }
        }
        content.style.width = `${pageW / best}px`;
        content.style.transformOrigin = "top left";
        content.style.transform = `scale(${best})`;
      }

      if (window.matchMedia("print").matches) {
        page.style.transform = "none";
        return;
      }
      const natural = page.offsetWidth || 1;
      const outer = frame.clientWidth / natural;
      page.style.transformOrigin = "top left";
      page.style.transform = `scale(${outer})`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    document.fonts?.ready.then(fit).catch(() => undefined);
    window.addEventListener("beforeprint", fit);
    window.addEventListener("afterprint", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", fit);
      window.removeEventListener("afterprint", fit);
    };
  }, [sheetId]);

  return { frameRef, pageRef, contentRef };
}

export function Poster({ sheet }: { sheet: Sheet }) {
  const photo = sheet.photo;
  const side = photo?.frame === "side";
  const { frameRef, pageRef, contentRef } = useA4Fit(sheet.id);

  return (
    <div className="poster-hang">
      <div className="pins no-print" aria-hidden="true">
        <i />
        <i />
      </div>
      <div className="a4-frame" id={`sheet-${sheet.id}`} ref={frameRef}>
        <div className="a4-sheet" ref={pageRef}>
          <div className="a4-content" ref={contentRef}>
            <article
              className={
                side ? "paper frame-side" : photo ? `paper has-photo frame-${photo.frame}` : "paper"
              }
              lang="ru"
            >
              {photo ? (
                <div className="paper-bg" aria-hidden="true">
                  <img
                    src={photo.src}
                    alt=""
                    style={{ objectPosition: PHOTO_FOCUS[sheet.id] ?? "center 32%" }}
                  />
                </div>
              ) : null}
              <div className="paper-bar" aria-hidden="true" />
              <div className="paper-body">
                <div className={photo && !side ? "photo-mast" : undefined}>
                  <header className="poster-head">
                    <div className="poster-kicker">
                      <Star className="star" />
                      <div>
                        <p className="kicker-org">Сборник материалов для занятий</p>
                        <p className="kicker-kind">Учебный плакат</p>
                      </div>
                    </div>
                    <div className="sheet-badge">
                      <span>Лист</span>
                      <strong>{sheet.index}</strong>
                    </div>
                  </header>
                  <div className="poster-title-block">
                    <p className="poster-part">{sheet.part}</p>
                    <h2>{sheet.title}</h2>
                    <p className="poster-sub">{sheet.subtitle}</p>
                  </div>
                </div>
                <div className="poster-blocks">
                  {sheet.blocks.map((block, index) => (
                    <BlockView key={`${sheet.id}-${index}`} block={block} />
                  ))}
                </div>
                {photo ? <p className="sr-only">{photo.alt}</p> : null}
                <footer className="poster-foot">
                  <span>Лист {sheet.index} из 16</span>
                  <span>Текст набран по сборнику</span>
                  <span>{sheet.part}</span>
                </footer>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
