interface ZipFile {
  name: string;
  url: string;
}

type WorkerResponse =
  | { type: "PROGRESS"; message: string }
  | {
      type: "SUCCESS";
      buffer: ArrayBuffer;
      filename: string;
    }
  | { type: "ERROR"; message: string };

export function downloadAllAsZip(
  files: ZipFile[],
  onProgress?: (message: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/zip.worker.ts", import.meta.url),
      { type: "module" }
    );

    let settled = false;

    const cleanup = () => worker.terminate();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;

      if (data.type === "PROGRESS") {
        onProgress?.(data.message);
        return;
      }

      if (settled) return;
      settled = true;

      if (data.type === "ERROR") {
        cleanup();
        reject(new Error(data.message));
        return;
      }

      try {
        const blob = new Blob([data.buffer], {
          type: "application/zip",
        });

        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = objectUrl;
        anchor.download = data.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);

        cleanup();
        resolve();
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    worker.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("ZIP worker failed."));
    };

    worker.postMessage({ type: "GENERATE_ZIP", files });
  });
}