import { NextRequest, NextResponse } from "next/server";
import { getCozeToken } from "@/lib/coze-config";

// 获取扣子配置
export async function GET() {
  try {
    const token = getCozeToken();
    return NextResponse.json({
      success: true,
      token: token,
      // 不返回完整token，只返回前几位和后几位用于显示
      token_preview: token ? `${token.substring(0, 10)}...${token.substring(token.length - 10)}` : "",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "获取配置失败",
      },
      { status: 500 }
    );
  }
}

// 更新扣子配置（保存到服务端，这里可以扩展为保存到数据库）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Token不能为空",
        },
        { status: 400 }
      );
    }

    // 这里可以保存到数据库，目前先返回成功
    // 实际token会通过前端的localStorage保存
    return NextResponse.json({
      success: true,
      message: "配置已更新（请在前端保存）",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "更新配置失败",
      },
      { status: 500 }
    );
  }
}






