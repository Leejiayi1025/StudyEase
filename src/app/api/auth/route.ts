import { NextRequest, NextResponse } from 'next/server';
import { registerUser, loginUser, generateToken, getCurrentUser } from '@/lib/auth';

// POST /api/auth - 登录或注册
export async function POST(request: NextRequest) {
  try {
    const { action, phone, password, nickname } = await request.json();

    if (!phone || !password) {
      return NextResponse.json({ error: '请填写手机号和密码' }, { status: 400 });
    }

    // Validate phone format (11 digits)
    if (!/^1\d{10}$/.test(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号' }, { status: 400 });
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少6位' }, { status: 400 });
    }

    let user;
    if (action === 'register') {
      user = await registerUser(phone, password, nickname);
    } else {
      user = await loginUser(phone, password);
    }

    const token = generateToken(user.id, user.phone);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, phone: user.phone, nickname: user.nickname },
      token,
    });

    // Set cookie
    response.cookies.set('auth_token', token, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// GET /api/auth - 获取当前用户信息
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, user: null });
    }
    return NextResponse.json({ success: true, user });
  } catch {
    return NextResponse.json({ success: false, user: null });
  }
}

// DELETE /api/auth - 退出登录
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth_token');
  return response;
}
