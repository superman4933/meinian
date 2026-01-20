"use client";

import {useState, useEffect, useRef} from "react";
import {useRouter} from "next/navigation";
import {createPortal} from "react-dom";
import {Header} from "@/components/header";
import {Login} from "@/components/login";
import {formatFileSize, matchCityFromFileName} from "@/lib/city-matcher";
import {getCozeTokenClient} from "@/lib/coze-config";
import {showToast} from "@/lib/toast";
import {getCurrentUsername} from "@/lib/user";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as XLSX from "xlsx";

// 标准项接口定义
interface StandardItem {
    id: number;
    name: string;
    status: "满足" | "部分满足" | "不满足" | "未提及" | "不适用" | "暂不核查";
    matched: boolean | null;
    evidence: string | null;
    analysis: string;
}

// 文件信息接口
interface FileInfo {
    id: string;
    name: string;
    size: number;
    sizeFormatted: string;
    file_url: string;
    city: string; // 城市名称
    uploadStatus: "uploading" | "success" | "error";
    compareStatus: "idle" | "comparing" | "success" | "error";
    compareResult: StandardItem[] | null;
    error?: string;
    uploadProgress: number;
    compareProgress: string;
    _id?: string; // 数据库记录ID，用于更新和删除记录
    compareTime?: string; // 对比时间（ISO字符串格式，北京时间）
    isVerified?: boolean; // 是否已人工审核确认
}

