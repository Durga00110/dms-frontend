
import { Zip, ZipDeflate } from "fflate";

type ZipFile = {
  url: string;
  name: string;
};

type WorkerRequest = {
  files: ZipFile[];
  token: string;
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { files, token } = event.data;
  const zip = new Zip();
  const chunks: Uint8Array[] = [];

  let completed = 0;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;

    // Copy each chunk into an ArrayBuffer-backed Uint8Array.
    // This resolves the BlobPart / ArrayBufferLike TypeScript error.
    const blobParts: BlobPart[] = chunks.map((chunk) => {
      const copy = new Uint8Array(chunk.byteLength);
      copy.set(chunk);
      return copy;
    });

    const blob = new Blob(blobParts, {
      type: "application/zip",
    });

    self.postMessage({
      type: "done",
      blob,
      total: files.length,
    });
  };

  zip.ondata = (error, chunk, final) => {
    if (error) {
      if (!finished) {
        finished = true;
        self.postMessage({
          type: "error",
          message: error.message,
        });
      }
      return;
    }

    chunks.push(chunk);

    if (final) finish();
  };

  try {
    if (!files.length) {
      throw new Error("No documents available to download.");
    }

    for (const file of files) {
      const response = await fetch(file.url, {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {},
      });

      if (!response.ok) {
        throw new Error(
          `Failed to download ${file.name}: HTTP ${response.status}`,
        );
      }

      const buffer = await response.arrayBuffer();
      const safeName = file.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");

      const entry = new ZipDeflate(
        safeName || `document-${completed + 1}`,
        { level: 6 },
      );

      zip.add(entry);

      // Process file contents in 1 MB chunks in the worker.
      const bytes = new Uint8Array(buffer);
      const chunkSize = 1024 * 1024;

      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, bytes.length);
        entry.push(bytes.subarray(offset, end), end === bytes.length);
      }

      // Finalize empty files too.
      if (bytes.length === 0) {
        entry.push(new Uint8Array(0), true);
      }

      completed++;

      self.postMessage({
        type: "progress",
        completed,
        total: files.length,
        currentFile: safeName,
      });
    }

    zip.end();
  } catch (error) {
    if (!finished) {
      finished = true;
      self.postMessage({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create ZIP archive.",
      });
    }
  }
};

export {};
