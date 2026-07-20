"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import clsx from "clsx";

const knopfClass =
  "rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200";
// Sichtbar "eingerastet", solange die Formatierung an der Cursorposition gilt.
const knopfAktivClass = "bg-slate-300 text-slate-900 hover:bg-slate-300";

// Bewusst wenige, klar unterscheidbare Stufen statt einer Punktgenau-Auswahl -
// in einer Akquise-Mail geht es um "Überschrift", "normal" und "Kleingedrucktes".
// "Normal" entspricht der Grundgröße des Editors (text-sm = 14px).
const SCHRIFTGROESSEN = [
  { name: "Klein", wert: "12px" },
  { name: "Normal", wert: "14px" },
  { name: "Groß", wert: "18px" },
] as const;

export type HtmlEditorHandle = {
  insertLink: (url: string, label: string) => void;
  insertHtml: (html: string) => void;
};

export function escapeAttribut(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Einfaches contentEditable-Feld mit Basis-Formatierung, bewusst ohne
// Editor-Bibliothek. "defaultValue" statt "value": der Inhalt wird nur beim
// Mounten gesetzt, nicht bei jedem Tastendruck neu ins DOM geschrieben -
// sonst würde die Cursor-Position bei jedem Zeichen zurückspringen. Soll der
// Inhalt von außen ersetzt werden (z. B. Vorlage auswählen), muss die
// aufrufende Stelle einen neuen "key" übergeben (erzwingt Remount).
export const HtmlEditor = forwardRef<
  HtmlEditorHandle,
  {
    defaultValue: string;
    onChange: (html: string) => void;
    onBildHochladen?: (datei: File) => Promise<string | null>;
  }
>(function HtmlEditor({ defaultValue, onChange, onBildHochladen }, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const dateiInputRef = useRef<HTMLInputElement>(null);

  // Startinhalt EINMALIG beim Mounten ins DOM schreiben - bewusst nicht über
  // dangerouslySetInnerHTML. React würde den Inhalt sonst bei jedem Re-Render
  // des Elternteils erneut setzen und damit alles Getippte verwerfen: schon ein
  // "Lädt hoch…"-Zustand beim Anhang-Upload hat so die ganze Mail gelöscht.
  // Nach dem Mounten gehört der Inhalt dem Nutzer bzw. dem DOM; soll er von
  // außen ersetzt werden (Vorlage wählen), erzwingt die aufrufende Stelle über
  // einen neuen "key" einen Remount, wodurch dieser Effekt erneut läuft.
  //
  // Ein wirklich leeres contentEditable (innerHTML "") lässt Chrome den ersten
  // getippten Buchstaben teils fälschlich fett einfügen - ein leerer Block gibt
  // dem Cursor einen eindeutigen, unformatierten Kontext.
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = defaultValue || "<div><br></div>";
    }
    // Nur beim Mounten - deshalb bewusst ohne defaultValue in den Dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Manche Browser wrappen den allerersten getippten/eingefügten Text in
  // einem leeren contentEditable ungefragt in <b> (Signatur: ein <b>/<strong>,
  // das als einziges Kind seines Elternknotens steht und dessen kompletten
  // Textinhalt umschließt). pruefeUngewollteFettformatierung erkennt genau
  // dieses Muster und entfernt es wieder - außer der Nutzer hat Fett bewusst
  // über den Button ausgewählt, dann bleibt es unangetastet.
  const fettManuellRef = useRef(false);

  // Damit die Toolbar anzeigt, welche Formatierung an der Cursorposition gilt
  // (sonst sieht man nicht, ob Fett gerade an ist). queryCommandState ist wie
  // execCommand offiziell veraltet, passt aber zum Ansatz dieses Editors und
  // funktioniert in allen Zielbrowsern.
  const [aktiveFormate, setAktiveFormate] = useState({
    bold: false,
    italic: false,
    underline: false,
    insertUnorderedList: false,
  });

  const aktualisiereAktiveFormate = useCallback(() => {
    const wurzel = editorRef.current;
    const auswahl = document.getSelection();
    // Nur reagieren, wenn der Cursor wirklich in diesem Editor steht - sonst
    // würden sich zwei Editoren auf derselben Seite gegenseitig markieren.
    if (!wurzel || !auswahl?.anchorNode || !wurzel.contains(auswahl.anchorNode)) {
      return;
    }
    setAktiveFormate({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
    });
  }, []);

  // selectionchange gibt es nur auf document-Ebene, nicht am Element.
  useEffect(() => {
    document.addEventListener("selectionchange", aktualisiereAktiveFormate);
    return () =>
      document.removeEventListener("selectionchange", aktualisiereAktiveFormate);
  }, [aktualisiereAktiveFormate]);

  function formatieren(befehl: string) {
    editorRef.current?.focus();
    if (befehl === "bold") fettManuellRef.current = true;
    document.execCommand(befehl);
    onChange(editorRef.current?.innerHTML ?? "");
    aktualisiereAktiveFormate();
  }

  // Zuletzt gewählte Schriftgröße - nötig, weil execCommand("fontSize") bei
  // leerer Auswahl keine Auszeichnung erzeugt, sondern nur einen Stil für das
  // NÄCHSTE Zeichen vormerkt. Das Ersetzen des Markers muss dann beim Tippen
  // nachgeholt werden (siehe onInput).
  const letzteGroesseRef = useRef<string>(SCHRIFTGROESSEN[1].wert);

  // execCommand kennt nur die Stufen 1-7 und erzeugt veraltete <font>-Tags.
  // Stufe 7 dient uns deshalb nur als Markierung, die wir sofort durch ein
  // <span style="font-size:…"> ersetzen: Inline-CSS ist das, was E-Mail-
  // Programme zuverlässig darstellen, <font size> ignorieren manche.
  function markerInSpansUmwandeln() {
    const wurzel = editorRef.current;
    if (!wurzel) return;
    const marker = wurzel.querySelectorAll('font[size="7"]');
    if (marker.length === 0) return;

    // Cursorposition merken: Beim Austausch der Elemente verwirft der Browser
    // die Auswahl und setzt den Cursor an den Anfang. Getippter Text landete
    // dadurch rückwärts - aus "Mus" wurde "usM".
    const auswahl = document.getSelection();
    const gemerkt =
      auswahl && auswahl.rangeCount > 0
        ? {
            knoten: auswahl.getRangeAt(0).startContainer,
            versatz: auswahl.getRangeAt(0).startOffset,
          }
        : null;

    marker.forEach((el) => {
      const span = document.createElement("span");
      span.style.fontSize = letzteGroesseRef.current;
      while (el.firstChild) span.appendChild(el.firstChild);
      el.replaceWith(span);
    });

    // Die Textknoten wurden nur umgehängt, nicht neu erzeugt - die gemerkte
    // Position bleibt daher gültig.
    if (auswahl && gemerkt && wurzel.contains(gemerkt.knoten)) {
      try {
        const bereich = document.createRange();
        bereich.setStart(gemerkt.knoten, gemerkt.versatz);
        bereich.collapse(true);
        auswahl.removeAllRanges();
        auswahl.addRange(bereich);
      } catch {
        // Position nicht mehr gültig - dann lieber die Browser-Vorgabe
        // stehen lassen, als den Editor mit einem Fehler abzuwürgen.
      }
    }
  }

  function setzeSchriftgroesse(wert: string) {
    const wurzel = editorRef.current;
    if (!wurzel) return;
    letzteGroesseRef.current = wert;
    wurzel.focus();
    document.execCommand("fontSize", false, "7");
    markerInSpansUmwandeln();
    onChange(wurzel.innerHTML);
  }

  function ungewollteFettformatierungEntfernen() {
    const wurzel = editorRef.current;
    if (!wurzel || fettManuellRef.current) return;

    function findeUmschliessendesFett(knoten: Element): HTMLElement | null {
      if (knoten.children.length !== 1) return null;
      const kind = knoten.children[0];
      if (
        (kind.tagName === "B" || kind.tagName === "STRONG") &&
        kind.textContent === knoten.textContent
      ) {
        return kind as HTMLElement;
      }
      return findeUmschliessendesFett(kind);
    }

    const treffer = findeUmschliessendesFett(wurzel);
    if (!treffer) return;
    while (treffer.firstChild) {
      treffer.parentNode?.insertBefore(treffer.firstChild, treffer);
    }
    treffer.remove();
  }

  async function bildAuswahlBehandeln(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    e.target.value = "";
    if (!datei || !onBildHochladen) return;

    const url = await onBildHochladen(datei);
    if (!url) return;

    editorRef.current?.focus();
    document.execCommand("insertImage", false, url);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function insertHtml(html: string) {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  useImperativeHandle(ref, () => ({
    insertLink(url: string, label: string) {
      insertHtml(
        `<a href="${escapeAttribut(url)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline">${escapeText(label)}</a>`
      );
    },
    insertHtml,
  }));

  return (
    <div className="rounded-md border border-slate-300">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => formatieren("bold")}
          aria-pressed={aktiveFormate.bold}
          className={clsx(knopfClass, aktiveFormate.bold && knopfAktivClass)}
        >
          <strong>F</strong>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => formatieren("italic")}
          aria-pressed={aktiveFormate.italic}
          className={clsx(knopfClass, aktiveFormate.italic && knopfAktivClass)}
        >
          <em>K</em>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => formatieren("underline")}
          aria-pressed={aktiveFormate.underline}
          className={clsx(knopfClass, aktiveFormate.underline && knopfAktivClass)}
        >
          <u>U</u>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => formatieren("insertUnorderedList")}
          aria-pressed={aktiveFormate.insertUnorderedList}
          className={clsx(
            knopfClass,
            aktiveFormate.insertUnorderedList && knopfAktivClass
          )}
        >
          Liste
        </button>
        <span className="mx-1 w-px self-stretch bg-slate-300" aria-hidden />
        {SCHRIFTGROESSEN.map((groesse) => (
          <button
            key={groesse.wert}
            type="button"
            title={`Schriftgröße ${groesse.name} (markierten Text auswählen)`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setzeSchriftgroesse(groesse.wert)}
            className={knopfClass}
          >
            {groesse.name}
          </button>
        ))}
        {onBildHochladen && (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => dateiInputRef.current?.click()}
              className={knopfClass}
            >
              🖼️ Bild einfügen
            </button>
            <input
              ref={dateiInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={bildAuswahlBehandeln}
            />
          </>
        )}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[150px] px-3 py-2 text-sm font-normal focus:outline-none [&_img]:my-2 [&_img]:max-w-full"
        onInput={() => {
          ungewollteFettformatierungEntfernen();
          markerInSpansUmwandeln();
          onChange(editorRef.current?.innerHTML ?? "");
          aktualisiereAktiveFormate();
        }}
        onBlur={() =>
          setAktiveFormate({
            bold: false,
            italic: false,
            underline: false,
            insertUnorderedList: false,
          })
        }
      />
    </div>
  );
});
