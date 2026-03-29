import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_GENERATE_WEBHOOK_URL;
  if (!webhookUrl) {
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

  try {
    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, prompt, ratio: ratio ?? "1280:720", duration: duration ?? 5 }),
    });

    const data = await n8nResponse.json();

    if (!n8nResponse.ok) {
      return NextResponse.json(
        { error: data?.error ?? "Failed to start video generation." },
        { status: n8nResponse.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Could not reach the video generation service. Check your n8n webhook URL." },
      { status: 502 }
    );
  }
}
