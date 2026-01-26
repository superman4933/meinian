"use client";

import { useRef, useState } from "react";
import { useFileContext } from "@/contexts/file-context";
import { matchCityFromFileName, formatFileSize } from "@/lib/city-matcher";
import { getCozeTokenClient } from "@/lib/coze-config";

interface FileUploadProps {
  type: "lastYear" | "thisYear";
}

export function FileUpload({ type }: FileUploadProps) {
  const isLastYear = type === "lastYear";
  const title = isLastYear ? "上传旧年度文件" : "上传新年度文件";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const { addFile, getComparisonByCity, isUploadingType, setUploadingType } = useFileContext();

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    // 检查另一个区域是否正在上传
    const otherType = type === "thisYear" ? "lastYear" : "thisYear";
    if (isUploadingType(otherType)) {
      const otherTypeName = otherType === "thisYear" ? "新年度" : "旧年度";
      const toast = document.createElement("div");
      toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-orange-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm max-w-md text-center";
      toast.textContent = `请等待${otherTypeName}文件上传完成后再上传`;
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "1"; }, 10);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 3000);
      return;
    }
    
    // 如果正在上传，禁止再次上传
    if (isUploading) {
      const toast = document.createElement("div");
      toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-orange-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm";
      toast.textContent = "文件正在上传中，请等待上传完成";
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "1"; }, 10);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 2700);
      return;
    }

    setIsUploading(true);
    setUploadingType(type, true); // 设置全局上传状态
    setUploadProgress({ current: 0, total: files.length });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await uploadFile(file, i + 1, files.length);
        setUploadProgress({ current: i + 1, total: files.length });
      }
    } finally {
      setIsUploading(false);
      setUploadingType(type, false); // 清除全局上传状态
      setUploadProgress({ current: 0, total: 0 });
      // 清空文件输入，允许再次选择相同文件
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const uploadFile = async (file: File, currentIndex: number, totalCount: number) => {
    // 文件大小限制：100MB
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_FILE_SIZE) {
      const toast = document.createElement("div");
      toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-red-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm";
      toast.textContent = `文件大小超过限制（最大 100MB），当前文件：${formatFileSize(file.size)}`;
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "1"; }, 10);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 3000);
      return;
    }

    // 生成临时ID
    const tempId = `${Date.now()}-${Math.random()}`;

    // 匹配城市，如果无法匹配则使用唯一标识（文件ID + 未知）
    const matchedCity = matchCityFromFileName(file.name);
    const city = matchedCity || `未知_${tempId}`;

    // 直接使用上传区域的类型
    const finalType = type;

    // 检查是否正在对比中
    const existingComparison = getComparisonByCity(city);
    if (existingComparison && existingComparison.comparisonStatus === "comparing") {
      const toast = document.createElement("div");
      toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-orange-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm max-w-md text-center";
      toast.textContent = `该文件正在对比中，无法替换。请等待对比完成后再上传。`;
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "1"; }, 10);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 3000);
      return;
    }

    // 创建文件信息
    const fileInfo = {
      id: tempId,
      file_url: "",
      name: file.name,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      city: city,
      type: finalType as "thisYear" | "lastYear",
      uploadTime: new Date(),
      uploadStatus: "uploading" as const,
    };

    // 先添加到列表显示上传中状态
    const addResult = addFile(fileInfo);
    if (!addResult.success) {
      const toast = document.createElement("div");
      toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-orange-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm max-w-md text-center";
      toast.textContent = addResult.message || "文件上传被阻止";
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "1"; }, 10);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 3000);
      return;
    }

    try {
      // 上传到扣子
      const formData = new FormData();
      formData.append("file", file);

      // 获取token并添加到请求头
      const token = getCozeTokenClient();
      
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "x-coze-token": token,
        },
        body: formData,
      });

      // 先检查响应状态，再尝试解析 JSON
      if (!response.ok) {
        let errorMessage = `上传失败 (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // 如果响应不是 JSON，使用状态文本
          const text = await response.text();
          errorMessage = text || response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // 响应成功，解析 JSON
      const data = await response.json();

      // 记录上传响应数据
      console.log("文件上传响应数据:", {
        fileName: file.name,
        response: data,
        file_url: data.file_url,
        success: data.success,
      });

      // 输出文件访问地址
      if (data.success && data.file_url) {
        console.log(`✅ 文件上传成功！访问地址: ${data.file_url}`);
      }

      if (!data.success) {
        // 区分不同类型的错误
        let errorMessage = "上传失败";
        if (data.error_source === "七牛云") {
          errorMessage = `七牛云错误: ${data.message || "未知错误"}`;
        } else if (data.error_source === "扣子API") {
          errorMessage = `扣子API错误: ${data.message || "未知错误"}`;
        } else {
          errorMessage = data.message || "上传失败";
        }
        throw new Error(errorMessage);
      }

      // 更新文件信息（创建新对象）
      if (!data.file_url) {
        throw new Error("上传成功但未返回文件URL");
      }

      const updatedFileInfo = {
        ...fileInfo,
        file_url: data.file_url,
        url: data.file_url,
        uploadStatus: "success" as const,
      };

      // 记录更新后的文件信息（仅开发环境）
      if (process.env.NODE_ENV === 'development') {
        console.log("更新文件信息:", {
          fileName: file.name,
          fileId: updatedFileInfo.id,
          city: updatedFileInfo.city,
          type: updatedFileInfo.type,
          fullInfo: updatedFileInfo,
        });
      }

      // 更新文件（通过重新添加覆盖）
      const updateResult = addFile(updatedFileInfo);
      if (!updateResult.success) {
        // 如果更新失败（可能因为对比状态变化），显示错误提示
        const toast = document.createElement("div");
        toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-orange-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm max-w-md text-center";
        toast.textContent = updateResult.message || "文件上传成功，但无法更新列表（可能正在对比中）";
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s";
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = "1"; }, 10);
        setTimeout(() => {
          toast.style.opacity = "0";
          setTimeout(() => toast.remove(), 300);
        }, 3000);
        return;
      }
    } catch (error: any) {
      // 更新为错误状态（创建新对象）
      let errorMessage = "上传失败";
      if (error instanceof TypeError && error.message.includes("fetch")) {
        errorMessage = "网络错误，请检查网络连接";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      const errorFileInfo = {
        ...fileInfo,
        uploadStatus: "error" as const,
        error: errorMessage,
      };
      // 上传失败时更新错误状态，即使对比中也要更新（因为上传已经失败了）
      addFile(errorFileInfo);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // 检查另一个区域是否正在上传
    const otherType = type === "thisYear" ? "lastYear" : "thisYear";
    if (isUploadingType(otherType) || isUploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // 检查另一个区域是否正在上传
    const otherType = type === "thisYear" ? "lastYear" : "thisYear";
    if (isUploadingType(otherType)) {
      const otherTypeName = otherType === "thisYear" ? "新年度" : "旧年度";
      const toast = document.createElement("div");
      toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-orange-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm max-w-md text-center";
      toast.textContent = `请等待${otherTypeName}文件上传完成后再上传`;
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "1"; }, 10);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 3000);
      return;
    }
    // 如果正在上传，不允许拖拽上传
    if (isUploading) {
      const toast = document.createElement("div");
      toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-orange-500 text-white px-6 py-4 rounded-lg shadow-xl text-sm";
      toast.textContent = "文件正在上传中，请等待上传完成";
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity = "1"; }, 10);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 2700);
      return;
    }
    handleFileSelect(e.dataTransfer.files);
  };

  const borderColor = isLastYear ? "border-amber-300" : "border-blue-300";
  const hoverBorderColor = isLastYear ? "hover:border-amber-400" : "hover:border-blue-400";
  const bgColor = isLastYear ? "bg-amber-50/50" : "bg-blue-50/50";
  const hoverBgColor = isLastYear ? "hover:bg-amber-50" : "hover:bg-blue-50";
  const textColor = isLastYear ? "text-amber-700" : "text-blue-700";
  const buttonBorder = isLastYear ? "border-amber-300" : "border-blue-300";
  const buttonHover = isLastYear ? "hover:bg-amber-50 hover:border-amber-400" : "hover:bg-blue-50 hover:border-blue-400";
  const buttonText = isLastYear ? "text-amber-700" : "text-blue-700";
  const hintColor = isLastYear ? "text-amber-600" : "text-blue-600";
  const formatHint = isLastYear ? "text-amber-500" : "text-blue-500";

  // 检查另一个区域是否正在上传
  const otherType = type === "thisYear" ? "lastYear" : "thisYear";
  const otherTypeUploading = isUploadingType(otherType);
  const isDisabled = isUploading || otherTypeUploading;

  return (
    <div
      className={`rounded-2xl border-2 border-dashed ${borderColor} ${bgColor} p-6 ${hoverBorderColor} ${hoverBgColor} transition-colors ${isDragging && !isDisabled ? "ring-2 ring-blue-500" : ""} ${isDisabled ? "opacity-75 cursor-not-allowed" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center gap-3">
        <div className={`flex items-center gap-2 ${textColor}`}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        
        {/* 上传进度显示 */}
        {isUploading && (
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <svg className="h-4 w-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>正在上传第 {uploadProgress.current} / {uploadProgress.total} 个文件</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* 另一个区域正在上传的提示 */}
        {otherTypeUploading && !isUploading && (
          <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>请等待{otherType === "thisYear" ? "新年度" : "旧年度"}文件上传完成</span>
          </div>
        )}
        
        <div className="flex flex-col items-center gap-2">
          <label
            className={`rounded-xl border ${buttonBorder} bg-white px-4 py-2 text-sm font-medium ${buttonText} ${buttonHover} transition-colors ${
              isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              disabled={isDisabled}
            />
            <span>{isUploading ? "上传中..." : otherTypeUploading ? "等待中..." : "选择文件"}</span>
          </label>
          {!isDisabled && (
            <span className={`text-xs ${hintColor}`}>或拖拽文件到此处</span>
          )}
        </div>
        <div className={`text-xs ${formatHint}`}>支持 PDF、DOC、DOCX 格式，单个文件最大 100MB</div>
      </div>
    </div>
  );
}
