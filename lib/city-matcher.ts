import { CITIES } from "./cities";

/**
 * 从文件名中匹配城市
 * 策略：
 * 1. 首先尝试通过 "-" 分割文件名，取第一部分作为城市名称（即使不在城市列表中也会使用）
 * 2. 如果分割失败或第一部分为空，使用原有的匹配逻辑（在文件名中查找城市名）
 */
export function matchCityFromFileName(fileName: string): string | null {
  // 策略1：通过 "-" 分割文件名，取第一部分作为城市名称
  const parts = fileName.split("-");
  if (parts.length > 1) {
    // 只有当文件名包含至少一个 "-" 时才使用分割策略
    const firstPart = parts[0].trim();
    
    // 如果第一部分不为空，直接返回（不管是否在城市列表中）
    if (firstPart) {
      return firstPart;
    }
  }
  
  // 策略2：如果通过 "-" 分割没有找到，使用原有的匹配逻辑
  // 按长度降序排序，优先匹配更长的城市名
  const sortedCities = [...CITIES].sort((a, b) => b.length - a.length);
  
  for (const city of sortedCities) {
    if (fileName.includes(city)) {
      return city;
    }
  }
  
  return null;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

