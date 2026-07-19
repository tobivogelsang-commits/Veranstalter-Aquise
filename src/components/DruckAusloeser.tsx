"use client";

import { useEffect } from "react";

// Öffnet automatisch den System-Druckdialog (dort kann "Als PDF speichern"
// gewählt werden) - der Nutzer kann den Dialog jederzeit abbrechen.
export function DruckAusloeser() {
  useEffect(() => {
    window.print();
  }, []);

  return null;
}
