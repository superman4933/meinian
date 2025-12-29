"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export interface FileInfo {
  id: string;
  file_url: string; // 文件访问URL（七牛云）
  name: string;
  size: number;
  sizeFormatted: string;
  city: string;
  type: "thisYear" | "lastYear";
  uploadTime: Date;
  url?: string; // 文件预览URL（与file_url相同）
  uploadStatus: "uploading" | "success" | "error";
  error?: string;
}

export interface ComparisonStatistics {
  totalAdded: number;
  totalDeleted: number;
  totalModified: number;
}

export interface ComparisonStructuredData {
  summary: string;
  added: string[];
  modified: string[];
  deleted: string[];
  statistics: ComparisonStatistics;
  detailed: string; // markdown格式的详细内容
}

export interface ComparisonRow {
  id: string; // 城市ID
  company: string; // 分公司名称（城市名）
  thisYearFile: FileInfo | null;
  lastYearFile: FileInfo | null;
  comparisonStatus: "none" | "comparing" | "done" | "error";
  comparisonResult?: any; // 原始结果（可能是字符串或结构化数据）
  comparisonStructured?: ComparisonStructuredData; // JSON格式的结构化数据
  isJsonFormat?: boolean; // 标识是否是JSON格式
  comparisonError?: string;
}

interface FileContextType {
  files: FileInfo[];
  comparisons: ComparisonRow[];
  addFile: (file: FileInfo) => void;
  removeFile: (fileId: string) => void;
  updateFile: (fileId: string, updates: Partial<FileInfo>) => void;
  getComparisonByCity: (city: string) => ComparisonRow | undefined;
  updateComparison: (city: string, updates: Partial<ComparisonRow>) => void;
  resetComparisons: () => void;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export function FileProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonRow[]>([]);

  const addFile = (file: FileInfo) => {
    setFiles((prev) => {
      // 如果同一城市同一类型已有文件，替换它
      const existingIndex = prev.findIndex(
        (f) => f.city === file.city && f.type === file.type
      );
      if (existingIndex >= 0) {
        const newFiles = [...prev];
        newFiles[existingIndex] = file;
        return newFiles;
      }
      return [...prev, file];
    });
    
    // 更新对比列表
    setComparisons((prev) => {
      const existing = prev.find((c) => c.id === file.city);
      if (existing) {
        // 更新现有的对比行
        return prev.map((c) =>
          c.id === file.city
            ? {
                ...c,
                [file.type === "thisYear" ? "thisYearFile" : "lastYearFile"]: file,
                comparisonStatus: "none" as const, // 重置对比状态
                comparisonResult: undefined,
                comparisonError: undefined,
              }
            : c
        );
      } else {
        // 创建新的对比行
        // 对于未知分公司，使用文件的ID作为唯一标识，确保每个未知文件单独一行
        const rowId = file.city.startsWith("未知_") ? file.city : file.city;
        const newRow: ComparisonRow = {
          id: rowId,
          company: file.city,
          thisYearFile: file.type === "thisYear" ? file : null,
          lastYearFile: file.type === "lastYear" ? file : null,
          comparisonStatus: "none" as const,
        };
        return [...prev, newRow];
      }
    });
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (!file) return prev;

      // 从对比列表中移除
      setComparisons((prevComps) => {
        return prevComps.map((c) => {
          if (c.thisYearFile?.id === fileId) {
            return {
              ...c,
              thisYearFile: null,
              comparisonStatus: "none" as const,
              comparisonResult: undefined,
              comparisonError: undefined,
            };
          }
          if (c.lastYearFile?.id === fileId) {
            return {
              ...c,
              lastYearFile: null,
              comparisonStatus: "none" as const,
              comparisonResult: undefined,
              comparisonError: undefined,
            };
          }
          return c;
        }).filter((c) => c.thisYearFile || c.lastYearFile); // 移除完全没有文件的行
      });

      return prev.filter((f) => f.id !== fileId);
    });
  };

  const updateFile = (fileId: string, updates: Partial<FileInfo>) => {
    setFiles((prev) => {
      const updated = prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f));
      const updatedFile = updated.find((f) => f.id === fileId);
      
      if (updatedFile) {
        // 同时更新对比列表中的文件引用
        setComparisons((prevComps) =>
          prevComps.map((c) => {
            if (c.thisYearFile?.id === fileId) {
              return { ...c, thisYearFile: updatedFile };
            }
            if (c.lastYearFile?.id === fileId) {
              return { ...c, lastYearFile: updatedFile };
            }
            return c;
          })
        );
      }
      
      return updated;
    });
  };

  const getComparisonByCity = (city: string) => {
    return comparisons.find((c) => c.id === city);
  };

  const updateComparison = (city: string, updates: Partial<ComparisonRow>) => {
    setComparisons((prev) =>
      prev.map((c) => (c.id === city ? { ...c, ...updates } : c))
    );
  };

  const resetComparisons = () => {
    setComparisons((prev) =>
      prev.map((c) => ({
        ...c,
        comparisonStatus: "none" as const,
        comparisonResult: undefined,
        comparisonError: undefined,
      }))
    );
  };

  return (
    <FileContext.Provider
      value={{
        files,
        comparisons,
        addFile,
        removeFile,
        updateFile,
        getComparisonByCity,
        updateComparison,
        resetComparisons,
      }}
    >
      {children}
    </FileContext.Provider>
  );
}

export function useFileContext() {
  const context = useContext(FileContext);
  if (!context) {
    throw new Error("useFileContext must be used within FileProvider");
  }
  return context;
}

