import { CITIES } from "./cities";

/**
 * 从文件名中匹配城市
 * 按城市名称长度从长到短排序，优先匹配更具体的城市名（如"北京美兆"优先于"北京"）
 */
export function matchCityFromFileName(fileName: string): string | null {
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

