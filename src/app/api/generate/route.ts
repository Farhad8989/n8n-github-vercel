import { NextRequest, NextResponse } from "next/server";

const REPLICATE_MODEL_VERSION =
  "4eaf2b01d3bf70d8a2e00b219efeb7cb415855ad18b7dacdc4cae664a73a6eea";

export async function POST(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Video generation service is not configured." },
      { status: 503 }
    );
  }

  let body: { image?: string; prompt?: string; ratio?: string; duration?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { image, prompt, ratio, duration } = body;

  if (!image || !prompt) {
    return NextResponse.json(
      { error: "Both 'image' and 'prompt' are required." },
      { status: 400 }
    );
  }

  const allowedRatios = ["16:9", "9:16"];
  const safeRatio = allowedRatios.includes(ratio ?? "") ? ratio! : "16:9";
  const numFrames = (duration ?? 5) >= 10 ? 81 : 41;

  try {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: REPLICATE_MODEL_VERSION,
        input: {
          image,
          prompt,
          resolution: safeRatio,
          num_frames: numFrames,
          frames_per_second: 8,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.detail ?? "Failed to start video generation." },
        { status: response.status }
      );
    }

    if (!data.id) {
      return NextResponse.json(
        { error: "Replicate did not return a prediction ID." },
        { status: 502 }
      );
    }

    return NextResponse.json({ taskId: data.id, status: "pending" });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the video generation service." },
      { status: 502 }
    );
  }
}
