import { NextRequest, NextResponse } from "next/server";
import * as qiniu from "qiniu";
import { QINIU_CONFIG } from "@/lib/qiniu-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfUrl, fileName } = body;

    if (!pdfUrl) {
      return NextResponse.json(
        { success: false, message: "PDF URL 不能为空" },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        { success: false, message: "文件名不能为空" },
        { status: 400 }
      );
    }

    // 清理文件名，移除非法字符
    const sanitizedFileName = fileName
      .replace(/[<>:"/\\|?*]/g, "_") // 替换非法字符
      .replace(/\s+/g, "_") // 替换空格为下划线
      .trim();

    // 确保文件名以 .pdf 结尾
    const finalFileName = sanitizedFileName.endsWith(".pdf") 
      ? sanitizedFileName 
      : `${sanitizedFileName}.pdf`;

    // 添加时间戳到文件名（在扩展名之前）
    // 格式：YYYYMMDDHHmmss (例如：20241211223311)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
    
    const nameWithoutExt = finalFileName.replace(/\.pdf$/i, "");
    const qiniuFileName = `${nameWithoutExt}_${timestamp}.pdf`;

    // 配置七牛云
    const mac = new qiniu.auth.digest.Mac(QINIU_CONFIG.accessKey, QINIU_CONFIG.secretKey);
    const config = new qiniu.conf.Config();
    const bucketManager = new qiniu.rs.BucketManager(mac, config);

    // 使用七牛云的 fetch API，直接从源URL抓取文件到七牛云（不经过服务器）
    console.log("📥 [PDF转存] 使用七牛云Fetch API，从源URL抓取PDF:", pdfUrl);
    console.log("📝 [PDF转存] 目标文件名:", qiniuFileName);

    return new Promise<NextResponse>((resolve) => {
      bucketManager.fetch(
        pdfUrl,                    // 源文件URL（七牛云服务器会直接从这个URL抓取）
        QINIU_CONFIG.bucket,       // 目标空间
        qiniuFileName,             // 目标文件名
        (respErr, respBody, respInfo) => {
          if (respErr) {
            console.error("❌ [PDF转存] 七牛云Fetch失败:", respErr);
            resolve(
              NextResponse.json(
                {
                  success: false,
                  message: `七牛云转存失败: ${respErr.message || "未知错误"}`,
                  error_source: "七牛云",
                },
                { status: 500 }
              )
            );
            return;
          }

          if (respInfo.statusCode !== 200) {
            console.error("❌ [PDF转存] 七牛云Fetch失败:", {
              statusCode: respInfo.statusCode,
              body: respBody,
            });
            resolve(
              NextResponse.json(
                {
                  success: false,
                  message: `七牛云转存失败 (${respInfo.statusCode}): ${respBody?.error || "未知错误"}`,
                  error_source: "七牛云",
                  status: respInfo.statusCode,
                  details: respBody,
                },
                { status: respInfo.statusCode }
              )
            );
            return;
          }

          // 构建文件访问URL
          const domain = QINIU_CONFIG.domain.endsWith('/') 
            ? QINIU_CONFIG.domain 
            : `${QINIU_CONFIG.domain}/`;
          const key = respBody.key?.startsWith('/') 
            ? respBody.key.slice(1) 
            : respBody.key;
          const fileUrl = key ? `${domain}${key}` : null;

          console.log("✅ [PDF转存] 转存成功:", {
            originalFileName: fileName,
            qiniuFileName: qiniuFileName,
            qiniuKey: respBody.key,
            fileUrl: fileUrl,
            fileSize: respBody.fsize || "未知",
          });

          if (!fileUrl) {
            resolve(
              NextResponse.json(
                {
                  success: false,
                  message: "文件转存成功但无法获取访问URL",
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
              pdfUrl: fileUrl,
              fileName: qiniuFileName,
              fileSize: respBody.fsize || 0,
            })
          );
        }
      );
    });
  } catch (error: any) {
    console.error("❌ [PDF上传] 处理请求失败:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "处理请求失败",
      },
      { status: 500 }
    );
  }
}

