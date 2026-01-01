"use client";

import {useState, useEffect, useRef} from "react";
import {useRouter} from "next/navigation";
import {Header} from "@/components/header";
import {Login} from "@/components/login";
import {formatFileSize, matchCityFromFileName} from "@/lib/city-matcher";
import {getCozeTokenClient} from "@/lib/coze-config";
import {showToast} from "@/lib/toast";

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
}

export default function StandardComparePage() {
    const router = useRouter();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState("");
    const [isChecking, setIsChecking] = useState(true);
    const [files, setFiles] = useState<FileInfo[]>([]);
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

        // 检查是否有文件正在处理（可选提示，不影响上传）
        const hasProcessingFiles = files.some(
            (f) => f.uploadStatus === "uploading" || f.compareStatus === "comparing"
        );

        // 检查文件是否已存在（根据文件名）
        const existingFileNames = new Set(files.map((f) => f.name));
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

        // 检查单次选择文件数限制（最多20个）
        if (newFiles.length > 20) {
            showToast(`单次最多只能选择20个文件，本次选择了${newFiles.length}个`, "error");
            return;
        }

        // 确保有有效文件需要上传
        if (validFiles.length === 0) {
            // 这种情况理论上不会发生（因为前面已经检查了），但为了安全起见
            if (duplicateFiles.length > 0) {
                showToast(`所有文件都已存在列表中，共 ${duplicateFiles.length} 个文件`, "error");
            }
            return;
        }

        // 添加新文件到列表（只添加不重复的文件）
        const fileInfos: FileInfo[] = validFiles.map((file, index) => {
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

        setFiles((prev) => [...prev, ...fileInfos]);

        // 并发上传文件，限制同时最多5个，并收集结果
        const uploadResults: Array<{ fileName: string; success: boolean; error?: string }> = [];
        const uploadTasks = fileInfos.map((fileInfo, index) => async () => {
            const result = await uploadFile(validFiles[index], fileInfo.id);
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

        // 如果有重复文件，也计入失败
        const totalFailCount = failCount + duplicateCount;
        const totalCount = validFiles.length + duplicateFiles.length;

        // 构建失败原因列表（去重并分类）
        const failureReasons: string[] = [];
        if (duplicateCount > 0) {
            failureReasons.push(`${duplicateCount} 个文件已存在`);
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
        const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
        if (file.size > MAX_FILE_SIZE) {
            const errorMsg = `文件大小超过限制（最大 20MB）`;
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

                // 上传成功后立即调用对比API（不等待，并行执行）
                compareFile(fileId, data.file_url).catch((error) => {
                    console.error(`文件 ${fileId} 对比失败:`, error);
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

    // 调用对比API
    const compareFile = async (fileId: string, file_url: string) => {
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

        try {
            const token = getCozeTokenClient();

            const response = await fetch("/api/standard-compare", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-coze-token": token,
                },
                body: JSON.stringify({file_url}),
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
                    return;
                }

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
        }
    };

    // 再次对比
    const handleRecompare = async (fileId: string) => {
        const file = files.find((f) => f.id === fileId);
        if (!file || !file.file_url) {
            showToast("文件URL不存在，无法重新对比", "error");
            return;
        }

        await compareFile(fileId, file.file_url);
    };

    // 删除文件
    const handleDelete = (fileId: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
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
        "业务增长率目标": "1、判断对个人、团队以及整个公司2026年的目标，增长率是否高于10%？\n2、如果有不高于10%的情况，要抓取出相关信息，提示预警。",
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

    // 生成显示的文件列表（如果有文件就用文件，没有就生成10行空白数据）
    const displayFiles: FileInfo[] = files.length > 0
        ? files
        : Array.from({ length: 10 }, (_, index) => ({
            id: `placeholder-${index}`,
            name: "",
            size: 0,
            sizeFormatted: "",
            file_url: "",
            city: "",
            uploadStatus: "success" as const,
            compareStatus: "idle" as const,
            compareResult: null,
            uploadProgress: 0,
            compareProgress: "",
        }));

    return (
        <>
            <Header username={username} onLogout={handleLogout}/>
            <main className="mx-auto max-w-[1400px] px-4 py-6 space-y-4">
                {/* 返回首页按钮 */}
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
                    <div className="text-sm text-slate-500">
                        已上传 {files.length} 个文件
                    </div>
                </div>

                {/* 文件上传区域 */}
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
                            <p className="text-sm text-slate-500 mt-1">单次最多选择20个文件，支持拖拽上传</p>
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                        >
                            选择文件
                        </button>
                    </div>
                </div>

                {/* 对比结果表格 */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                                <thead className="bg-slate-100">
                                <tr>
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
                                {displayFiles.map((file) => (
                                    <tr key={file.id} className="border-b border-slate-200 hover:bg-slate-50">
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
                                                        <div className="space-y-2 min-w-[200px]">
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
                                                            {result.evidence && (
                                                                <div className="group relative">
                                                                    <div className="text-xs text-slate-600 line-clamp-2">
                                                                        <span className="font-medium">依据：</span>
                                                                        {result.evidence}
                                                                    </div>
                                                                    {result.evidence.length > 50 && (
                                                                        <div
                                                                            className="absolute left-0 top-full mt-1 hidden group-hover:block z-20 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-xl">
                                                                            {result.evidence}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {result.analysis && (
                                                                <div className="group relative">
                                                                    <div className="text-xs text-slate-500 line-clamp-2">
                                                                        <span className="font-medium">分析：</span>
                                                                        {result.analysis}
                                                                    </div>
                                                                    {result.analysis.length > 50 && (
                                                                        <div
                                                                            className="absolute left-0 top-full mt-1 hidden group-hover:block z-20 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-xl">
                                                                            {result.analysis}
                                                                        </div>
                                                                    )}
                                                                </div>
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
                                            ) : (
                                                <div className="text-xs text-slate-400">-</div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

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
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <span className="text-xs text-slate-500">状态：</span>
                                            <span
                                                className={`ml-2 px-3 py-1 rounded text-sm font-medium ${
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
                                        </div>
                                        {detailModal.result.matched !== null && (
                                            <div>
                                                <span className="text-xs text-slate-500">匹配：</span>
                                                <span
                                                    className={`ml-2 px-3 py-1 rounded text-sm font-medium ${
                                                        detailModal.result.matched ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                                                    }`}
                                                >
                                                    {detailModal.result.matched ? "✓ 匹配" : "✗ 不匹配"}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 依据 */}
                                {detailModal.result.evidence && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">依据</h3>
                                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                {detailModal.result.evidence}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* 分析 */}
                                {detailModal.result.analysis && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">分析</h3>
                                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                {detailModal.result.analysis}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* 如果没有依据和分析，显示提示 */}
                                {!detailModal.result.evidence && !detailModal.result.analysis && (
                                    <div className="text-center py-8 text-slate-400">
                                        <p className="text-sm">暂无详细信息</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}