export default function StandardComparePage() {
    const router = useRouter();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState("");
    const [isChecking, setIsChecking] = useState(true);
    const [files, setFiles] = useState<FileInfo[]>([]);
    const filesRef = useRef<FileInfo[]>([]); // 用于存储最新的 files 状态，确保重复检查时能获取到最新值
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [detailModal, setDetailModal] = useState<{
        open: boolean;
        file: FileInfo | null;
        standardName: string;
        result: StandardItem | null;
    }>({
        open: false,
        file: null,
        standardName: "",
        result: null,
    });

    // 编辑状态
    const [editingStatus, setEditingStatus] = useState<{
        status: boolean;
        matched: boolean;
        evidence: boolean;
        analysis: boolean;
    }>({
        status: false,
        matched: false,
        evidence: false,
        analysis: false,
    });

    // 编辑值
    const [editValues, setEditValues] = useState<{
        status: string;
        matched: boolean | null;
        evidence: string;
        analysis: string;
    }>({
        status: "",
        matched: null,
        evidence: "",
        analysis: "",
    });

    // 历史记录相关状态
    const [showHistory, setShowHistory] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [historyFiles, setHistoryFiles] = useState<FileInfo[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [filterStatus, setFilterStatus] = useState("全部状态");

    // 覆盖/创建模式选择对话框
    const [compareModeModal, setCompareModeModal] = useState<{
        open: boolean;
        file: FileInfo | null;
    }>({
        open: false,
        file: null,
    });

    // 审核确认对话框
    const [verifyModal, setVerifyModal] = useState<{
        open: boolean;
        file: FileInfo | null;
    }>({
        open: false,
        file: null,
    });

    // 历史记录中正在对比的状态（用于覆盖模式）
    const historyComparingStates = useRef<Map<string, { compareStatus: "comparing" | "success" | "error"; compareResult: StandardItem[] | null; error?: string }>>(new Map());

    // 多选状态
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 删除进度状态
    const [deleteProgress, setDeleteProgress] = useState<{
        isDeleting: boolean;
        current: number;
        total: number;
    }>({
        isDeleting: false,
        current: 0,
        total: 0,
    });

    // 初始化 filesRef，确保它与 files 状态同步
    useEffect(() => {
        filesRef.current = files;
    }, [files]);

    // 检查登录状态
    useEffect(() => {
        const checkAutoLogin = async () => {
            if (typeof window === "undefined") return;

            const savedUsername = localStorage.getItem("savedUsername");
            const savedPassword = localStorage.getItem("savedPassword");

            if (savedUsername && savedPassword) {
                try {
                    const response = await fetch("/api/login", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({username: savedUsername, password: savedPassword}),
                    });

                    const data = await response.json();

                    if (response.ok && data.success) {
                        setUsername(savedUsername);
                        setIsLoggedIn(true);
                    } else {
                        localStorage.removeItem("savedPassword");
                    }
                } catch (err) {
                    localStorage.removeItem("savedPassword");
                } finally {
                    setIsChecking(false);
                }
            } else {
                setIsChecking(false);
            }
        };

        checkAutoLogin();
    }, []);

    // 加载历史记录
    const loadHistoryRecords = async (page: number = 1) => {
        setIsLoadingHistory(true);
        try {
            const username = getCurrentUsername();
            if (!username) {
                showToast("请先登录", "error");
                return;
            }
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: "500",
                username,
            });
            if (filterStatus === "已审核") {
                params.append("isVerified", "true");
            } else if (filterStatus === "未审核") {
                params.append("isVerified", "false");
            }

            const response = await fetch(`/api/standard-compare-records?${params}`);
            const data = await response.json();

            if (data.success && data.data) {
                // 解析数据库记录为 FileInfo 格式
                const historyFilesData: FileInfo[] = data.data.map((record: any) => {
                    let standardItems: StandardItem[] = [];
                    try {
                        if (record.standardItems) {
                            standardItems = typeof record.standardItems === 'string' 
                                ? JSON.parse(record.standardItems) 
                                : record.standardItems;
                        } else if (record.rawCozeResponse) {
                            // 如果没有standardItems，尝试从rawCozeResponse解析
                            const rawData = typeof record.rawCozeResponse === 'string' 
                                ? JSON.parse(record.rawCozeResponse) 
                                : record.rawCozeResponse;
                            // 尝试提取structured数据
                            if (rawData.structured && Array.isArray(rawData.structured)) {
                                standardItems = rawData.structured;
                            }
                        }
                    } catch (e) {
                        console.error("解析标准项数据失败:", e);
                    }

                    return {
                        id: record._id || `history-${record._id}`,
                        name: record.fileName || "",
                        size: 0,
                        sizeFormatted: "",
                        file_url: record.fileUrl || "",
                        city: record.city || "",
                        uploadStatus: "success" as const,
                        compareStatus: historyComparingStates.current.get(record._id)?.compareStatus || ("success" as const),
                        compareResult: historyComparingStates.current.get(record._id)?.compareResult || standardItems,
                        compareProgress: "对比完成",
                        _id: record._id,
                        compareTime: record.createTime, // 使用数据库的创建时间字段（北京时间）
                        isVerified: record.isVerified || false,
                    };
                });

                setHistoryFiles(historyFilesData);
                setTotalPages(data.pagination?.totalPages || 1);
                setCurrentPage(page);
            }
        } catch (error) {
            console.error("加载历史记录失败:", error);
            showToast("加载历史记录失败", "error");
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (showHistory && isLoggedIn) {
            loadHistoryRecords(currentPage);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showHistory, currentPage, filterStatus, isLoggedIn]);

    // 切换显示历史记录时清空选中状态
    useEffect(() => {
        setSelectedIds(new Set());
    }, [showHistory]);

    // 筛选状态改变时清空选中状态
    useEffect(() => {
        setSelectedIds(new Set());
    }, [filterStatus]);

    const handleLoginSuccess = (loggedInUsername: string) => {
        setUsername(loggedInUsername);
        setIsLoggedIn(true);
    };

    const handleLogout = () => {
        localStorage.removeItem("savedPassword");
        setUsername("");
        setIsLoggedIn(false);
    };

    // 并发控制函数：限制同时执行的任务数
    const limitConcurrency = async (
        tasks: (() => Promise<void>)[],
        limit: number
    ): Promise<void> => {
        const executing: Promise<void>[] = [];

        for (const task of tasks) {
            const promise = task().finally(() => {
                // 任务完成后从执行队列中移除
                const index = executing.indexOf(promise);
                if (index > -1) {
                    executing.splice(index, 1);
                }
            });

            executing.push(promise);

            // 如果达到并发限制，等待至少一个任务完成
            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }

        // 等待所有剩余任务完成
        await Promise.all(executing);
    };

    // 处理文件选择
    const handleFileSelect = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;

        const newFiles: File[] = Array.from(fileList);

        // 确保 filesRef 是最新的（同步更新）
        filesRef.current = files;

        // 使用 files 状态检查重复（React 状态是同步的，应该是最新的）
        const currentFiles = files;

        // 调试日志（开发环境）
        if (process.env.NODE_ENV === 'development') {
            console.log('文件选择检查:', {
                newFilesCount: newFiles.length,
                newFileNames: newFiles.map(f => f.name),
                currentFilesCount: currentFiles.length,
                currentFileNames: currentFiles.map(f => f.name),
            });
        }

        // 检查是否有文件正在处理（可选提示，不影响上传）
        const hasProcessingFiles = currentFiles.some(
            (f) => f.uploadStatus === "uploading" || f.compareStatus === "comparing"
        );

        // 检查文件是否已存在（根据文件名），使用最新的 files 状态
        const existingFileNames = new Set(currentFiles.map((f) => f.name));
        const duplicateFiles: File[] = [];
        const validFiles: File[] = [];

        newFiles.forEach((file) => {
            if (existingFileNames.has(file.name)) {
                duplicateFiles.push(file);
            } else {
                validFiles.push(file);
            }
        });

        // 如果所有文件都已存在，直接toast提示
        if (duplicateFiles.length === newFiles.length) {
            showToast(`所有文件都已存在列表中，共 ${duplicateFiles.length} 个文件`, "error");
            return;
        }

        // 如果有部分文件重复，立即提示用户
        if (duplicateFiles.length > 0) {
            const duplicateNames = duplicateFiles.map(f => f.name).join("、");
            const duplicateCount = duplicateFiles.length;
            showToast(
                `有 ${duplicateCount} 个文件已存在列表中，已自动跳过：${duplicateNames.length > 50 ? duplicateNames.substring(0, 50) + "..." : duplicateNames}`,
                "error"
            );
        }

        // 检查文件大小（超过100MB的文件不能上传）
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
        const oversizedFiles: File[] = [];
        const sizeValidFiles: File[] = [];

        validFiles.forEach((file) => {
            if (file.size > MAX_FILE_SIZE) {
                oversizedFiles.push(file);
            } else {
                sizeValidFiles.push(file);
            }
        });

        // 如果有超过大小限制的文件，提示用户
        if (oversizedFiles.length > 0) {
            const oversizedNames = oversizedFiles.map(f => f.name).join("、");
            const oversizedCount = oversizedFiles.length;
            showToast(
                `有 ${oversizedCount} 个文件超过大小限制（最大 100MB），已自动跳过：${oversizedNames.length > 50 ? oversizedNames.substring(0, 50) + "..." : oversizedNames}`,
                "error"
            );
        }

        // 确保有有效文件需要上传
        if (sizeValidFiles.length === 0) {
            // 如果所有文件都超过大小限制
            if (oversizedFiles.length > 0 && duplicateFiles.length === 0) {
                showToast(`所有文件都超过大小限制（最大 100MB），共 ${oversizedFiles.length} 个文件`, "error");
            } else if (duplicateFiles.length > 0 && oversizedFiles.length === 0) {
                showToast(`所有文件都已存在列表中，共 ${duplicateFiles.length} 个文件`, "error");
            } else if (duplicateFiles.length > 0 && oversizedFiles.length > 0) {
                showToast(`所有文件都已存在或超过大小限制，共 ${duplicateFiles.length + oversizedFiles.length} 个文件`, "error");
            }
            return;
        }

        // 添加新文件到列表（只添加不重复且大小符合要求的文件）
        const fileInfos: FileInfo[] = sizeValidFiles.map((file, index) => {
            // 从文件名中提取城市名称
            const matchedCity = matchCityFromFileName(file.name);
            const city = matchedCity || "未知区域";

            return {
                id: `${Date.now()}-${index}-${Math.random()}`,
                name: file.name,
                size: file.size,
                sizeFormatted: formatFileSize(file.size),
                file_url: "",
                city: city,
                uploadStatus: "uploading" as const,
                compareStatus: "idle" as const,
                compareResult: null,
                uploadProgress: 0,
                compareProgress: "",
            };
        });

        setFiles((prev) => {
            const updated = [...prev, ...fileInfos];
            filesRef.current = updated; // 同步更新 ref
            return updated;
        });

        // 并发上传文件，限制同时最多5个，并收集结果
        const uploadResults: Array<{ fileName: string; success: boolean; error?: string }> = [];
        const uploadTasks = fileInfos.map((fileInfo, index) => async () => {
            const result = await uploadFile(sizeValidFiles[index], fileInfo.id);
            uploadResults.push({
                fileName: fileInfo.name,
                success: result.success,
                error: result.error,
            });
        });

        await limitConcurrency(uploadTasks, 5);

        // 统计上传结果
        const successCount = uploadResults.filter((r) => r.success).length;
        const failCount = uploadResults.filter((r) => !r.success).length;
        const failedFiles = uploadResults.filter((r) => !r.success);
        const duplicateCount = duplicateFiles.length;

        // 如果有重复文件或超大文件，也计入失败
        const oversizedCount = oversizedFiles.length;
        const totalFailCount = failCount + duplicateCount + oversizedCount;
        const totalCount = sizeValidFiles.length + duplicateFiles.length + oversizedCount;

        // 构建失败原因列表（去重并分类）
        const failureReasons: string[] = [];
        if (duplicateCount > 0) {
            failureReasons.push(`${duplicateCount} 个文件已存在`);
        }
        if (oversizedCount > 0) {
            failureReasons.push(`${oversizedCount} 个文件超过大小限制（最大 100MB）`);
        }

        // 统计其他失败原因
        const errorReasons = new Set<string>();
        failedFiles.forEach((f) => {
            if (f.error) {
                errorReasons.add(f.error);
            }
        });
        errorReasons.forEach((reason) => {
            failureReasons.push(reason);
        });

        // 如果全部失败（包括重复文件），使用toast
        if (successCount === 0 && totalFailCount > 0) {
            const reasonText = failureReasons.length > 0 ? `，失败原因：${failureReasons.join("、")}` : "";
            showToast(`本次上传了 ${totalCount} 个文件，全部失败${reasonText}`, "error");
            return;
        }

        // 如果全部成功，使用toast提示
        if (successCount > 0 && totalFailCount === 0) {
            showToast(`成功上传 ${successCount} 个文件`, "success");
            return;
        }

        // 如果有成功有失败，使用确认弹窗
        if (successCount > 0 && totalFailCount > 0) {
            const reasonText = failureReasons.length > 0 ? `\n失败原因：${failureReasons.join("、")}` : "";
            const message = `本次上传了 ${totalCount} 个文件\n成功：${successCount} 个\n失败：${totalFailCount} 个${reasonText}`;
            alert(message);
        }
    };

    // 上传文件到七牛云
    const uploadFile = async (
        file: File,
        fileId: string
    ): Promise<{ success: boolean; error?: string }> => {
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
        if (file.size > MAX_FILE_SIZE) {
            const errorMsg = `文件大小超过限制（最大 100MB）`;
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === fileId
                        ? {
                            ...f,
                            uploadStatus: "error" as const,
                            error: errorMsg,
                        }
                        : f
                )
            );
            return {success: false, error: errorMsg};
        }

        try {
            const formData = new FormData();
            formData.append("file", file);

            const token = getCozeTokenClient();

            const response = await fetch("/api/upload", {
                method: "POST",
                headers: {
                    "x-coze-token": token,
                },
                body: formData,
            });

            // 检查响应状态
            if (!response.ok) {
                let errorMessage = `上传失败 (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    errorMessage = response.statusText || errorMessage;
                }
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileId
                            ? {
                                ...f,
                                uploadStatus: "error" as const,
                                error: errorMessage,
                            }
                            : f
                    )
                );
                return {success: false, error: errorMessage};
            }

            const data = await response.json();

            if (data.success && data.file_url) {
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileId
                            ? {
                                ...f,
                                file_url: data.file_url,
                                uploadStatus: "success" as const,
                                uploadProgress: 100,
                            }
                            : f
                    )
                );

                // 上传成功后立即调用对比API
                // 使用 requestAnimationFrame 确保状态更新完成后再调用
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        compareFile(fileId, data.file_url).catch((error) => {
                            console.error(`文件 ${fileId} 对比失败:`, error);
                        });
                    }, 100);
                });

                return {success: true};
            } else {
                const errorMessage = data.message || "上传失败，请重试";
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileId
                            ? {
                                ...f,
                                uploadStatus: "error" as const,
                                error: errorMessage,
                            }
                            : f
                    )
                );
                return {success: false, error: errorMessage};
            }
        } catch (error: any) {
            // 区分网络错误和其他错误
            const errorMessage = error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")
                ? "网络连接失败，请检查网络后重试"
                : error.message || "上传失败，请稍后重试";

            setFiles((prev) =>
                prev.map((f) =>
                    f.id === fileId
                        ? {
                            ...f,
                            uploadStatus: "error" as const,
                            error: errorMessage,
                        }
                        : f
                )
            );
            return {success: false, error: errorMessage};
        }
    };

    // 获取北京时间（UTC+8）
    const getBeijingTime = () => {
        const now = new Date();
        const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
        return beijingTime.toISOString();
    };

    // 调用对比API
    const compareFile = async (fileId: string, file_url: string, mode: "create" | "overwrite" = "create", recordId?: string) => {
        // 辅助函数：获取最新的文件对象（解决闭包问题）
        const getCurrentFile = (): FileInfo | undefined => {
            // 使用函数式更新获取最新的 files 状态
            let currentFile: FileInfo | undefined = undefined;
            setFiles((currentFiles) => {
                currentFile = currentFiles.find((f) => f.id === fileId);
                return currentFiles; // 不修改状态，只是获取最新值
            });
            
            // 如果找不到，从 historyFiles 中查找
            if (!currentFile) {
                setHistoryFiles((currentHistoryFiles) => {
                    if (showHistory) {
                        currentFile = currentHistoryFiles.find((f) => f.id === fileId);
                    }
                    return currentHistoryFiles; // 不修改状态，只是获取最新值
                });
            }
            
            return currentFile;
        };
        
        // 必须从表格（files 或 historyFiles）中获取文件信息
        // 使用辅助函数获取最新的文件对象（解决闭包问题）
        let file = getCurrentFile();
        
        // 如果还是找不到，等待一下再试（状态可能还没更新）
        if (!file) {
            console.log("第一次查找未找到文件，等待状态更新...", {
                fileId,
            });
            // 等待状态更新（最多等待1000ms，增加等待时间）
            for (let i = 0; i < 10; i++) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                file = getCurrentFile();
                if (file) {
                    console.log("在表格中找到文件:", { 
                        fileId, 
                        city: file.city, 
                        name: file.name,
                        attempt: i + 1,
                    });
                    break;
                }
            }
        }
        
        // 如果仍然找不到文件，报错（必须从表格中获取）
        if (!file) {
            // 最后一次尝试，获取所有文件ID用于调试
            let allFilesIds: string[] = [];
            let allHistoryFilesIds: string[] = [];
            setFiles((currentFiles) => {
                allFilesIds = currentFiles.map(f => f.id);
                return currentFiles;
            });
            setHistoryFiles((currentHistoryFiles) => {
                allHistoryFilesIds = currentHistoryFiles.map(f => f.id);
                return currentHistoryFiles;
            });
            
            console.error("❌ 无法从表格中找到文件对象:", {
                fileId,
                filesCount: allFilesIds.length,
                historyFilesCount: allHistoryFilesIds.length,
                showHistory,
                filesIds: allFilesIds,
                historyFilesIds: allHistoryFilesIds,
            });
            throw new Error(`无法从表格中找到文件对象 (fileId: ${fileId})`);
        }
        
        // 验证文件对象中是否包含必要的字段
        if (!file.city || !file.name) {
            console.error("❌ 文件对象缺少必要字段:", {
                fileId,
                file,
                hasCity: !!file.city,
                city: file.city || "(空)",
                hasName: !!file.name,
                name: file.name || "(空)",
            });
            throw new Error(`文件对象缺少必要字段 (fileId: ${fileId}, city: ${file.city || "空"}, name: ${file.name || "空"})`);
        }
        
        console.log("✅ 从表格中成功获取文件信息:", {
            fileId,
            city: file.city,
            name: file.name,
        });

        // 如果是覆盖模式，重置审核状态
        if (file && mode === "overwrite" && file.isVerified) {
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === fileId
                        ? {
                            ...f,
                            isVerified: false,
                        }
                        : f
                )
            );
        }

        setFiles((prev) =>
            prev.map((f) =>
                f.id === fileId
                    ? {
                        ...f,
                        compareStatus: "comparing" as const,
                        compareProgress: "正在调用对比API...",
                    }
                    : f
            )
        );
        // 如果是历史记录模式，同时更新historyFiles状态
        if (showHistory) {
            setHistoryFiles((prev) =>
                prev.map((f) =>
                    f.id === fileId
                        ? {
                            ...f,
                            compareStatus: "comparing" as const,
                            compareProgress: "正在调用对比API...",
                        }
                        : f
                )
            );
        }

        try {
            const token = getCozeTokenClient();
            
            // 必须从表格中的 file 对象获取 city 和 fileName（表格中显示的是正确的）
            // file 对象在前面已经验证过，确保存在且包含必要字段
            const city = file.city; // 直接从表格中获取
            const fileName = file.name; // 直接从表格中获取

            console.log("调用对比接口 - 从表格中获取的参数:", {
                fileId,
                file_url,
                city: city, // 表格中的城市名称
                fileName: fileName, // 表格中的文件名称
                mode,
                recordId,
                source: "表格中的文件对象",
                fileObject: {
                    id: file.id,
                    city: file.city,
                    name: file.name,
                    file_url: file.file_url,
                },
            });

            const username = getCurrentUsername();
            if (!username) {
                showToast("请先登录", "error");
                return;
            }
            const response = await fetch("/api/standard-compare", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-coze-token": token,
                },
                body: JSON.stringify({
                    file_url,
                    city,
                    fileName,
                    mode,
                    recordId,
                    username,
                }),
            });

            // 检查响应状态
            if (!response.ok) {
                let errorMessage = `请求失败 (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    errorMessage = response.statusText || errorMessage;
                }
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileId
                            ? {
                                ...f,
                                compareStatus: "error" as const,
                                error: errorMessage,
                                compareProgress: "对比失败",
                            }
                            : f
                    )
                );
                // 如果是历史记录模式，同时更新historyFiles状态
                if (showHistory) {
                    setHistoryFiles((prev) =>
                        prev.map((f) =>
                            f.id === fileId
                                ? {
                                    ...f,
                                    compareStatus: "error" as const,
                                    error: errorMessage,
                                    compareProgress: "对比失败",
                                }
                                : f
                        )
                    );
                }
                return;
            }

            const data = await response.json();

            if (data.success && data.structured && Array.isArray(data.structured)) {
                // 验证数据结构
                if (data.structured.length === 0) {
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === fileId
                                ? {
                                    ...f,
                                    compareStatus: "error" as const,
                                    error: "返回数据为空，请重试",
                                    compareProgress: "对比失败",
                                }
                                : f
                        )
                    );
                    // 如果是历史记录模式，同时更新historyFiles状态
                    if (showHistory) {
                        setHistoryFiles((prev) =>
                            prev.map((f) =>
                                f.id === fileId
                                    ? {
                                        ...f,
                                        compareStatus: "error" as const,
                                        error: "返回数据为空，请重试",
                                        compareProgress: "对比失败",
                                    }
                                    : f
                            )
                        );
                    }
                    return;
                }

                // 如果接口返回了 _id，从数据库查询记录获取 createTime
                if (data._id) {
                    try {
                        const recordResponse = await fetch(`/api/standard-compare-records?id=${data._id}`);
                        const recordData = await recordResponse.json();
                        const createTime = recordData.success && recordData.data ? recordData.data.createTime : null;
                        
                        // 更新文件状态，使用数据库的创建时间
                        setFiles((prev) =>
                            prev.map((f) =>
                                f.id === fileId
                                    ? {
                                        ...f,
                                        compareStatus: "success" as const,
                                        compareResult: data.structured,
                                        compareProgress: "对比完成",
                                        compareTime: createTime || undefined, // 使用数据库的创建时间
                                        _id: data._id,
                                        isVerified: mode === "overwrite" ? false : f.isVerified, // 覆盖模式重置审核状态
                                    }
                                    : f
                            )
                        );
                        // 如果是历史记录模式，同时更新historyFiles状态
                        if (showHistory) {
                            setHistoryFiles((prev) =>
                                prev.map((f) =>
                                    f.id === fileId
                                        ? {
                                            ...f,
                                            compareStatus: "success" as const,
                                            compareResult: data.structured,
                                            compareProgress: "对比完成",
                                            compareTime: createTime || undefined, // 使用数据库的创建时间
                                            _id: data._id,
                                            isVerified: mode === "overwrite" ? false : f.isVerified,
                                        }
                                        : f
                                )
                            );
                        }
                    } catch (e) {
                        console.error("查询记录创建时间失败:", e);
                        // 查询失败时，仍然更新状态但不设置时间
                        setFiles((prev) =>
                            prev.map((f) =>
                                f.id === fileId
                                    ? {
                                        ...f,
                                        compareStatus: "success" as const,
                                        compareResult: data.structured,
                                        compareProgress: "对比完成",
                                        _id: data._id,
                                        isVerified: mode === "overwrite" ? false : f.isVerified,
                                    }
                                    : f
                            )
                        );
                        if (showHistory) {
                            setHistoryFiles((prev) =>
                                prev.map((f) =>
                                    f.id === fileId
                                        ? {
                                            ...f,
                                            compareStatus: "success" as const,
                                            compareResult: data.structured,
                                            compareProgress: "对比完成",
                                            _id: data._id,
                                            isVerified: mode === "overwrite" ? false : f.isVerified,
                                        }
                                        : f
                                )
                            );
                        }
                    }
                } else {
                    // 如果没有 _id，仍然更新状态但不设置时间
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === fileId
                                ? {
                                    ...f,
                                    compareStatus: "success" as const,
                                    compareResult: data.structured,
                                    compareProgress: "对比完成",
                                }
                                : f
                        )
                    );
                    if (showHistory) {
                        setHistoryFiles((prev) =>
                            prev.map((f) =>
                                f.id === fileId
                                    ? {
                                        ...f,
                                        compareStatus: "success" as const,
                                        compareResult: data.structured,
                                        compareProgress: "对比完成",
                                    }
                                    : f
                            )
                        );
                    }
                }
            } else {
                const errorMessage = data.message || (data.structured ? "返回数据格式不正确" : "对比失败");
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileId
                            ? {
                                ...f,
                                compareStatus: "error" as const,
                                error: errorMessage,
                                compareProgress: "对比失败",
                            }
                            : f
                    )
                );
                // 如果是历史记录模式，同时更新historyFiles状态
                if (showHistory) {
                    setHistoryFiles((prev) =>
                        prev.map((f) =>
                            f.id === fileId
                                ? {
                                    ...f,
                                    compareStatus: "error" as const,
                                    error: errorMessage,
                                    compareProgress: "对比失败",
                                }
                                : f
                        )
                    );
                }
            }
        } catch (error: any) {
            // 区分网络错误和其他错误
            const errorMessage = error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")
                ? "网络连接失败，请检查网络后重试"
                : error.message || "对比失败，请稍后重试";

            setFiles((prev) =>
                prev.map((f) =>
                    f.id === fileId
                        ? {
                            ...f,
                            compareStatus: "error" as const,
                            error: errorMessage,
                            compareProgress: "对比失败",
                        }
                        : f
                )
            );
            // 如果是历史记录模式，同时更新historyFiles状态
            if (showHistory) {
                setHistoryFiles((prev) =>
                    prev.map((f) =>
                        f.id === fileId
                            ? {
                                ...f,
                                compareStatus: "error" as const,
                                error: errorMessage,
                                compareProgress: "对比失败",
                            }
                            : f
                    )
                );
            }
        }
    };

    // 执行对比（处理覆盖/创建模式）
    const executeCompare = async (file: FileInfo, mode: "create" | "overwrite") => {
        if (!file.file_url) {
            showToast("文件URL不存在，无法对比", "error");
            return;
        }

        if (showHistory && file._id) {
            // 历史记录模式
            const fileId = file._id; // 此时已经确认 _id 存在
            if (mode === "overwrite") {
                // 覆盖模式：直接在当前历史记录上显示对比状态
                // 注意：这里只更新UI状态，不更新数据库。数据库更新只在对比完成后进行（在compareFile函数中）
                historyComparingStates.current.set(fileId, {
                    compareStatus: "comparing",
                    compareResult: null,
                });
                setHistoryFiles((prev) =>
                    prev.map((f) =>
                        f._id === fileId
                            ? {
                                ...f,
                                compareStatus: "comparing" as const,
                                compareProgress: "正在对比...",
                                isVerified: false, // 仅在UI中重置审核状态，数据库状态在对比完成后才更新
                            }
                            : f
                    )
                );
                // 创建一个临时文件ID用于对比
                const tempFileId = `temp-${fileId}-${Date.now()}`;
                const tempFile: FileInfo = {
                    ...file,
                    id: tempFileId,
                };
                // 临时添加到files数组以便compareFile可以找到它
                setFiles((prev) => [...prev, tempFile]);
                // 等待状态更新
                await new Promise((resolve) => setTimeout(resolve, 50));
                try {
                    // 调用对比函数，数据库更新在对比完成后才进行（在compareFile函数内部）
                    await compareFile(tempFileId, file.file_url, "overwrite", fileId);
                } finally {
                    // 清理临时文件
                    setFiles((prev) => prev.filter((f) => f.id !== tempFileId));
                    // 对比完成后重新加载历史记录
                    await loadHistoryRecords(currentPage);
                }
            } else {
                // 创建模式：跳转到当前对比tab，创建全新的条目
                setShowHistory(false);
                // 等待tab切换完成
                await new Promise((resolve) => setTimeout(resolve, 100));
                // 创建全新的文件条目，和原来的历史记录没有关系
                const newFile: FileInfo = {
                    id: `new-${Date.now()}-${Math.random()}`,
                    name: file.name,
                    size: 0,
                    sizeFormatted: "",
                    file_url: file.file_url,
                    city: file.city,
                    uploadStatus: "success" as const,
                    compareStatus: "idle" as const,
                    compareResult: null,
                    uploadProgress: 100,
                    compareProgress: "",
                    // 不设置 _id，这是全新的条目
                };
                setFiles((prev) => [...prev, newFile]);
                // 等待状态更新
                await new Promise((resolve) => {
                    // 使用requestAnimationFrame确保状态已更新
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            resolve(undefined);
                        }, 200);
                    });
                });
                // 使用新创建的文件进行对比
                await compareFile(newFile.id, newFile.file_url, "create");
            }
        } else {
            // 当前对比模式
            await compareFile(file.id, file.file_url, mode, file._id); // file._id 可能是 undefined，但 compareFile 接受可选参数
        }
    };

    // 再次对比（弹出模式选择对话框）
    const handleRecompare = async (fileId: string) => {
        const file = showHistory 
            ? historyFiles.find((f) => f.id === fileId)
            : files.find((f) => f.id === fileId);
        
        if (!file || !file.file_url) {
            showToast("文件URL不存在，无法重新对比", "error");
            return;
        }

        if (file._id) {
            // 如果有数据库ID，弹出模式选择对话框
            setCompareModeModal({ open: true, file });
        } else {
            // 如果没有数据库ID，直接对比（创建模式）
            await executeCompare(file, "create");
        }
    };

    // 删除文件
    const handleDelete = async (fileId: string) => {
        const file = showHistory 
            ? historyFiles.find((f) => f.id === fileId)
            : files.find((f) => f.id === fileId);

        if (!file) return;

        // 检查是否正在对比
        if (file.compareStatus === "comparing") {
            showToast("无法删除正在对比的文件，请等待对比完成", "error");
            return;
        }

        // 如果有数据库ID，需要删除数据库记录
        if (file._id) {
            const fileId = file._id; // 此时已经确认 _id 存在
            try {
                const response = await fetch(`/api/standard-compare-records?id=${encodeURIComponent(fileId)}`, {
                    method: "DELETE",
                });
                const data = await response.json();
                if (data.success) {
                    if (showHistory) {
                        await loadHistoryRecords(currentPage);
                    } else {
                        setFiles((prev) => prev.filter((f) => f.id !== fileId));
                    }
                    showToast("删除成功", "success");
                } else {
                    showToast("删除失败", "error");
                }
            } catch (error) {
                console.error("删除记录失败:", error);
                showToast("删除失败", "error");
            }
        } else {
            // 如果没有数据库ID，只从前端删除
            setFiles((prev) => prev.filter((f) => f.id !== fileId));
        }
    };

    // 审核确认
    const verifyRecord = async (_id: string, fileId: string) => {
        try {
            const response = await fetch("/api/standard-compare-records", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    _id,
                    isVerified: true,
                }),
            });

            if (!response.ok) {
                throw new Error("更新失败");
            }

            const data = await response.json();
            if (data.success) {
                if (showHistory) {
                    await loadHistoryRecords(currentPage);
                } else {
                    setFiles((prev) =>
                        prev.map((f) =>
                            f._id === _id
                                ? {
                                    ...f,
                                    isVerified: true,
                                }
                                : f
                        )
                    );
                }
                showToast("已确认完成", "success");
            } else {
                showToast("确认失败", "error");
            }
        } catch (error) {
            console.error("确认完成失败:", error);
            showToast("确认失败", "error");
        }
    };

    // 格式化对比时间（北京时间）
    const formatCompareTime = (time?: string) => {
        if (!time) return "-";
        try {
            const date = new Date(time);
            // createTime 已经是 UTC 时间，需要转换为北京时间（UTC+8）
            const beijingTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
            const year = beijingTime.getUTCFullYear();
            const month = String(beijingTime.getUTCMonth() + 1).padStart(2, "0");
            const day = String(beijingTime.getUTCDate()).padStart(2, "0");
            const hours = String(beijingTime.getUTCHours()).padStart(2, "0");
            const minutes = String(beijingTime.getUTCMinutes()).padStart(2, "0");
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        } catch (e) {
            return "-";
        }
    };

    // 筛选处理
    const handleFilterChange = (value: string) => {
        setFilterStatus(value);
        if (showHistory) {
            loadHistoryRecords(1);
        }
    };

    // 切换单个项的选中状态
    const toggleSelect = (fileId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(fileId)) {
                next.delete(fileId);
            } else {
                next.add(fileId);
            }
            return next;
        });
    };

    // 全选/取消全选当前页
    const toggleSelectAll = () => {
        const currentFiles = showHistory ? filteredFiles : files;
        if (selectedIds.size === currentFiles.length && currentFiles.length > 0) {
            // 如果已全选，取消全选
            setSelectedIds(new Set());
        } else {
            // 全选当前页
            const allIds = new Set(currentFiles.map((file) => file.id));
            setSelectedIds(allIds);
        }
    };

    // 删除选中的项
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) {
            showToast("请先选择要删除的项", "info");
            return;
        }

        const currentFiles = showHistory ? filteredFiles : files;
        const selectedFiles = currentFiles.filter((file) => selectedIds.has(file.id));
        
        // 检查是否有正在对比的文件
        const comparingFiles = selectedFiles.filter((file) => file.compareStatus === "comparing");
        if (comparingFiles.length > 0) {
            showToast("无法删除正在对比的文件，请等待对比完成", "error");
            return;
        }

        const confirmMessage = `确定要删除选中的 ${selectedIds.size} 项吗？`;
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // 分离有数据库_id和无_id的记录
        const filesWithId = selectedFiles.filter((file) => file._id);
        const filesWithoutId = selectedFiles.filter((file) => !file._id);

        // 删除有数据库_id的记录
        const username = getCurrentUsername();
        if (!username) {
            showToast("请先登录", "error");
            return;
        }

        // 初始化删除进度
        const totalToDelete = filesWithId.length;
        setDeleteProgress({
            isDeleting: true,
            current: 0,
            total: totalToDelete,
        });

        try {
            // 逐个删除并更新进度
            for (let i = 0; i < filesWithId.length; i++) {
                const file = filesWithId[i];
                try {
                    const response = await fetch(
                        `/api/standard-compare-records?id=${encodeURIComponent(file._id!)}&username=${encodeURIComponent(username)}`,
                        {
                            method: "DELETE",
                        }
                    );
                    const data = await response.json();
                    if (!data.success) {
                        console.error(`删除记录失败 [${file.city}]:`, data);
                        throw new Error(data.message || "删除失败");
                    }
                    // 更新进度
                    setDeleteProgress({
                        isDeleting: true,
                        current: i + 1,
                        total: totalToDelete,
                    });
                } catch (error) {
                    console.error(`删除记录时出错 [${file.city}]:`, error);
                    throw error;
                }
            }
            
            // 删除无_id的记录（只从前端删除）
            if (filesWithoutId.length > 0) {
                if (showHistory) {
                    // 历史记录模式：重新加载
                    await loadHistoryRecords(currentPage);
                } else {
                    // 当前对比模式：从前端删除
                    setFiles((prev) => prev.filter((file) => !selectedIds.has(file.id)));
                }
            } else {
                // 如果有数据库记录，重新加载数据
                if (showHistory) {
                    await loadHistoryRecords(currentPage);
                } else {
                    // 当前对比模式：删除已选中的项
                    setFiles((prev) => prev.filter((file) => !selectedIds.has(file.id)));
                }
            }

            showToast(`成功删除 ${selectedIds.size} 项`, "success");
            // 清空选中状态
            setSelectedIds(new Set());
        } catch (error) {
            console.error("批量删除失败:", error);
            showToast("部分删除失败，请检查网络连接", "error");
        } finally {
            // 重置删除进度
            setDeleteProgress({
                isDeleting: false,
                current: 0,
                total: 0,
            });
        }
    };

    // 导出下拉菜单状态
    const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
    const exportDropdownRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
                setExportDropdownOpen(false);
            }
        };

        if (exportDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [exportDropdownOpen]);

    // 导出简易版
    const handleExportSimple = () => {
        if (selectedIds.size === 0) {
            showToast("请先选择要导出的项", "info");
            return;
        }

        const currentFiles = showHistory ? filteredFiles : files;
        const selectedFiles = currentFiles.filter((file) => selectedIds.has(file.id));
        
        // 只导出已完成的对比记录
        const completedFiles = selectedFiles.filter((file) => file.compareStatus === "success" && file.compareResult);
        
        if (completedFiles.length === 0) {
            showToast("没有可导出的已完成对比记录", "info");
            return;
        }

        try {
            // 获取标准项名称
            const standardNames = getStandardNames();
            
            // 构建Excel数据
            const excelData = completedFiles.map((file) => {
                const row: any = {
                    "对比时间": formatCompareTime(file.compareTime),
                    "城市": file.city || "",
                    "文件名": file.name || "",
                    "文件地址链接": file.file_url || "",
                };

                // 添加每个标准项的结论
                if (file.compareResult && Array.isArray(file.compareResult)) {
                    standardNames.forEach((standardName, index) => {
                        const result = file.compareResult![index];
                        if (result) {
                            let conclusion = result.status || "";
                            if (result.matched !== null) {
                                conclusion += result.matched ? " ✓匹配" : " ✗不匹配";
                            }
                            row[standardName] = conclusion;
                        } else {
                            row[standardName] = "-";
                        }
                    });
                } else {
                    standardNames.forEach((standardName) => {
                        row[standardName] = "-";
                    });
                }

                return row;
            });

            // 创建工作簿
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            // 设置列宽
            const colWidths = [
                { wch: 20 }, // 对比时间
                { wch: 15 }, // 城市
                { wch: 30 }, // 文件名
                { wch: 50 }, // 文件地址链接
            ];
            // 为每个标准项设置列宽
            standardNames.forEach(() => {
                colWidths.push({ wch: 25 });
            });
            ws["!cols"] = colWidths;

            // 将工作表添加到工作簿
            XLSX.utils.book_append_sheet(wb, ws, "标准对比记录");

            // 导出文件
            const filename = `标准对比记录_简易版_${new Date().toISOString().split("T")[0]}.xlsx`;
            XLSX.writeFile(wb, filename);

            showToast(`成功导出 ${completedFiles.length} 条记录（简易版）`, "success");
            setExportDropdownOpen(false);
        } catch (error) {
            console.error("导出Excel失败:", error);
            showToast("导出失败，请稍后重试", "error");
        }
    };

    // 导出详情版
    const handleExportDetailed = () => {
        if (selectedIds.size === 0) {
            showToast("请先选择要导出的项", "info");
            return;
        }

        const currentFiles = showHistory ? filteredFiles : files;
        const selectedFiles = currentFiles.filter((file) => selectedIds.has(file.id));
        
        // 只导出已完成的对比记录
        const completedFiles = selectedFiles.filter((file) => file.compareStatus === "success" && file.compareResult);
        
        if (completedFiles.length === 0) {
            showToast("没有可导出的已完成对比记录", "info");
            return;
        }

        try {
            // 获取标准项名称
            const standardNames = getStandardNames();
            
            // 构建Excel数据
            const excelData = completedFiles.map((file) => {
                const row: any = {
                    "对比时间": formatCompareTime(file.compareTime),
                    "城市": file.city || "",
                    "文件名": file.name || "",
                    "文件地址链接": file.file_url || "",
                };

                // 添加每个标准项的完整信息
                if (file.compareResult && Array.isArray(file.compareResult)) {
                    standardNames.forEach((standardName, index) => {
                        const result = file.compareResult![index];
                        if (result) {
                            // 状态
                            let statusText = result.status || "";
                            if (result.matched !== null) {
                                statusText += result.matched ? " ✓匹配" : " ✗不匹配";
                            }
                            
                            // 依据（evidence）
                            const evidence = result.evidence || "";
                            
                            // 结论（analysis）
                            const analysis = result.analysis || "";
                            
                            // 组合完整内容
                            let fullContent = `状态：${statusText}`;
                            if (evidence) {
                                fullContent += `\n\n依据：\n${evidence}`;
                            }
                            if (analysis) {
                                fullContent += `\n\n结论：\n${analysis}`;
                            }
                            
                            row[standardName] = fullContent;
                        } else {
                            row[standardName] = "-";
                        }
                    });
                } else {
                    standardNames.forEach((standardName) => {
                        row[standardName] = "-";
                    });
                }

                return row;
            });

            // 创建工作簿
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            // 设置列宽
            const colWidths = [
                { wch: 20 }, // 对比时间
                { wch: 15 }, // 城市
                { wch: 30 }, // 文件名
                { wch: 50 }, // 文件地址链接
            ];
            // 为每个标准项设置列宽（详情版需要更宽）
            standardNames.forEach(() => {
                colWidths.push({ wch: 60 });
            });
            ws["!cols"] = colWidths;

            // 设置标准项列的自动换行（从第5列开始，索引4）
            const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
            for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex++) {
                for (let colIndex = 4; colIndex <= range.e.c; colIndex++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
                    if (ws[cellAddress] && ws[cellAddress].v && typeof ws[cellAddress].v === 'string' && ws[cellAddress].v.includes('\n')) {
                        if (!ws[cellAddress].z) {
                            ws[cellAddress].z = '@'; // 文本格式
                        }
                    }
                }
            }

            // 将工作表添加到工作簿
            XLSX.utils.book_append_sheet(wb, ws, "标准对比记录");

            // 导出文件
            const filename = `标准对比记录_详情版_${new Date().toISOString().split("T")[0]}.xlsx`;
            XLSX.writeFile(wb, filename);

            showToast(`成功导出 ${completedFiles.length} 条记录（详情版）`, "success");
            setExportDropdownOpen(false);
        } catch (error) {
            console.error("导出Excel失败:", error);
            showToast("导出失败，请稍后重试", "error");
        }
    };

    // 拖拽处理
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

    // 标准项规则说明映射
    const standardRules: Record<string, string> = {
        "业务目标拆解": "1、判断每个公司，是否都有季度或者月度任务分配？\n2、判断每个公司，季度任务占比跟集团的标准线的差异，（标准是：一季度：17%、二季度：24%、三季度：27%、四季度：32%），如果某个季度不一样，判断与标准值的对比高低；\n3、得出结论：哪个季度对标标准高？哪个季度低？如果任务占比后置，要有风险预警。",
        "业务增长率目标": "1、判断对个人、团队以及整个公司2026年的目标，增长率是否高于5%？\n2、如果有不高于5%的情况，要抓取出相关信息，提示预警。",
        "业务激励政策": "1、判断营销政策中，是否有对于拓新单、拓行业客户等等维度的激励性的措施？\n2、此条没有标准，就看是否有激励政策，用于激励增收。",
        "是否有AM区域经理": "1、对于省会、直辖市、TOP15接发单城市（清单见相关sheet2），是否有区域经理、AM、项目经理此类职务及岗位的描述？\n2、如有，抓取出相关AM的核心信息，比如：岗位职责、目标、工作内容等；\n3、如没有，要有预警提示，如：未体现AM区域经理相关制度。",
        "是否有大客户负责人": "1、是否有大客相关内容：比如大客开发、大客团队设置、大客负责人、大客绩效规则等等信息？\n2、如有，抓取相关信息展示即可；\n3、如没有，要有预警提示，如：未体现大客管理相关规则。",
        "团单提成是否符合标准": "1、调取团单二维表，与sheet3中的上下限做对比；\n2、对应区间的提成系数如高于上限，需预警，并提示高于上限多少？并做罗列；\n3、对应区间的提成系数如低于下限，提示说明：提成系数低于集团标准下限，即可；\n4、对应区间的提成系数在区间中间，提示说明：提成系数符合集团要求，即可。",
        "是否有新、老单提成细则": "1、政策中是否有关于新、老订单提成政策的细分？\n2、如有，抓取相关信息展示即可；\n3、如没有，要有预警提示，如：未体现新、老订单提成细分。",
        "渠道（三方）订单提成": "1、如有三方的相关规则，判断三方订单的提成，是否低于直营团单？\n2、因为团单是二维表，一般提成在10%及以上，三方订单的提成要不高于团单，一般在3%左右，可以以3%作为判断标准；",
        "个检提成": "1、判断是否有个检提成的要求？\n2、如有，抓取相关信息，并体现个检提成是多少？\n3、个检提成根据降本目标下调，但是每个公司目标不一致，无统一标准，列出城市公司的提成值即可",
        "是否有创新提成": "1、判断是否有分院创新提成的要求？\n2、如有，抓取相关信息，并体现分院创新提成是多少？",
        "是否有员工升降级要求": "1、判断是否有员工季度或者半年度升降级的相关要求？\n2、如有，抓取相关信息展示即可；\n3、如没有，要有预警提示，如：无员工升降级相关规则。",
        "是否有管理者升降级要求": "1、判断是否有管理者半年度或者年度升降级的相关要求？\n2、如有，抓取相关信息展示即可；\n3、如没有，要有预警提示，如：无管理者升降级相关规则。",
    };

    // 获取所有标准项名称（固定12个标准项）
    const getStandardNames = (): string[] => {
        return [
            "业务目标拆解",
            "业务增长率目标",
            "业务激励政策",
            "是否有AM区域经理",
            "是否有大客户负责人",
            "团单提成是否符合标准",
            "是否有新、老单提成细则",
            "渠道（三方）订单提成",
            "个检提成",
            "是否有创新提成",
            "是否有员工升降级要求",
            "是否有管理者升降级要求",
        ];
    };

    // 打开详情对话框
    const handleCellClick = (file: FileInfo, standardName: string, result: StandardItem | null) => {
        setDetailModal({
            open: true,
            file,
            standardName,
            result,
        });
        // 重置编辑状态
        setEditingStatus({
            status: false,
            matched: false,
            evidence: false,
            analysis: false,
        });
        // 初始化编辑值
        if (result) {
            setEditValues({
                status: result.status || "",
                matched: result.matched ?? null,
                evidence: result.evidence || "",
                analysis: result.analysis || "",
            });
        }
    };

    // 关闭详情对话框
    const handleCloseModal = () => {
        setDetailModal({
            open: false,
            file: null,
            standardName: "",
            result: null,
        });
    };

    // 保存标准项编辑内容
    const handleSaveStandardItem = async (
        file: FileInfo,
        standardName: string,
        updates: {
            status?: string;
            matched?: boolean | null;
            evidence?: string;
            analysis?: string;
        }
    ) => {
        if (!file._id) {
            showToast("无法保存：缺少记录ID", "error");
            return;
        }

        const username = getCurrentUsername();
        if (!username) {
            showToast("请先登录", "error");
            return;
        }

        try {
            // 从数据库获取原始数据
            const recordResponse = await fetch(`/api/standard-compare-records?id=${file._id}&username=${encodeURIComponent(username)}`);
            const recordData = await recordResponse.json();

            if (!recordData.success || !recordData.data) {
                showToast("获取记录失败", "error");
                return;
            }

            const record = recordData.data;

            // 解析 standardItems
            let standardItems: StandardItem[] = [];
            try {
                if (record.standardItems) {
                    standardItems = typeof record.standardItems === 'string' 
                        ? JSON.parse(record.standardItems) 
                        : record.standardItems;
                } else if (record.rawCozeResponse) {
                    const rawData = typeof record.rawCozeResponse === 'string' 
                        ? JSON.parse(record.rawCozeResponse) 
                        : record.rawCozeResponse;
                    if (rawData.structured && Array.isArray(rawData.structured)) {
                        standardItems = rawData.structured;
                    }
                }
            } catch (e) {
                console.error("解析标准项数据失败:", e);
                showToast("解析数据失败", "error");
                return;
            }

            // 找到要更新的标准项（通过 standardName 匹配）
            const standardNames = getStandardNames();
            const itemIndex = standardNames.indexOf(standardName);
            
            if (itemIndex === -1 || !standardItems[itemIndex]) {
                showToast("找不到对应的标准项", "error");
                return;
            }

            // 更新标准项
            const updatedItem: StandardItem = {
                ...standardItems[itemIndex],
                status: (updates.status as StandardItem["status"]) || standardItems[itemIndex].status,
                matched: updates.matched !== undefined ? updates.matched : standardItems[itemIndex].matched,
                evidence: updates.evidence !== undefined ? updates.evidence : standardItems[itemIndex].evidence,
                analysis: updates.analysis !== undefined ? updates.analysis : standardItems[itemIndex].analysis,
            };
            standardItems[itemIndex] = updatedItem;

            // 解析 rawCozeResponse
            let rawCozeData = null;
            try {
                if (record.rawCozeResponse) {
                    rawCozeData = typeof record.rawCozeResponse === 'string' 
                        ? JSON.parse(record.rawCozeResponse) 
                        : record.rawCozeResponse;
                }
            } catch (e) {
                console.error("解析 rawCozeResponse 失败:", e);
            }

            // 更新 rawCozeResponse 中的 structured 数据
            if (rawCozeData) {
                // 确保 structured 字段存在
                if (!rawCozeData.structured) {
                    rawCozeData.structured = [];
                }
                // 更新对应索引的项
                if (Array.isArray(rawCozeData.structured)) {
                    // 如果 structured 数组长度不够，扩展它
                    while (rawCozeData.structured.length <= itemIndex) {
                        rawCozeData.structured.push({});
                    }
                    // 更新对应索引的项，确保类型正确
                    rawCozeData.structured[itemIndex] = {
                        ...rawCozeData.structured[itemIndex],
                        status: updates.status !== undefined ? (updates.status as StandardItem["status"]) : rawCozeData.structured[itemIndex]?.status || standardItems[itemIndex].status,
                        matched: updates.matched !== undefined ? updates.matched : rawCozeData.structured[itemIndex]?.matched ?? standardItems[itemIndex].matched,
                        evidence: updates.evidence !== undefined ? updates.evidence : rawCozeData.structured[itemIndex]?.evidence ?? standardItems[itemIndex].evidence,
                        analysis: updates.analysis !== undefined ? updates.analysis : rawCozeData.structured[itemIndex]?.analysis ?? standardItems[itemIndex].analysis,
                        id: rawCozeData.structured[itemIndex]?.id ?? standardItems[itemIndex].id,
                        name: rawCozeData.structured[itemIndex]?.name ?? standardItems[itemIndex].name,
                    };
                }
            } else {
                // 如果没有 rawCozeResponse，创建一个新的
                rawCozeData = {
                    structured: standardItems,
                };
            }

            // 调用 API 更新数据库
            const response = await fetch("/api/standard-compare-records", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    _id: file._id,
                    standardItems: standardItems,
                    rawCozeResponse: rawCozeData,
                    username,
                }),
            });

            const data = await response.json();

            if (data.success) {
                // 更新本地状态
                if (showHistory) {
                    await loadHistoryRecords(currentPage);
                } else {
                    setFiles((prev) =>
                        prev.map((f) => {
                            if (f._id === file._id && f.compareResult) {
                                const updatedResult = [...f.compareResult];
                                updatedResult[itemIndex] = updatedItem;
                                return {
                                    ...f,
                                    compareResult: updatedResult,
                                };
                            }
                            return f;
                        })
                    );
                }

                // 更新弹窗中的结果
                setDetailModal((prev) => {
                    if (prev.open && prev.result) {
                        return {
                            ...prev,
                            result: {
                                ...prev.result,
                                ...updatedItem,
                            },
                        };
                    }
                    return prev;
                });

                showToast("保存成功", "success");
            } else {
                showToast(data.message || "保存失败", "error");
            }
        } catch (error: any) {
            console.error("保存标准项失败:", error);
            showToast("保存失败: " + (error.message || "未知错误"), "error");
        }
    };

    if (isChecking) {
        return (
            <div
                className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50">
                <div className="text-center">
                    <div
                        className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4 animate-pulse">
                        <svg className="h-8 w-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                    strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    <p className="text-lg font-semibold text-slate-700">正在加载...</p>
                </div>
            </div>
        );
    }

    if (!isLoggedIn) {
        return <Login onLoginSuccess={handleLoginSuccess}/>;
    }

    const standardNames = getStandardNames();

    // 生成显示的文件列表
    let displayFiles: FileInfo[];
    if (showHistory) {
        displayFiles = historyFiles;
    } else {
        displayFiles = files;
    }

    // 筛选文件（仅历史记录模式下应用筛选）
    let filteredFiles: FileInfo[];
    if (showHistory) {
        if (filterStatus === "全部状态") {
            filteredFiles = displayFiles;
        } else if (filterStatus === "已审核") {
            filteredFiles = displayFiles.filter((f) => f.isVerified);
        } else if (filterStatus === "未审核") {
            filteredFiles = displayFiles.filter((f) => !f.isVerified);
        } else {
            filteredFiles = displayFiles;
        }
    } else {
        filteredFiles = displayFiles;
    }

    return (
        <>
            <Header username={username} onLogout={handleLogout}/>
            <main className="mx-auto max-w-[1400px] px-4 py-6 space-y-4">
                {/* 多选操作按钮 */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleSelectAll}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                            >
                                <input
                                    type="checkbox"
                                    checked={filteredFiles.length > 0 && selectedIds.size === filteredFiles.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                />
                                全选
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedIds.size === 0 || deleteProgress.isDeleting}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                选中删除 ({selectedIds.size})
                            </button>
                            <div className="relative" ref={exportDropdownRef}>
                                <button
                                    onClick={() => {
                                        if (selectedIds.size === 0) {
                                            showToast("请先选择要导出的项", "info");
                                            return;
                                        }
                                        setExportDropdownOpen(!exportDropdownOpen);
                                    }}
                                    disabled={selectedIds.size === 0}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    导出选中 ({selectedIds.size})
                                    <svg className={`w-4 h-4 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {exportDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                        <button
                                            onClick={handleExportSimple}
                                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors first:rounded-t-lg"
                                        >
                                            导出简易版
                                        </button>
                                        <button
                                            onClick={handleExportDetailed}
                                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors last:rounded-b-lg"
                                        >
                                            导出详情版
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {selectedIds.size > 0 && (
                        <div className="text-sm text-slate-600">
                            已选择 {selectedIds.size} 项
                        </div>
                    )}
                    {/* 删除进度条 */}
                    {deleteProgress.isDeleting && (
                        <div className="w-full bg-slate-200 rounded-full h-8 overflow-hidden shadow-inner">
                            <div 
                                className="h-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center text-white text-sm font-medium transition-all duration-300"
                                style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }}
                            >
                                <span className="px-2">
                                    正在删除: {deleteProgress.current} / {deleteProgress.total}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                {/* 返回首页按钮和Tab切换 */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.push("/")}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                        </svg>
                        返回首页
                    </button>
                    <div className="flex items-center gap-4">
                        {/* Tab切换 */}
                        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                            <button
                                onClick={() => setShowHistory(false)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    !showHistory
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                当前对比
                            </button>
                            <button
                                onClick={() => {
                                    setShowHistory(true);
                                    loadHistoryRecords(1);
                                }}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    showHistory
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                历史记录
                            </button>
                        </div>
                        {/* 刷新按钮（仅历史记录显示） */}
                        {showHistory && (
                            <button
                                onClick={() => loadHistoryRecords(currentPage)}
                                disabled={isLoadingHistory}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                <svg className={`h-4 w-4 ${isLoadingHistory ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                刷新
                            </button>
                        )}
                        {/* 筛选（仅历史记录显示） */}
                        {showHistory && (
                            <div className="flex flex-col gap-1">
                                <select
                                    value={filterStatus}
                                    onChange={(e) => handleFilterChange(e.target.value)}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                >
                                    <option value="全部状态">全部状态</option>
                                    <option value="已审核">已审核</option>
                                    <option value="未审核">未审核</option>
                                </select>
                                <div className="text-xs text-slate-400 px-1">
                                    切换筛选条件将清空已选中的项
                                </div>
                            </div>
                        )}
                        {!showHistory && (
                            <div className="text-sm text-slate-500">
                                已上传 {files.length} 个文件
                            </div>
                        )}
                    </div>
                </div>

                {/* 文件上传区域（仅当前对比显示） */}
                {!showHistory && (
                    <div
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                            isDragging
                                ? "border-blue-500 bg-blue-50"
                                : "border-slate-300 bg-slate-50 hover:border-slate-400"
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                    />
                    <div className="flex flex-col items-center gap-4">
                        <svg className="h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                        </svg>
                        <div>
                            <p className="text-lg font-semibold text-slate-700">批量上传政策文件</p>
                            <p className="text-sm text-slate-500 mt-1">支持批量上传，单个文件最大 100MB，支持拖拽上传</p>
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                        >
                            选择文件
                        </button>
                    </div>
                </div>
                )}

                {/* 加载历史记录提示 */}
                {isLoadingHistory && showHistory && (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4 animate-pulse">
                            <svg className="h-6 w-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                        <p className="text-lg font-semibold text-slate-700">正在加载历史记录...</p>
                        <p className="text-sm text-slate-500 mt-2">请稍候</p>
                    </div>
                )}

                {/* 对比结果表格 */}
                {(!isLoadingHistory || !showHistory) && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                                <thead className="bg-slate-100">
                                <tr>
                                    <th className="border border-slate-300 px-4 py-3 text-left font-semibold text-slate-900" style={{ width: "50px" }}>
                                        <input
                                            type="checkbox"
                                            checked={filteredFiles.length > 0 && selectedIds.size === filteredFiles.length}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="border border-slate-300 px-4 py-3 text-left font-semibold text-slate-900" style={{ width: "160px" }}>
                                        时间
                                    </th>
                                    <th className="border border-slate-300 px-4 py-3 text-left font-semibold text-blue-900 w-[400px] bg-blue-200 whitespace-nowrap sticky left-0 z-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                                        城市
                                    </th>
                                    <th className="border border-slate-300 px-4 py-3 text-left font-semibold text-slate-900 min-w-[200px] bg-slate-100">
                                        文件名
                                    </th>
                                    {standardNames.map((name, index) => (
                                        <th
                                            key={index}
                                            className="border border-slate-300 px-4 py-3 text-left font-semibold text-slate-900 min-w-[180px]"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>{name}</span>
                                                <span
                                                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-xs cursor-help"
                                                    title={standardRules[name] || ""}
                                                >
                                                    ?
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="border border-slate-300 px-4 py-3 text-left font-semibold text-slate-900 min-w-[120px]">
                                        操作
                                    </th>
                                </tr>
                                </thead>
                                <tbody>
                                {filteredFiles.length === 0 ? (
                                    <tr>
                                        <td colSpan={17} className="border border-slate-300 px-4 py-12">
                                            <div className="flex flex-col gap-3 pl-8">
                                                <div className="flex items-center gap-3">
                                                    <svg className="h-12 w-12 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <div className="text-slate-500 flex-1">
                                                        <p className="text-base font-medium mb-1">当前对比表格暂无数据</p>
                                                        <p className="text-sm">您可以上传文件进行对比，或切换到 <span className="text-blue-600 font-medium">历史记录</span> 查看之前的对比结果</p>
                                                    </div>
                                                </div>
                                                {!showHistory && (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 flex-shrink-0"></div>
                                                        <button
                                                            onClick={() => {
                                                                setShowHistory(true);
                                                                loadHistoryRecords(1);
                                                            }}
                                                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            查看历史记录
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                filteredFiles.map((file) => {
                                    const isSelected = selectedIds.has(file.id);
                                    return (
                                    <tr 
                                        key={file.id} 
                                        className={`border-b border-slate-200 hover:bg-slate-50 ${
                                            file.isVerified ? "bg-emerald-50/50 border-l-4 border-l-emerald-500" : ""
                                        } ${isSelected ? 'bg-blue-50' : ''}`}
                                    >
                                        <td className="border border-slate-300 px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(file.id)}
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="border border-slate-300 px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                                            {formatCompareTime(file.compareTime)}
                                        </td>
                                        <td className="border border-slate-300 px-4 py-3 w-[400px] bg-blue-50 sticky left-0 z-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                                            <div className="font-medium text-sm text-blue-900 whitespace-nowrap">
                                                {file.city || <span className="text-slate-400">-</span>}
                                            </div>
                                        </td>
                                        <td className="border border-slate-300 px-4 py-3 bg-white">
                                            {file.name ? (
                                                <div className="flex flex-col gap-1">
                                                    <div className="font-medium text-sm text-slate-700">{file.name}</div>
                                                    <div className="text-xs text-slate-500">{file.sizeFormatted}</div>
                                                {/* 上传状态 */}
                                                {file.uploadStatus === "uploading" && (
                                                    <div className="flex items-center gap-2 text-xs text-blue-600">
                                                        <svg className="h-3 w-3 animate-spin" fill="none"
                                                             viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10"
                                                                    stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor"
                                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        上传中...
                                                    </div>
                                                )}
                                                {file.uploadStatus === "error" && (
                                                    <div className="text-xs text-red-600">{file.error}</div>
                                                )}
                                                {/* 对比状态 */}
                                                {file.compareStatus === "comparing" && (
                                                    <div className="flex items-center gap-2 text-xs text-blue-600">
                                                        <svg className="h-3 w-3 animate-spin" fill="none"
                                                             viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10"
                                                                    stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor"
                                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        {file.compareProgress || "对比中..."}
                                                    </div>
                                                )}
                                                {file.compareStatus === "success" && (
                                                    <div className="flex flex-col gap-1 items-center text-xs">
                                                        <span className="text-green-600 font-medium">已完成</span>
                                                        {file.isVerified && (
                                                            <span className="text-emerald-600 font-medium">已审核</span>
                                                        )}
                                                    </div>
                                                )}
                                                 {file.compareStatus === "error" && (
                                                     <div className="text-xs text-red-600">{file.error}</div>
                                                 )}
                                             </div>
                                            ) : (
                                                <div className="text-sm text-slate-400">-</div>
                                            )}
                                        </td>
                                         {standardNames.map((standardName, index) => {
                                             // 直接按索引获取对应的结果数据
                                             const result = file.compareResult && file.compareResult[index] ? file.compareResult[index] : null;
                                             return (
                                                <td 
                                                    key={index} 
                                                    className={`border border-slate-300 px-4 py-3 ${
                                                        result 
                                                            ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all duration-200' 
                                                            : ''
                                                    }`}
                                                    onClick={() => result && handleCellClick(file, standardName, result)}
                                                >
                                                    {result ? (
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span
                                                                className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                                                                    result.status === "满足"
                                                                        ? "bg-green-100 text-green-700"
                                                                        : result.status === "部分满足"
                                                                        ? "bg-yellow-100 text-yellow-700"
                                                                        : result.status === "不满足"
                                                                        ? "bg-red-100 text-red-700"
                                                                        : result.status === "未提及"
                                                                        ? "bg-gray-100 text-gray-700"
                                                                        : "bg-slate-100 text-slate-700"
                                                                }`}
                                                            >
                                                                {result.status}
                                                            </span>
                                                            {result.matched !== null && (
                                                                <span
                                                                    className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                                                                        result.matched ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                                                                    }`}
                                                                >
                                                                    {result.matched ? "✓ 匹配" : "✗ 不匹配"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : file.compareStatus === "comparing" ? (
                                                        <div className="flex items-center justify-center">
                                                            <svg className="h-4 w-4 animate-spin text-blue-600"
                                                                 fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                                                        stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor"
                                                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-400">-</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="border border-slate-300 px-4 py-3">
                                            {file.name ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex flex-col gap-2">
                                                        {file.file_url && (
                                                            <button
                                                                onClick={() => handleRecompare(file.id)}
                                                                disabled={file.compareStatus === "comparing"}
                                                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                {file.compareStatus === "comparing" ? "对比中..." : "再次对比"}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(file.id)}
                                                            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100 transition-colors"
                                                        >
                                                            删除
                                                        </button>
                                                    </div>
                                                    {file.compareStatus === "success" && !file.isVerified && file._id && (
                                                        <button
                                                            onClick={() => setVerifyModal({ open: true, file })}
                                                            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 flex items-center gap-1"
                                                        >
                                                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            确认完成
                                                        </button>
                                                    )}
                                                    {file.isVerified && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs text-emerald-700">
                                                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            已确认
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-400">-</div>
                                            )}
                                        </td>
                                    </tr>
                                    );
                                })
                                )}
                                </tbody>
                            </table>
                        </div>
                    {/* 分页控件（仅历史记录显示） */}
                    {showHistory && totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-4 border-t border-slate-200">
                            <div className="text-sm text-slate-600">
                                第 {currentPage} / {totalPages} 页
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (currentPage > 1) {
                                            loadHistoryRecords(currentPage - 1);
                                        }
                                    }}
                                    disabled={currentPage === 1 || isLoadingHistory}
                                    className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    上一页
                                </button>
                                <button
                                    onClick={() => {
                                        if (currentPage < totalPages) {
                                            loadHistoryRecords(currentPage + 1);
                                        }
                                    }}
                                    disabled={currentPage === totalPages || isLoadingHistory}
                                    className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                )}

                {/* 覆盖/创建模式选择对话框 */}
                {compareModeModal.open && compareModeModal.file && createPortal(
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 relative">
                            <button
                                onClick={() => setCompareModeModal({ open: false, file: null })}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <div className="p-6">
                                <h3 className="text-lg font-semibold text-slate-900 mb-2">请选择对比模式</h3>
                                <p className="text-sm text-slate-600 mb-6">
                                    城市：{compareModeModal.file.city}
                                </p>
                                <div className="space-y-3">
                                    <button
                                        onClick={async () => {
                                            setCompareModeModal({ open: false, file: null });
                                            await executeCompare(compareModeModal.file!, "overwrite");
                                        }}
                                        className="w-full px-6 py-5 rounded-2xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-center text-center relative overflow-hidden group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative z-10">
                                            <div className="font-bold text-lg mb-1.5">覆盖当前记录</div>
                                            <div className="text-sm text-blue-50 leading-relaxed">
                                                更新当前记录
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setCompareModeModal({ open: false, file: null });
                                            await executeCompare(compareModeModal.file!, "create");
                                        }}
                                        className="w-full px-6 py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-center text-center relative overflow-hidden group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative z-10">
                                            <div className="font-bold text-lg mb-1.5">创建新的记录</div>
                                            <div className="text-sm text-emerald-50 leading-relaxed">
                                                {showHistory 
                                                    ? "跳转并创建新条目"
                                                    : "创建新的对比记录"}
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* 审核确认对话框 */}
                {verifyModal.open && verifyModal.file && createPortal(
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 relative">
                            <button
                                onClick={() => setVerifyModal({ open: false, file: null })}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <div className="p-6 text-center">
                                <h3 className="text-lg font-semibold text-slate-900 mb-2">确认完成审核</h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    城市：<span className="font-medium text-slate-800">{verifyModal.file.city}</span>
                                </p>
                                <p className="text-sm text-slate-700 mb-6">
                                    确认要将此对比记录标记为已审核完成吗？此操作将更新数据库中的审核状态。
                                </p>
                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={() => setVerifyModal({ open: false, file: null })}
                                        className="px-5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const file = verifyModal.file;
                                            if (file?._id) {
                                                const fileId = file._id; // 此时已经确认 _id 存在
                                                setVerifyModal({ open: false, file: null });
                                                await verifyRecord(fileId, file.id);
                                            }
                                        }}
                                        className="px-5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                    >
                                        确认完成
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* 详情对话框 */}
                {detailModal.open && detailModal.result && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        onClick={handleCloseModal}
                    >
                        <div
                            className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 头部 */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">{detailModal.standardName}</h2>
                                    {detailModal.file && (
                                        <p className="text-sm text-slate-500 mt-1">{detailModal.file.name}</p>
                                    )}
                                </div>
                                <button
                                    onClick={handleCloseModal}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* 内容 */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* 规则说明 */}
                                {standardRules[detailModal.standardName] && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">规则说明</h3>
                                        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                {standardRules[detailModal.standardName]}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* 状态信息 */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">状态信息</h3>
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div className="relative">
                                            <span className="text-xs text-slate-500">状态：</span>
                                            {editingStatus.status ? (
                                                <div className="inline-flex items-center gap-2 ml-2">
                                                    <select
                                                        value={editValues.status}
                                                        onChange={(e) => setEditValues(prev => ({ ...prev, status: e.target.value }))}
                                                        className="px-3 py-1 rounded text-sm font-medium border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="满足">满足</option>
                                                        <option value="部分满足">部分满足</option>
                                                        <option value="不满足">不满足</option>
                                                        <option value="未提及">未提及</option>
                                                        <option value="不适用">不适用</option>
                                                        <option value="暂不核查">暂不核查</option>
                                                    </select>
                                                    <button
                                                        onClick={async () => {
                                                            await handleSaveStandardItem(
                                                                detailModal.file!,
                                                                detailModal.standardName,
                                                                { status: editValues.status }
                                                            );
                                                            setEditingStatus(prev => ({ ...prev, status: false }));
                                                        }}
                                                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                                    >
                                                        保存
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditValues(prev => ({ ...prev, status: detailModal.result?.status || "" }));
                                                            setEditingStatus(prev => ({ ...prev, status: false }));
                                                        }}
                                                        className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                                                    >
                                                        取消
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-2 ml-2">
                                                    <span
                                                        className={`px-3 py-1 rounded text-sm font-medium ${
                                                            detailModal.result.status === "满足"
                                                                ? "bg-green-100 text-green-700"
                                                                : detailModal.result.status === "部分满足"
                                                                ? "bg-yellow-100 text-yellow-700"
                                                                : detailModal.result.status === "不满足"
                                                                ? "bg-red-100 text-red-700"
                                                                : detailModal.result.status === "未提及"
                                                                ? "bg-gray-100 text-gray-700"
                                                                : "bg-slate-100 text-slate-700"
                                                        }`}
                                                    >
                                                        {detailModal.result.status}
                                                    </span>
                                                    <button
                                                        onClick={() => setEditingStatus(prev => ({ ...prev, status: true }))}
                                                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                                        title="编辑状态"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className="text-xs text-slate-500">匹配：</span>
                                            {editingStatus.matched ? (
                                                <div className="inline-flex items-center gap-2 ml-2">
                                                    <select
                                                        value={editValues.matched === null ? "" : editValues.matched ? "true" : "false"}
                                                        onChange={(e) => {
                                                            const value = e.target.value === "" ? null : e.target.value === "true";
                                                            setEditValues(prev => ({ ...prev, matched: value }));
                                                        }}
                                                        className="px-3 py-1 rounded text-sm font-medium border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">未设置</option>
                                                        <option value="true">✓ 匹配</option>
                                                        <option value="false">✗ 不匹配</option>
                                                    </select>
                                                    <button
                                                        onClick={async () => {
                                                            await handleSaveStandardItem(
                                                                detailModal.file!,
                                                                detailModal.standardName,
                                                                { matched: editValues.matched }
                                                            );
                                                            setEditingStatus(prev => ({ ...prev, matched: false }));
                                                        }}
                                                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                                    >
                                                        保存
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditValues(prev => ({ ...prev, matched: detailModal.result?.matched ?? null }));
                                                            setEditingStatus(prev => ({ ...prev, matched: false }));
                                                        }}
                                                        className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                                                    >
                                                        取消
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-2 ml-2">
                                                    {detailModal.result.matched !== null ? (
                                                        <span
                                                            className={`px-3 py-1 rounded text-sm font-medium ${
                                                                detailModal.result.matched ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                                                            }`}
                                                        >
                                                            {detailModal.result.matched ? "✓ 匹配" : "✗ 不匹配"}
                                                        </span>
                                                    ) : (
                                                        <span className="px-3 py-1 rounded text-sm font-medium bg-slate-100 text-slate-500">
                                                            未设置
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => setEditingStatus(prev => ({ ...prev, matched: true }))}
                                                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                                        title="编辑匹配"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 依据 */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">依据</h3>
                                    </div>
                                    <div className="relative bg-slate-50 rounded-lg p-4 border border-slate-200 min-h-[100px]"
                                         onMouseEnter={(e) => {
                                             if (!editingStatus.evidence) {
                                                 e.currentTarget.querySelector('.edit-button')?.classList.remove('opacity-0');
                                             }
                                         }}
                                         onMouseLeave={(e) => {
                                             if (!editingStatus.evidence) {
                                                 e.currentTarget.querySelector('.edit-button')?.classList.add('opacity-0');
                                             }
                                         }}
                                    >
                                        {editingStatus.evidence ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-end gap-2 mb-2">
                                                    <button
                                                        onClick={async () => {
                                                            await handleSaveStandardItem(
                                                                detailModal.file!,
                                                                detailModal.standardName,
                                                                { evidence: editValues.evidence }
                                                            );
                                                            setEditingStatus(prev => ({ ...prev, evidence: false }));
                                                        }}
                                                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                                                    >
                                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        完成
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditValues(prev => ({ ...prev, evidence: detailModal.result?.evidence || "" }));
                                                            setEditingStatus(prev => ({ ...prev, evidence: false }));
                                                        }}
                                                        className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                                                    >
                                                        取消
                                                    </button>
                                                </div>
                                                <textarea
                                                    value={editValues.evidence}
                                                    onChange={(e) => setEditValues(prev => ({ ...prev, evidence: e.target.value }))}
                                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[200px]"
                                                    placeholder="请输入依据内容..."
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setEditValues(prev => ({ ...prev, evidence: detailModal.result?.evidence || "" }));
                                                        setEditingStatus(prev => ({ ...prev, evidence: true }));
                                                    }}
                                                    className="edit-button absolute top-2 right-2 p-1.5 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-all opacity-0 z-10"
                                                    title="编辑依据"
                                                >
                                                    <svg className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                {detailModal.result.evidence ? (
                                                    <div className="prose prose-sm max-w-none text-slate-700">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                                                                h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                                                                h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-2 mb-1" {...props} />,
                                                                h4: ({ node, ...props }) => <h4 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                                                                p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                                                                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                                                                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                                                                li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                                                                strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                                                                em: ({ node, ...props }) => <em className="italic" {...props} />,
                                                                code: ({ node, ...props }) => (
                                                                    <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono" {...props} />
                                                                ),
                                                                pre: ({ node, ...props }) => (
                                                                    <pre className="bg-slate-100 p-3 rounded overflow-x-auto mb-2" {...props} />
                                                                ),
                                                                blockquote: ({ node, ...props }) => (
                                                                    <blockquote className="border-l-4 border-slate-300 pl-4 italic my-2" {...props} />
                                                                ),
                                                                table: ({ node, ...props }) => (
                                                                    <div className="overflow-x-auto my-4">
                                                                        <table className="min-w-full border-collapse border border-slate-300 text-sm" {...props} />
                                                                    </div>
                                                                ),
                                                                thead: ({ node, ...props }) => (
                                                                    <thead className="bg-slate-100" {...props} />
                                                                ),
                                                                tbody: ({ node, ...props }) => (
                                                                    <tbody {...props} />
                                                                ),
                                                                tr: ({ node, ...props }) => (
                                                                    <tr className="border-b border-slate-200 hover:bg-slate-50" {...props} />
                                                                ),
                                                                th: ({ node, ...props }) => (
                                                                    <th className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-900" {...props} />
                                                                ),
                                                                td: ({ node, ...props }) => (
                                                                    <td className="border border-slate-300 px-4 py-2 text-slate-700" {...props} />
                                                                ),
                                                            }}
                                                        >
                                                            {detailModal.result.evidence}
                                                        </ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-slate-400 italic">暂无依据内容</div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* 结论 */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">结论</h3>
                                    </div>
                                    <div className="relative bg-blue-50 rounded-lg p-4 border border-blue-200 min-h-[100px]"
                                         onMouseEnter={(e) => {
                                             if (!editingStatus.analysis) {
                                                 e.currentTarget.querySelector('.edit-button')?.classList.remove('opacity-0');
                                             }
                                         }}
                                         onMouseLeave={(e) => {
                                             if (!editingStatus.analysis) {
                                                 e.currentTarget.querySelector('.edit-button')?.classList.add('opacity-0');
                                             }
                                         }}
                                    >
                                        {editingStatus.analysis ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-end gap-2 mb-2">
                                                    <button
                                                        onClick={async () => {
                                                            await handleSaveStandardItem(
                                                                detailModal.file!,
                                                                detailModal.standardName,
                                                                { analysis: editValues.analysis }
                                                            );
                                                            setEditingStatus(prev => ({ ...prev, analysis: false }));
                                                        }}
                                                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                                                    >
                                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        完成
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditValues(prev => ({ ...prev, analysis: detailModal.result?.analysis || "" }));
                                                            setEditingStatus(prev => ({ ...prev, analysis: false }));
                                                        }}
                                                        className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                                                    >
                                                        取消
                                                    </button>
                                                </div>
                                                <textarea
                                                    value={editValues.analysis}
                                                    onChange={(e) => setEditValues(prev => ({ ...prev, analysis: e.target.value }))}
                                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[200px]"
                                                    placeholder="请输入结论内容..."
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setEditValues(prev => ({ ...prev, analysis: detailModal.result?.analysis || "" }));
                                                        setEditingStatus(prev => ({ ...prev, analysis: true }));
                                                    }}
                                                    className="edit-button absolute top-2 right-2 p-1.5 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-all opacity-0 z-10"
                                                    title="编辑结论"
                                                >
                                                    <svg className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                {detailModal.result.analysis ? (
                                                    <div className="prose prose-sm max-w-none text-slate-700">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                                                                h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                                                                h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-2 mb-1" {...props} />,
                                                                h4: ({ node, ...props }) => <h4 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                                                                p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                                                                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                                                                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                                                                li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                                                                strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                                                                em: ({ node, ...props }) => <em className="italic" {...props} />,
                                                                code: ({ node, ...props }) => (
                                                                    <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono" {...props} />
                                                                ),
                                                                pre: ({ node, ...props }) => (
                                                                    <pre className="bg-slate-100 p-3 rounded overflow-x-auto mb-2" {...props} />
                                                                ),
                                                                blockquote: ({ node, ...props }) => (
                                                                    <blockquote className="border-l-4 border-slate-300 pl-4 italic my-2" {...props} />
                                                                ),
                                                                table: ({ node, ...props }) => (
                                                                    <div className="overflow-x-auto my-4">
                                                                        <table className="min-w-full border-collapse border border-slate-300 text-sm" {...props} />
                                                                    </div>
                                                                ),
                                                                thead: ({ node, ...props }) => (
                                                                    <thead className="bg-slate-100" {...props} />
                                                                ),
                                                                tbody: ({ node, ...props }) => (
                                                                    <tbody {...props} />
                                                                ),
                                                                tr: ({ node, ...props }) => (
                                                                    <tr className="border-b border-slate-200 hover:bg-slate-50" {...props} />
                                                                ),
                                                                th: ({ node, ...props }) => (
                                                                    <th className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-900" {...props} />
                                                                ),
                                                                td: ({ node, ...props }) => (
                                                                    <td className="border border-slate-300 px-4 py-2 text-slate-700" {...props} />
                                                                ),
                                                            }}
                                                        >
                                                            {detailModal.result.analysis}
                                                        </ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-slate-400 italic">暂无结论内容</div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}

