"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  benenneSetlisteUm,
  dupliziereSetliste,
  entferneSong,
  erstelleSetliste,
  fuegeSongHinzu,
  loescheSetliste,
  speichereSetlistReihenfolge,
} from "@/lib/setlistActions";
import { formatDauer, parseDauerEingabe, summeDauer } from "@/lib/dauer";
import type { BandSong } from "@/lib/types";
import type { SetlisteMitSongs } from "@/lib/queries";

const inputClass =
  "w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none";

function SongZeile({
  song,
  bereitsInSetliste,
  onHinzufuegen,
  onLoeschen,
}: {
  song: BandSong;
  bereitsInSetliste: boolean;
  onHinzufuegen: () => void;
  onLoeschen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `catalog-${song.id}`,
    data: { herkunft: "catalog", songId: song.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`flex items-center gap-2 border-t border-slate-100 py-1.5 first:border-t-0 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span
        {...listeners}
        {...attributes}
        className="cursor-grab select-none px-1 text-slate-300"
        title="Ziehen zum Hinzufügen"
      >
        ⠿⠿
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-900">{song.titel}</p>
        {song.interpret && <p className="truncate text-xs text-slate-500">{song.interpret}</p>}
      </div>
      <span className="shrink-0 text-xs text-slate-400">{formatDauer(song.dauer_sekunden)}</span>
      <button
        type="button"
        disabled={bereitsInSetliste}
        onClick={onHinzufuegen}
        className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        title="Zur Setliste hinzufügen"
      >
        +
      </button>
      <button
        type="button"
        onClick={onLoeschen}
        className="shrink-0 text-slate-300 hover:text-red-600"
        title="Song löschen"
      >
        ×
      </button>
    </div>
  );
}

function SetlistZeile({
  song,
  position,
  onEntfernen,
}: {
  song: BandSong;
  position: number;
  onEntfernen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `setlist-${song.id}`,
    data: { herkunft: "setlist", songId: song.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 border-t border-slate-100 py-1.5 first:border-t-0 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span {...listeners} {...attributes} className="cursor-grab select-none px-1 text-slate-300">
        ⠿⠿
      </span>
      <span className="w-5 shrink-0 text-xs text-slate-400">{position + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-900">{song.titel}</p>
        {song.interpret && <p className="truncate text-xs text-slate-500">{song.interpret}</p>}
      </div>
      <span className="shrink-0 text-xs text-slate-400">{formatDauer(song.dauer_sekunden)}</span>
      <button
        type="button"
        onClick={onEntfernen}
        className="shrink-0 text-slate-300 hover:text-red-600"
        title="Aus Setliste entfernen"
      >
        ×
      </button>
    </div>
  );
}

export function SetlisteBuilder({
  bandId,
  initialSongs,
  initialSetlisten,
}: {
  bandId: string;
  initialSongs: BandSong[];
  initialSetlisten: SetlisteMitSongs[];
}) {
  const [songs, setSongs] = useState<BandSong[]>(initialSongs);
  const [setlisten, setSetlisten] = useState(
    initialSetlisten.map((s) => ({ id: s.id, name: s.name }))
  );
  const [aktiveSetlisteId, setAktiveSetlisteId] = useState<string | null>(
    initialSetlisten[0]?.id ?? null
  );
  const [songIdsProSetliste, setSongIdsProSetliste] = useState<Record<string, string[]>>(
    Object.fromEntries(initialSetlisten.map((s) => [s.id, s.songs.map((sg) => sg.id)]))
  );

  const [neuerSong, setNeuerSong] = useState({ titel: "", interpret: "", dauer: "" });
  const [songFehler, setSongFehler] = useState<string | null>(null);
  const [neueSetlisteName, setNeueSetlisteName] = useState("");
  const [zeigeNeueSetliste, setZeigeNeueSetliste] = useState(false);
  const [umbenennenAktiv, setUmbenennenAktiv] = useState(false);
  const [umbenennenText, setUmbenennenText] = useState("");
  const [setlistenFehler, setSetlistenFehler] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const songById = Object.fromEntries(songs.map((s) => [s.id, s]));
  const aktiveSongIds = aktiveSetlisteId ? songIdsProSetliste[aktiveSetlisteId] ?? [] : [];
  const aktiveSongs = aktiveSongIds.map((id) => songById[id]).filter(Boolean);
  const gesamtDauer = summeDauer(aktiveSongs.map((s) => s.dauer_sekunden));
  const { setNodeRef: setDropRef } = useDroppable({ id: "setlist-container" });

  async function handleSongHinzufuegen() {
    if (!neuerSong.titel.trim()) return;
    setSongFehler(null);
    const ergebnis = await fuegeSongHinzu(
      bandId,
      neuerSong.titel,
      neuerSong.interpret || null,
      neuerSong.dauer ? parseDauerEingabe(neuerSong.dauer) : null
    );
    if (!ergebnis.ok) {
      setSongFehler(ergebnis.fehler);
      return;
    }
    setSongs((prev) => [...prev, ergebnis.song].sort((a, b) => a.titel.localeCompare(b.titel)));
    setNeuerSong({ titel: "", interpret: "", dauer: "" });
  }

  async function handleSongLoeschen(songId: string) {
    if (!confirm("Song wirklich löschen? Er wird aus allen Setlisten entfernt.")) return;
    await entferneSong(songId, bandId);
    setSongs((prev) => prev.filter((s) => s.id !== songId));
    setSongIdsProSetliste((prev) => {
      const next: Record<string, string[]> = {};
      for (const [setlistId, ids] of Object.entries(prev)) {
        next[setlistId] = ids.filter((id) => id !== songId);
      }
      return next;
    });
  }

  function speichern(setlistId: string, songIds: string[]) {
    speichereSetlistReihenfolge(setlistId, bandId, songIds).catch((err) => {
      console.error("Setliste speichern fehlgeschlagen", err);
    });
  }

  // Wichtig: setSongIdsProBand-Updater bleiben rein (keine Server-Action-
  // Aufrufe darin) - React darf Updater-Funktionen mehrfach/während des
  // Renderns aufrufen, Nebenwirkungen dort verursachen den Router-Fehler
  // "Cannot update a component while rendering a different component".
  function fuegeZuSetlisteHinzu(songId: string, vorPosition?: number) {
    if (!aktiveSetlisteId || aktiveSongIds.includes(songId)) return;
    const index = vorPosition ?? aktiveSongIds.length;
    const next = [...aktiveSongIds.slice(0, index), songId, ...aktiveSongIds.slice(index)];
    setSongIdsProSetliste((prev) => ({ ...prev, [aktiveSetlisteId]: next }));
    speichern(aktiveSetlisteId, next);
  }

  function entferneAusSetliste(songId: string) {
    if (!aktiveSetlisteId) return;
    const next = aktiveSongIds.filter((id) => id !== songId);
    setSongIdsProSetliste((prev) => ({ ...prev, [aktiveSetlisteId]: next }));
    speichern(aktiveSetlisteId, next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !aktiveSetlisteId) return;
    const data = active.data.current as { herkunft: "catalog" | "setlist"; songId: string };

    if (data.herkunft === "catalog") {
      const overId = String(over.id);
      let vorPosition: number | undefined;
      if (overId.startsWith("setlist-")) {
        const overSongId = overId.replace("setlist-", "");
        const idx = aktiveSongIds.indexOf(overSongId);
        if (idx !== -1) vorPosition = idx;
      }
      fuegeZuSetlisteHinzu(data.songId, vorPosition);
      return;
    }

    const overId = String(over.id);
    if (!overId.startsWith("setlist-")) return;
    const overSongId = overId.replace("setlist-", "");
    const altIndex = aktiveSongIds.indexOf(data.songId);
    const neuIndex = aktiveSongIds.indexOf(overSongId);
    if (altIndex === -1 || neuIndex === -1 || altIndex === neuIndex) return;
    const next = arrayMove(aktiveSongIds, altIndex, neuIndex);
    setSongIdsProSetliste((prev) => ({ ...prev, [aktiveSetlisteId]: next }));
    speichern(aktiveSetlisteId, next);
  }

  async function handleNeueSetliste() {
    if (!neueSetlisteName.trim()) return;
    setSetlistenFehler(null);
    const ergebnis = await erstelleSetliste(bandId, neueSetlisteName);
    if (!ergebnis.ok) {
      setSetlistenFehler(ergebnis.fehler);
      return;
    }
    setSetlisten((prev) => [...prev, { id: ergebnis.setliste.id, name: ergebnis.setliste.name }]);
    setSongIdsProSetliste((prev) => ({ ...prev, [ergebnis.setliste.id]: [] }));
    setAktiveSetlisteId(ergebnis.setliste.id);
    setNeueSetlisteName("");
    setZeigeNeueSetliste(false);
  }

  async function handleUmbenennen() {
    if (!aktiveSetlisteId || !umbenennenText.trim()) return;
    setSetlistenFehler(null);
    const ergebnis = await benenneSetlisteUm(aktiveSetlisteId, bandId, umbenennenText);
    if (!ergebnis.ok) {
      setSetlistenFehler(ergebnis.fehler);
      return;
    }
    setSetlisten((prev) =>
      prev.map((s) => (s.id === aktiveSetlisteId ? { ...s, name: umbenennenText.trim() } : s))
    );
    setUmbenennenAktiv(false);
  }

  async function handleDuplizieren() {
    if (!aktiveSetlisteId) return;
    const aktuelleSetliste = setlisten.find((s) => s.id === aktiveSetlisteId);
    if (!aktuelleSetliste) return;
    const ergebnis = await dupliziereSetliste(
      aktiveSetlisteId,
      bandId,
      `${aktuelleSetliste.name} (Kopie)`
    );
    if (!ergebnis.ok) {
      setSetlistenFehler(ergebnis.fehler);
      return;
    }
    setSetlisten((prev) => [...prev, { id: ergebnis.setliste.id, name: ergebnis.setliste.name }]);
    setSongIdsProSetliste((prev) => ({
      ...prev,
      [ergebnis.setliste.id]: [...(prev[aktiveSetlisteId] ?? [])],
    }));
    setAktiveSetlisteId(ergebnis.setliste.id);
  }

  async function handleLoeschen() {
    if (!aktiveSetlisteId) return;
    const aktuelleSetliste = setlisten.find((s) => s.id === aktiveSetlisteId);
    if (!confirm(`Setliste "${aktuelleSetliste?.name}" wirklich löschen?`)) return;
    await loescheSetliste(aktiveSetlisteId, bandId);
    const rest = setlisten.filter((s) => s.id !== aktiveSetlisteId);
    setSetlisten(rest);
    setSongIdsProSetliste((prev) => {
      const next = { ...prev };
      delete next[aktiveSetlisteId];
      return next;
    });
    setAktiveSetlisteId(rest[0]?.id ?? null);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-medium text-slate-900">Songs ({songs.length})</h2>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={neuerSong.titel}
              onChange={(e) => setNeuerSong((prev) => ({ ...prev, titel: e.target.value }))}
              placeholder="Titel"
              className={inputClass}
            />
            <input
              value={neuerSong.interpret}
              onChange={(e) => setNeuerSong((prev) => ({ ...prev, interpret: e.target.value }))}
              placeholder="Interpret"
              className={inputClass}
            />
            <input
              value={neuerSong.dauer}
              onChange={(e) => setNeuerSong((prev) => ({ ...prev, dauer: e.target.value }))}
              placeholder="3:42"
              className={`${inputClass} sm:w-20`}
            />
            <button
              type="button"
              onClick={handleSongHinzufuegen}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              + Song
            </button>
          </div>
          {songFehler && <p className="mb-2 text-xs text-red-600">{songFehler}</p>}
          <div className="flex flex-col">
            {songs.length === 0 ? (
              <p className="text-sm text-slate-500">Noch keine Songs angelegt.</p>
            ) : (
              songs.map((song) => (
                <SongZeile
                  key={song.id}
                  song={song}
                  bereitsInSetliste={aktiveSongIds.includes(song.id)}
                  onHinzufuegen={() => fuegeZuSetlisteHinzu(song.id)}
                  onLoeschen={() => handleSongLoeschen(song.id)}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          {setlisten.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-slate-500">Noch keine Setliste angelegt.</p>
              <div className="flex gap-2">
                <input
                  value={neueSetlisteName}
                  onChange={(e) => setNeueSetlisteName(e.target.value)}
                  placeholder="z. B. Standardset"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleNeueSetliste}
                  className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Anlegen
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2">
                <select
                  value={aktiveSetlisteId ?? ""}
                  onChange={(e) => setAktiveSetlisteId(e.target.value)}
                  className={inputClass}
                >
                  {setlisten.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {zeigeNeueSetliste ? (
                  <>
                    <input
                      value={neueSetlisteName}
                      onChange={(e) => setNeueSetlisteName(e.target.value)}
                      placeholder="Name"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={handleNeueSetliste}
                      className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Anlegen
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setZeigeNeueSetliste(true)}
                    className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    + Neu
                  </button>
                )}
              </div>

              {umbenennenAktiv ? (
                <div className="mb-2 flex items-center gap-2">
                  <input
                    value={umbenennenText}
                    onChange={(e) => setUmbenennenText(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleUmbenennen}
                    className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Speichern
                  </button>
                </div>
              ) : (
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setUmbenennenText(setlisten.find((s) => s.id === aktiveSetlisteId)?.name ?? "");
                        setUmbenennenAktiv(true);
                      }}
                      className="text-xs text-slate-600 underline hover:text-slate-900"
                    >
                      umbenennen
                    </button>
                    <button
                      type="button"
                      onClick={handleDuplizieren}
                      className="text-xs text-slate-600 underline hover:text-slate-900"
                    >
                      duplizieren
                    </button>
                    <button
                      type="button"
                      onClick={handleLoeschen}
                      className="text-xs text-red-600 underline hover:text-red-800"
                    >
                      löschen
                    </button>
                    {aktiveSetlisteId && aktiveSongs.length > 0 && (
                      <Link
                        href={`/druckansicht/${aktiveSetlisteId}`}
                        target="_blank"
                        className="text-xs text-slate-600 underline hover:text-slate-900"
                      >
                        drucken
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{formatDauer(gesamtDauer)}</span>
                </div>
              )}
              {setlistenFehler && <p className="mb-2 text-xs text-red-600">{setlistenFehler}</p>}

              <div ref={setDropRef} className="flex min-h-[80px] flex-col">
                {aktiveSongs.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Songs von links reinziehen oder mit &quot;+&quot; hinzufügen.
                  </p>
                ) : (
                  <SortableContext
                    items={aktiveSongs.map((s) => `setlist-${s.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {aktiveSongs.map((song, index) => (
                      <SetlistZeile
                        key={song.id}
                        song={song}
                        position={index}
                        onEntfernen={() => entferneAusSetliste(song.id)}
                      />
                    ))}
                  </SortableContext>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DndContext>
  );
}
