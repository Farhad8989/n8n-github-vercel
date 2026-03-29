"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type AppState = "idle" | "starting" | "processing" | "completed" | "error";

const ASPECT_RATIOS = [
  { label: "Landscape (1280×768)", value: "1280:768" },
  { label: "Portrait (768×1280)", value: "768:1280" },
  { label: "Landscape 16:9", value: "16:9" },
  { label: "Portrait 9:16", value: "9:16" },
];

const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024; // 3.5 MB (safe limit for base64 → Runway)
const POLL_INTERVAL_MS = 5000;

export default function VideoGenerator() {
  const [state, setState] = useState<AppState>("idle");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState(ASPECT_RATIOS[0].value);
  const [duration, setDuration] = useState(5);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => clearPoll(), []);

  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload a valid image file (JPEG, PNG, or WebP).");
      setState("error");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMsg(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max size is 3.5 MB.`);
      setState("error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
      setState("idle");
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) loadImage(file);
    },
    [loadImage]
  );

  const pollStatus = useCallback((id: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/status?taskId=${encodeURIComponent(id)}`);
        const data = await res.json();

        if (data.status === "completed" && data.videoUrl) {
          clearPoll();
          setVideoUrl(data.videoUrl);
          setState("completed");
        } else if (data.status === "failed") {
          clearPoll();
          setErrorMsg(data.error ?? "Video generation failed. Try again with a different image or prompt.");
          setState("error");
        }
        // "processing" → keep polling
      } catch {
        clearPoll();
        setErrorMsg("Lost connection while checking video status. Please try again.");
        setState("error");
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const handleGenerate = async () => {
    if (!imageBase64 || !prompt.trim()) return;

    clearPoll();
    setState("starting");
    setErrorMsg(null);
    setVideoUrl(null);
    setTaskId(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64, prompt: prompt.trim(), ratio, duration }),
      });
      const data = await res.json();

      if (!res.ok || !data.taskId) {
        setErrorMsg(data.error ?? "Failed to start video generation. Check your n8n configuration.");
        setState("error");
        return;
      }

      setTaskId(data.taskId);
      setState("processing");
      pollStatus(data.taskId);
    } catch {
      setErrorMsg("Could not connect to the generation service. Check your environment variables.");
      setState("error");
    }
  };

  const handleReset = () => {
    clearPoll();
    setState("idle");
    setImagePreview(null);
    setImageBase64(null);
    setPrompt("");
    setTaskId(null);
    setVideoUrl(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async () => {
    if (!videoUrl) return;
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-video-${taskId ?? Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(videoUrl, "_blank");
    }
  };

  const isReady = !!imageBase64 && prompt.trim().length > 0;
  const isLoading = state === "starting" || state === "processing";

  return (
    <div className="bg-gray-900 rounded-2xl p-6 shadow-xl space-y-6">

      {/* Image Upload */}
      {state !== "completed" && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Source Image
          </label>
          <div
            className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer
              ${dragOver ? "border-violet-400 bg-violet-950/30" : "border-gray-700 hover:border-gray-500"}
              ${imagePreview ? "p-2" : "p-10 text-center"}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Uploaded preview"
                className="w-full max-h-64 object-contain rounded-lg"
              />
            ) : (
              <div className="text-gray-500 select-none">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-sm">Drop an image here or <span className="text-violet-400 underline">browse</span></p>
                <p className="text-xs mt-1">JPEG, PNG, WebP · max 3.5 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
          />
          {imagePreview && (
            <button
              onClick={(e) => { e.stopPropagation(); handleReset(); }}
              className="text-xs text-gray-500 hover:text-red-400 mt-1 transition-colors"
            >
              Remove image
            </button>
          )}
        </div>
      )}

      {/* Prompt */}
      {state !== "completed" && (
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
            Video Prompt
          </label>
          <textarea
            id="prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the motion: e.g. 'The camera slowly zooms in while leaves gently fall in the background'"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none transition-colors"
            disabled={isLoading}
          />
        </div>
      )}

      {/* Options */}
      {state !== "completed" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Aspect Ratio</label>
            <select
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              disabled={isLoading}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
            >
              {ASPECT_RATIOS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Duration: {duration}s
            </label>
            <input
              type="range"
              min={5}
              max={10}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={isLoading}
              className="w-full accent-violet-500 mt-2 disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-0.5">
              <span>5s</span><span>10s</span>
            </div>
          </div>
        </div>
      )}

      {/* Processing State */}
      {(state === "starting" || state === "processing") && (
        <div className="bg-gray-800 rounded-xl p-5 text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm font-medium text-gray-200">
            {state === "starting" ? "Starting generation..." : "Generating your video..."}
          </p>
          {taskId && (
            <p className="text-xs text-gray-500 font-mono">Task: {taskId}</p>
          )}
          {state === "processing" && (
            <p className="text-xs text-gray-500">
              This usually takes 60–120 seconds. Checking every 5s...
            </p>
          )}
        </div>
      )}

      {/* Error State */}
      {state === "error" && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 space-y-2">
          <p className="text-sm text-red-300 font-medium">Generation failed</p>
          <p className="text-xs text-red-400">{errorMsg}</p>
          <button
            onClick={() => { setState("idle"); setErrorMsg(null); }}
            className="text-xs text-red-300 underline hover:text-red-100 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Completed State */}
      {state === "completed" && videoUrl && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-green-400">Video ready!</p>
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full rounded-xl bg-black"
          />
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl py-3 transition-colors"
            >
              Download Video
            </button>
            <button
              onClick={handleReset}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl py-3 transition-colors"
            >
              Generate Another
            </button>
          </div>
        </div>
      )}

      {/* Generate Button */}
      {(state === "idle" || state === "error") && (
        <button
          onClick={handleGenerate}
          disabled={!isReady || isLoading}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 transition-colors text-sm"
        >
          Generate Video
        </button>
      )}
    </div>
  );
}
