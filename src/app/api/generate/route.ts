import { NextRequest, NextResponse } from "next/server";

async function uploadImageToLeonardo(
  imageBase64: string,
  apiKey: string
): Promise<string> {
  // Strip the data URI prefix, get extension
  const match = imageBase64.match(/^data:image\/([\w]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image format");
  const rawExt = match[1];
  const ext = rawExt === "jpg" || rawExt === "jpeg" ? "jpg" : rawExt === "webp" ? "webp" : "png";
  const base64Data = match[2];

  // Step 1: Get presigned S3 URL from Leonardo
  const initRes = await fetch("https://cloud.leonardo.ai/api/rest/v1/init-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ extension: ext }),
  });
  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`Leonardo init-image failed ${initRes.status}: ${err.slice(0, 400)}`);
  }
  const initData = (await initRes.json()).uploadInitImage;
  const { id: imageId, url: uploadUrl, fields: fieldsRaw } = initData;
  const fields = typeof fieldsRaw === "string" ? JSON.parse(fieldsRaw) : fieldsRaw;

  // Step 2: Upload binary image to S3 via multipart/form-data
  const imageBytes = Buffer.from(base64Data, "base64");
  const mimeType = ext === "jpg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";

  const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);

  // S3 requires fields in a specific order; Content-Type must come right before the file
  const orderedKeys = Object.keys(fields).filter((k) => k !== "Content-Type");
  if (fields["Content-Type"]) orderedKeys.push("Content-Type");

  const parts: Buffer[] = [];
  for (const key of orderedKeys) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${fields[key]}\r\n`,
        "utf8"
      )
    );
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
      "utf8"
    )
  );
  parts.push(imageBytes);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"));

  const body = Buffer.concat(parts);

  const s3Res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });

  if (s3Res.status >= 300) {
    const errText = await s3Res.text();
    throw new Error(`S3 upload failed ${s3Res.status}: ${errText.slice(0, 400)}`);
  }

  return imageId;
}

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_GENERATE_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Video generation service is not configured." },
      { status: 503 }
    );
  }

  const leonardoApiKey = process.env.LEONARDO_API_KEY;
  if (!leonardoApiKey) {
    return NextResponse.json(
      { error: "Leonardo API key is not configured." },
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

  let imageId: string;
  try {
    imageId = await uploadImageToLeonardo(image, leonardoApiKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Image upload failed: ${msg}` },
      { status: 502 }
    );
  }

  try {
    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId, prompt: prompt.trim(), ratio: ratio ?? "16:9", duration: duration ?? 5 }),
    });

    const responseText = await n8nResponse.text();

    if (!responseText || responseText.trim() === "") {
      return NextResponse.json(
        { error: "Video generation service returned an empty response. Check n8n workflow logs." },
        { status: 502 }
      );
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: "Video generation service returned an invalid response." },
        { status: 502 }
      );
    }

    if (!n8nResponse.ok) {
      return NextResponse.json(
        { error: (data?.error as string) ?? "Failed to start video generation." },
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
