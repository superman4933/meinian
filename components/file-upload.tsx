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
  const { addFile } = useFileContext();

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    // 生成临时ID
    const tempId = `${Date.now()}-${Math.random()}`;

    // 匹配城市，如果无法匹配则使用唯一标识（文件ID + 未知）
    const matchedCity = matchCityFromFileName(file.name);
    const city = matchedCity || `未知_${tempId}`;

    // 直接使用上传区域的类型
    const finalType = type;

    // 创建文件信息
    const fileInfo = {
      id: tempId,
      file_id: "",
      name: file.name,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      city: city,
      type: finalType as "thisYear" | "lastYear",
      uploadTime: new Date(),
      uploadStatus: "uploading" as const,
    };

    // 先添加到列表显示上传中状态
    addFile(fileInfo);

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

      const data = await response.json();

      // 记录上传响应数据
      console.log("文件上传响应数据:", {
        fileName: file.name,
        response: data,
        file_id: data.file_id,
        success: data.success,
      });

      if (!response.ok || !data.success) {
        throw new Error(data.message || "上传失败");
      }

      // 更新文件信息（创建新对象）
      const updatedFileInfo = {
        ...fileInfo,
        file_id: data.file_id || "",
        url: data.url || null,
        uploadStatus: "success" as const,
      };

      // 记录更新后的文件信息
      console.log("更新文件信息:", {
        fileName: file.name,
        fileId: updatedFileInfo.file_id,
        city: updatedFileInfo.city,
        type: updatedFileInfo.type,
        fullInfo: updatedFileInfo,
      });

      // 更新文件（通过重新添加覆盖）
      addFile(updatedFileInfo);
    } catch (error: any) {
      // 更新为错误状态（创建新对象）
      const errorFileInfo = {
        ...fileInfo,
        uploadStatus: "error" as const,
        error: error.message || "上传失败",
      };
      addFile(errorFileInfo);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
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

  return (
    <div
      className={`rounded-2xl border-2 border-dashed ${borderColor} ${bgColor} p-6 ${hoverBorderColor} ${hoverBgColor} transition-colors ${isDragging ? "ring-2 ring-blue-500" : ""}`}
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
        <div className="flex flex-col items-center gap-2">
          <label
            className={`rounded-xl border ${buttonBorder} bg-white px-4 py-2 text-sm font-medium ${buttonText} ${buttonHover} cursor-pointer transition-colors`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <span>选择文件</span>
          </label>
          <span className={`text-xs ${hintColor}`}>或拖拽文件到此处</span>
        </div>
        <div className={`text-xs ${formatHint}`}>支持 PDF、DOC、DOCX 格式</div>
      </div>
    </div>
  );
}
