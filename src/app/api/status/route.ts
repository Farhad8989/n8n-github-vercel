import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Status service is not configured." },
      { status: 503 }
    );
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json(
      { error: "'taskId' query parameter is required." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${encodeURIComponent(taskId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.detail ?? "Failed to check video status." },
        { status: response.status }
      );
    }

    // Map Replicate statuses to our statuses
    if (data.status === "succeeded") {
      const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      return NextResponse.json({ status: "completed", videoUrl });
    } else if (data.status === "failed" || data.status === "canceled") {
      return NextResponse.json({
        status: "failed",
        error: data.error ?? "Video generation failed.",
      });
    } else {
      // starting, processing
      return NextResponse.json({ status: "processing" });
    }
  } catch {
    return NextResponse.json(
      { error: "Could not reach the status service." },
      { status: 502 }
    );
  }
}
