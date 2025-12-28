// 扣子API配置管理
// 默认token（如果用户没有设置，使用这个）
const DEFAULT_COZE_TOKEN = "sat_iVFZ9QcGxPajVuiZD6o89MGOZ9hiQL2rTGMIzUAxGy9rBvwegpaZDEqzeyoGY4Ic";

/**
 * 获取扣子API Token（服务端使用）
 * 优先级：请求头 > 环境变量 > 默认值
 */
export function getCozeToken(request?: { headers?: { get?: (key: string) => string | null } }): string {
  // 优先从请求头读取（如果前端传递了）
  if (request?.headers?.get) {
    const tokenFromHeader = request.headers.get("x-coze-token");
    if (tokenFromHeader) {
      return tokenFromHeader;
    }
  }
  
  // 从环境变量读取
  if (typeof process !== "undefined" && process.env.COZE_API_TOKEN) {
    return process.env.COZE_API_TOKEN;
  }
  
  // 使用默认值
  return DEFAULT_COZE_TOKEN;
}

/**
 * 获取扣子API Token（客户端使用）
 * 优先级：localStorage > 默认值
 */
export function getCozeTokenClient(): string {
  if (typeof window !== "undefined") {
    // 客户端：从localStorage读取
    const savedToken = localStorage.getItem("coze_api_token");
    if (savedToken) {
      return savedToken;
    }
  }
  
  // 使用默认值
  return DEFAULT_COZE_TOKEN;
}

/**
 * 保存扣子API Token到localStorage
 */
export function saveCozeToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("coze_api_token", token);
  }
}

/**
 * 清除保存的Token
 */
export function clearCozeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("coze_api_token");
  }
}

// 默认政策对比提示词
const DEFAULT_POLICY_PROMPT = "请分析这两个政策文件的差异";

/**
 * 获取政策对比提示词（客户端使用）
 */
export function getPolicyPrompt(): string {
  if (typeof window !== "undefined") {
    const savedPrompt = localStorage.getItem("policy_compare_prompt");
    if (savedPrompt) {
      return savedPrompt;
    }
  }
  return DEFAULT_POLICY_PROMPT;
}

/**
 * 保存政策对比提示词到localStorage
 */
export function savePolicyPrompt(prompt: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("policy_compare_prompt", prompt);
  }
}

/**
 * 清除保存的提示词
 */
export function clearPolicyPrompt(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("policy_compare_prompt");
  }
}

