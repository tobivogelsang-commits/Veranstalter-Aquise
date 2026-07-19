"use client";

import { useRef } from "react";

const knopfClass =
  "rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200";

// Einfaches contentEditable-Feld mit Basis-Formatierung, bewusst ohne
// Editor-Bibliothek. "defaultValue" statt "value": der Inhalt wird nur beim
// Mounten gesetzt, nicht bei jedem Tastendruck neu ins DOM geschrieben -
// sonst würde die Cursor-Position bei jedem Zeichen zurückspringen. Soll der
// Inhalt von außen ersetzt werden (z. B. Vorlage auswählen), muss die
// aufrufende Stelle einen neuen "key" übergeben (erzwingt Remount).
export function HtmlEditor({
  defaultValue,
  onChange,
  onBildHochladen,
}: {
  defaultValue: string;
  onChange: (html: string) => void;
  onBildHochladen?: (datei: File) => Promise<string | null>;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const dateiInputRef = useRef<HTMLInputElement>(null);
  // Manche Browser wrappen den allerersten getippten/eingefügten Text in
  // einem leeren contentEditable ungefragt in <b> (Signatur: ein <b>/<strong>,
  // das als einziges Kind seines Elternknotens steht und dessen kompletten
  // Textinhalt umschließt). pruefeUngewollteFettformatierung erkennt genau
  // dieses Muster und entfernt es wieder - außer der Nutzer hat Fett bewusst
  // über den Button ausgewählt, dann bleibt es unangetastet.
  const fettManuellRef = useRef(false);

  function formatieren(befehl: string) {
    editorRef.current?.focus();
    if (befehl === "bold") fettManuellRef.current = true;
    document.execCommand(befehl);
    onChange(editorRef.current?.innerHTML ?? "");
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

  // Reine Texteingabe (Tippen, Einfügen) selbst per execCommand("insertText")
  // einfügen statt dem Browser die native Verarbeitung zu überlassen - manche
  // Browser wenden auf den allerersten Text in einem leeren contentEditable
  // sonst ungefragt eine Standard-Formatierung (fett) an. Formatierungs-
  // Buttons und Bild-Einfügen laufen unverändert über execCommand direkt.
  // Nebeneffekt: Eingefügter Text aus der Zwischenablage kommt immer als
  // reiner Text an, ohne fremde Formatierung aus Word/Google Docs o. Ä.
  function beforeInputBehandeln(e: React.FormEvent<HTMLDivElement>) {
    const event = e.nativeEvent as InputEvent;
    if (
      event.inputType === "insertText" ||
      event.inputType === "insertReplacementText" ||
      event.inputType === "insertFromPaste"
    ) {
      const text =
        event.data ??
        event.dataTransfer?.getData("text/plain") ??
        null;
      if (text !== null) {
        event.preventDefault();
        document.execCommand("insertText", false, text);
      }
    }
  }

  return (
    <div className="rounded-md border border-slate-300">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => formatieren("bold")}
          className={knopfClass}
        >
          <strong>F</strong>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => formatieren("italic")}
          className={knopfClass}
        >
          <em>K</em>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => formatieren("insertUnorderedList")}
          className={knopfClass}
        >
          Liste
        </button>
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
        onBeforeInput={beforeInputBehandeln}
        onInput={() => {
          ungewollteFettformatierungEntfernen();
          onChange(editorRef.current?.innerHTML ?? "");
        }}
        // Ein wirklich leeres contentEditable (innerHTML "") lässt Chrome den
        // allerersten getippten Buchstaben teils fälschlich fett einfügen, da
        // die Formatierung für einen Cursor direkt im Root-Element (ohne
        // umgebendes Block-Element) uneindeutig ist. Ein leerer Block als
        // Startzustand gibt dem Cursor einen eindeutigen, unformatierten
        // Kontext.
        dangerouslySetInnerHTML={{ __html: defaultValue || "<div><br></div>" }}
      />
    </div>
  );
}
