import { NextRequest, NextResponse } from "next/server";

// 账号配置（用户名和密码的映射）
const USERS: Record<string, string> = {
  admin: "admin6688",
  test: "123456",
  13795272627: "5272627",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // 验证用户名和密码
    if (username && password && USERS[username] === password) {
      return NextResponse.json({
        success: true,
        message: "登录成功",
        username: username,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "用户名或密码错误",
        },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "服务器错误",
      },
      { status: 500 }
    );
  }
}





