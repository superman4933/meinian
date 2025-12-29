import { NextRequest, NextResponse } from "next/server";
import * as qiniu from "qiniu";
import { QINIU_CONFIG } from "@/lib/qiniu-config";
import { nanoid } from "nanoid";

// 处理 GET 请求，返回方法不允许的错误
export async function GET() {
  return NextResponse.json(
    { success: false, message: "此接口仅支持 POST 方法，请使用 POST 请求上传文件" },
    { status: 405 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "未找到文件" },
        { status: 400 }
      );
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成唯一文件名
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${Date.now()}-${nanoid()}.${fileExtension}`;

    // 配置七牛云
    const mac = new qiniu.auth.digest.Mac(QINIU_CONFIG.accessKey, QINIU_CONFIG.secretKey);
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: QINIU_CONFIG.bucket,
    });
    const uploadToken = putPolicy.uploadToken(mac);

    // 上传到七牛云
    const config = new qiniu.conf.Config();
    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();

    return new Promise<NextResponse>((resolve) => {
      formUploader.put(
        uploadToken,
        fileName,
        buffer,
        putExtra,
        (respErr, respBody, respInfo) => {
          if (respErr) {
            console.error("七牛云上传失败:", respErr);
            resolve(
              NextResponse.json(
                {
                  success: false,
                  message: `七牛云上传失败: ${respErr.message || "未知错误"}`,
                  error_source: "七牛云",
                },
                { status: 500 }
              )
            );
            return;
          }

          if (respInfo.statusCode !== 200) {
            console.error("七牛云上传失败:", {
              statusCode: respInfo.statusCode,
              body: respBody,
            });
            resolve(
              NextResponse.json(
                {
                  success: false,
                  message: `七牛云上传失败 (${respInfo.statusCode}): ${respBody?.error || "未知错误"}`,
                  error_source: "七牛云",
                  status: respInfo.statusCode,
                  details: respBody,
                },
                { status: respInfo.statusCode }
              )
            );
            return;
          }

          // 构建文件访问URL（确保域名末尾有斜杠，key 开头没有斜杠）
          const domain = QINIU_CONFIG.domain.endsWith('/') 
            ? QINIU_CONFIG.domain 
            : `${QINIU_CONFIG.domain}/`;
          const key = respBody.key?.startsWith('/') 
            ? respBody.key.slice(1) 
            : respBody.key;
          const fileUrl = key ? `${domain}${key}` : null;

          console.log("文件上传成功 - 七牛云返回数据:", {
            fileName: file.name,
            fileSize: file.size,
            qiniuKey: respBody.key,
            fileUrl: fileUrl,
          });

          if (!fileUrl) {
            resolve(
              NextResponse.json(
                {
                  success: false,
                  message: "文件上传成功但无法获取访问URL",
                  error_source: "七牛云",
                },
                { status: 500 }
              )
            );
            return;
          }

          resolve(
            NextResponse.json({
              success: true,
              file_url: fileUrl,
              file_name: file.name,
              file_size: file.size,
              url: fileUrl,
            })
          );
        }
      );
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "上传失败，请稍后重试",
      },
      { status: 500 }
    );
  }
}

