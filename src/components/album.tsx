import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Rows3, X } from "lucide-react";
import { sheets, type Sheet } from "@/data/sheets";
import { Poster, Star } from "@/components/poster";
import { downloadWindowsAlbum } from "@/lib/windows-album";

type View = "sheet" | "wall";

function RailList({
  query,
  onQuery,
  currentId,
  onPick,
}: {
  query: string;
  onQuery: (value: string) => void;
  currentId: string;
  onPick: (id: string) => void;
}) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sheets;
    return sheets.filter((sheet) =>
      `${sheet.index} ${sheet.part} ${sheet.title} ${sheet.subtitle}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query]);

  return (
    <>
      <input
        className="finder"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Найти лист"
        aria-label="Найти лист"
      />
      {filtered.length === 0 ? <p className="rail-empty">Такого листа нет</p> : null}
      <div className="rail-list">
        {filtered.map((sheet) => (
          <button
            key={sheet.id}
            type="button"
            className={sheet.id === currentId ? "rail-item is-on" : "rail-item"}
            aria-current={sheet.id === currentId ? "page" : undefined}
            onClick={() => onPick(sheet.id)}
          >
            <span className="rail-num">{sheet.index}</span>
            <span>
              <span className="rail-part">{sheet.part}</span>
              <span className="rail-title">{sheet.title}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export function Album() {
  const [id, setId] = useState(sheets[0].id);
  const [view, setView] = useState<View>("sheet");
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [winState, setWinState] = useState<"idle" | "busy" | "done">("idle");

  const index = Math.max(
    0,
    sheets.findIndex((sheet) => sheet.id === id),
  );
  const current = sheets[index] ?? sheets[0];

  async function saveForWindows() {
    if (winState === "busy") return;
    setWinState("busy");
    try {
      await downloadWindowsAlbum();
      setWinState("done");
    } catch {
      setWinState("idle");
    }
  }

  function go(delta: number) {
    const next = sheets[(index + delta + sheets.length) % sheets.length];
    setId(next.id);
  }

  function pick(nextId: string) {
    setId(nextId);
    setListOpen(false);
    if (view === "wall") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(`sheet-${nextId}`)?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start",
      });
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "Escape") setListOpen(false);
      if (view !== "sheet") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, view]);

  useEffect(() => {
    if (view !== "sheet") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [id, view]);

  return (
    <div className="app">
      <header className="appbar no-print">
        <div className="brand">
          <Star className="brand-mark" />
          <div>
            <p className="brand-kicker">Класс боевой подготовки</p>
            <h1>Наглядные листы</h1>
          </div>
        </div>
        <div className="appbar-actions">
          <button className="btn desk-only" type="button" onClick={() => go(-1)}>
            <ChevronLeft />
            Назад
          </button>
          <span className="counter">
            {current.index} / 16
          </span>
          <button className="btn desk-only solid" type="button" onClick={() => go(1)}>
            Далее
            <ChevronRight />
          </button>
          <button
            className={view === "wall" ? "btn is-on" : "btn"}
            type="button"
            onClick={() => setView(view === "wall" ? "sheet" : "wall")}
          >
            <Rows3 />
            <span className="desk-only">{view === "wall" ? "Один лист" : "Стенд"}</span>
          </button>
          <button className="btn" type="button" onClick={saveForWindows} disabled={winState === "busy"}>
            {winState === "busy" ? "Готовлю…" : "Для Windows"}
          </button>
          <button className="btn desk-only" type="button" onClick={() => window.print()}>
            <Printer />
            Печать
          </button>
        </div>
      </header>
      {winState === "done" ? (
        <p className="win-note no-print">
          Файл Naglyadnye-listy-Windows.zip сохранён. Распакуйте его и запустите Otkryt.bat — откроется весь альбом.
        </p>
      ) : null}

      <div className="workspace">
        <aside className="rail no-print">
          <RailList query={query} onQuery={setQuery} currentId={current.id} onPick={pick} />
        </aside>
        <main className="stage">
          {view === "sheet" ? (
            <div className="sheet-frame">
              <Poster sheet={current} />
            </div>
          ) : (
            <div className="wall">
              {sheets.map((sheet: Sheet) => (
                <Poster key={sheet.id} sheet={sheet} />
              ))}
            </div>
          )}
        </main>
      </div>

      <nav className="dock no-print" aria-label="Листание">
        <button className="btn" type="button" onClick={() => go(-1)}>
          <ChevronLeft />
          Назад
        </button>
        <button className="btn" type="button" onClick={() => setListOpen(true)}>
          Листы
        </button>
        <button className="btn" type="button" onClick={() => window.print()}>
          <Printer />
        </button>
        <button className="btn solid" type="button" onClick={() => go(1)}>
          Далее
          <ChevronRight />
        </button>
      </nav>

      {listOpen ? (
        <div className="overlay no-print" role="dialog" aria-modal="true" aria-label="Все листы">
          <div className="overlay-bar">
            <h2>Все листы</h2>
            <button className="btn" type="button" onClick={() => setListOpen(false)}>
              <X />
              Закрыть
            </button>
          </div>
          <div className="overlay-scroll">
            <RailList query={query} onQuery={setQuery} currentId={current.id} onPick={pick} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
