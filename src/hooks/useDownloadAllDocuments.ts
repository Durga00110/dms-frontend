
import { useCallback, useEffect, useRef, useState } from "react";

type ZipFile = {
  url: string;
  name: string;
};

type DownloadProgress = {
  completed: number;
  total: number;
  currentFile?: string;
};

export const useDownloadAllDocuments = () => {
  const workerRef = useRef<Worker | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const downloadAll = useCallback(
    (files: ZipFile[], token: string) => {
      if (workerRef.current) return;

      if (!files.length) {
        setError("No documents available to download.");
        return;
      }

      setError("");
      setProgress({ completed: 0, total: files.length });
      setIsDownloading(true);

      const worker = new Worker(
        new URL("../workers/documentZip.worker.ts", import.meta.url),
        { type: "module" },
      );

      workerRef.current = worker;

      worker.onmessage = (event) => {
        const message = event.data;

        if (message.type === "progress") {
          setProgress({
            completed: message.completed,
            total: message.total,
            currentFile: message.currentFile,
          });
        }

        if (message.type === "done") {
          const url = URL.createObjectURL(message.blob);
          const link = document.createElement("a");

          link.href = url;
          link.download = "documents.zip";
          document.body.appendChild(link);
          link.click();
          link.remove();

          // Delay revocation to allow the browser to start the download.
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

          worker.terminate();
          workerRef.current = null;
          setProgress({
            completed: message.total,
            total: message.total,
          });
          setIsDownloading(false);
        }

        if (message.type === "error") {
          setError(message.message);
          worker.terminate();
          workerRef.current = null;
          setIsDownloading(false);
        }
      };

      worker.onerror = () => {
        setError("The ZIP worker failed. Please try again.");
        worker.terminate();
        workerRef.current = null;
        setIsDownloading(false);
      };

      worker.postMessage({ files, token });
    },
    [],
  );

  const cancelDownload = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsDownloading(false);
    setProgress(null);
  }, []);

  return {
    downloadAll,
    cancelDownload,
    isDownloading,
    progress,
    error,
  };
};
