/**
 * 用户相关工具函数
 */

/**
 * 获取当前登录用户名
 * @returns 用户名，如果未登录则返回 null
 */
export function getCurrentUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("savedUsername");
}

/**
 * 检查是否已登录
 * @returns 是否已登录
 */
export function isLoggedIn(): boolean {
  return getCurrentUsername() !== null;
}

