import { NextRequest, NextResponse } from "next/server";

// 测试用的固定账号密码
const TEST_USERNAME = "admin";
const TEST_PASSWORD = "123456";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // 验证用户名和密码
    if (username === TEST_USERNAME && password === TEST_PASSWORD) {
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




