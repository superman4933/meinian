// 版本信息配置
export const VERSION_INFO = {
  version: "1.0.7",
  updateTime: "2026-01-06 11:33:00", // 格式：YYYY-MM-DD HH:mm:ss
};

// 格式化更新时间显示
export function formatUpdateTime(dateTimeString: string): string {
  const date = new Date(dateTimeString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
}

