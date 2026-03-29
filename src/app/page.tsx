import VideoGenerator from "@/components/VideoGenerator";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            AI Video Generator
          </h1>
          <p className="text-gray-400 text-lg">
            Upload an image, describe the motion, and generate a video with AI.
          </p>
        </div>
        <VideoGenerator />
      </div>
    </main>
  );
}
