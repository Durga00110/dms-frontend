// src/workers/zip.worker.ts
// Builds the ZIP off the main thread. Receives binary file data (never text),
// returns the finished archive as a Uint8Array.
import { zipSync } from 'fflate';

interface IncomingFile {
    name: string;
    data: ArrayBuffer;
}

// Keep names safe inside the archive: no folders, no control characters, unique.
function safeName(name: string): string {
    const cleaned = name
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
        .replace(/^\.+/, '')
        .trim()
        .slice(0, 150);
    return cleaned || 'file';
}

function uniqueName(name: string, used: Set<string>): string {
    if (!used.has(name.toLowerCase())) {
        used.add(name.toLowerCase());
        return name;
    }
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let i = 2;
    while (used.has(`${base} (${i})${ext}`.toLowerCase())) i++;
    const result = `${base} (${i})${ext}`;
    used.add(result.toLowerCase());
    return result;
}

self.onmessage = (event: MessageEvent<{ files: IncomingFile[] }>) => {
    try {
        const files = event.data?.files;
        if (!Array.isArray(files) || files.length === 0) {
            throw new Error('No files were provided for the ZIP.');
        }

        const used = new Set<string>();
        const entries: Record<string, Uint8Array> = {};
        for (const file of files) {
            entries[uniqueName(safeName(file.name), used)] = new Uint8Array(file.data);
        }

        // PDFs and images are already compressed, so store them (level 0) for speed.
        const archive = zipSync(entries, { level: 0 });

        self.postMessage({ archive }, { transfer: [archive.buffer] });
    } catch (error) {
        self.postMessage({
            error: error instanceof Error ? error.message : 'ZIP generation failed',
        });
    }
};