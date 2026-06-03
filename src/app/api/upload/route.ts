import { NextRequest, NextResponse } from "next/server";
import { S3Storage } from "coze-coding-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 });
    }

    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName: `uploads/${file.name}`,
      contentType: file.type || "application/octet-stream",
    });

    const url = await storage.generatePresignedUrl({ key, expireTime: 86400 });

    return NextResponse.json({ success: true, key, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
