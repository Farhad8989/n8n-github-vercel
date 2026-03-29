import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const webhookUrl = process.env.N8N_STATUS_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Status service is not configured." },
      { status: 503 }
    );
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "'taskId' query parameter is required." }, { status: 400 });
  }

  try {
    const n8nResponse = await fetch(`${webhookUrl}?taskId=${encodeURIComponent(taskId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const responseText = await n8nResponse.text();

    if (!responseText || responseText.trim() === "") {
      return NextResponse.json(
        { error: "Status service returned an empty response. Check n8n workflow logs." },
        { status: 502 }
      );
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: "Status service returned an invalid response." },
        { status: 502 }
      );
    }

    if (!n8nResponse.ok) {
      return NextResponse.json(
        { error: (data?.error as string) ?? "Failed to check video status." },
        { status: n8nResponse.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Could not reach the status service. Check your n8n webhook URL." },
      { status: 502 }
    );
  }
}
