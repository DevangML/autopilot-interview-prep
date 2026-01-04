/**
 * Note Exporter/Importer
 * Handles export/import of dry run notes (browser-compatible)
 */

/**
 * Export all notes for a user (client-side version)
 * @param {Array} notes - Array of note objects
 * @returns {string} - JSON string
 */
export function exportAllNotes(notes) {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    notes: notes.map(note => ({
      id: note.id,
      itemId: note.itemId,
      domain: note.domain,
      title: note.title,
      type: note.type,
      content: note.content,
      screenshotUrl: note.screenshotUrl,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    }))
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Import notes from JSON string (client-side version)
 * @param {string} jsonString - JSON string
 * @returns {Array} - Array of note objects
 */
export function importNotesFromJSON(jsonString) {
  const exportData = JSON.parse(jsonString);
  
  if (exportData.version !== '1.0') {
    throw new Error(`Unsupported export version: ${exportData.version}`);
  }
  
  return exportData.notes || [];
}

/**
 * Download note as file (browser)
 * @param {Object} note - Note object
 */
export function downloadNoteAsFile(note) {
  const json = exportAllNotes([note]);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.type}_${note.id || Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download all notes as file (browser)
 * @param {Array} notes - Array of note objects
 */
export function downloadAllNotesAsFile(notes) {
  const json = exportAllNotes(notes);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dry_run_notes_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

