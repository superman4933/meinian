// Toast提示工具函数
export function showToast(message: string, type: "success" | "error" | "info" = "info") {
  if (typeof window === "undefined") return;
  
  const toast = document.createElement("div");
  const bgColor = type === "success" ? "bg-emerald-500" : type === "error" ? "bg-red-500" : "bg-slate-900";
  toast.className = `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] ${bgColor} text-white px-6 py-4 rounded-lg shadow-xl text-sm`;
  toast.textContent = message;
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.3s";
  document.body.appendChild(toast);
  
  // 淡入动画
  setTimeout(() => {
    toast.style.opacity = "1";
  }, 10);
  
  // 3秒后淡出并移除
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2700);
}


