/**
 * ProgressTracker.tsx - 行程進度追蹤元件
 * 
 * 功能：
 * - 讓用戶標記已完成的景點
 * - 使用 localStorage 儲存進度（重整頁面不會遺失）
 * - 顯示每日進度條
 * - 全部完成時顯示慶祝動畫
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Trophy, Sparkles } from 'lucide-react';

// ======================================
// Props 介面定義
// ======================================

/**
 * ProgressCheckbox 元件的 Props
 * @property itemId - 行程項目的唯一識別碼
 * @property compact - 是否使用緊湊模式（較小的尺寸）
 */
interface ProgressTrackerProps {
    itemId: string;
    compact?: boolean;
}

// ======================================
// 自訂 Hook: useProgressTracker
// ======================================

/**
 * 行程進度追蹤的自訂 Hook
 * 
 * 使用方式：
 * ```tsx
 * const { toggleItem, isCompleted, getProgress, resetProgress } = useProgressTracker();
 * 
 * // 切換某個項目的完成狀態
 * toggleItem('item-1');
 * 
 * // 檢查某個項目是否已完成
 * const completed = isCompleted('item-1');
 * 
 * // 取得一組項目的進度統計
 * const progress = getProgress(['item-1', 'item-2', 'item-3']);
 * // 回傳: { completed: 2, total: 3, percentage: 67 }
 * ```
 * 
 * @returns 進度追蹤的操作函數
 */
export const useProgressTracker = () => {
    // 使用 Set 儲存已完成項目的 ID（Set 確保不會有重複）
    const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

    /**
     * 初始化時從 localStorage 載入已儲存的進度
     * 只在元件首次載入時執行一次
     */
    useEffect(() => {
        // 從 localStorage 讀取進度資料
        const saved = localStorage.getItem('destination_trip_progress');
        if (saved) {
            try {
                // 解析 JSON 並轉換成 Set
                const parsed = JSON.parse(saved);
                setCompletedItems(new Set(parsed));
            } catch (e) {
                // 如果解析失敗，輸出錯誤但不影響程式運行
                console.error('Failed to parse progress data');
            }
        }
    }, []);

    /**
     * 切換項目的完成狀態
     * 如果已完成 → 標記為未完成
     * 如果未完成 → 標記為已完成
     * 
     * @param itemId - 要切換的項目 ID
     */
    const toggleItem = useCallback((itemId: string) => {
        setCompletedItems(prev => {
            // 建立新的 Set（React 需要新的參考才會觸發重新渲染）
            const newSet = new Set(prev);

            if (newSet.has(itemId)) {
                // 如果已存在，移除它（標記為未完成）
                newSet.delete(itemId);
            } else {
                // 如果不存在，新增它（標記為已完成）
                newSet.add(itemId);
            }

            // 將更新後的進度儲存到 localStorage
            // Set 需要先轉換成陣列才能 JSON 序列化
            localStorage.setItem('destination_trip_progress', JSON.stringify([...newSet]));

            return newSet;
        });
    }, []);

    /**
     * 檢查某個項目是否已完成
     * 
     * @param itemId - 要檢查的項目 ID
     * @returns 是否已完成
     */
    const isCompleted = useCallback((itemId: string) => completedItems.has(itemId), [completedItems]);

    /**
     * 計算一組項目的進度統計
     * 
     * @param itemIds - 項目 ID 陣列
     * @returns 進度統計物件
     */
    const getProgress = useCallback((itemIds: string[]) => {
        // 計算已完成的數量
        const completed = itemIds.filter(id => completedItems.has(id)).length;

        return {
            completed,                                              // 已完成數量
            total: itemIds.length,                                  // 總數量
            percentage: Math.round((completed / itemIds.length) * 100)  // 完成百分比
        };
    }, [completedItems]);

    /**
     * 重置所有進度（清除所有已完成標記）
     */
    const resetProgress = useCallback(() => {
        setCompletedItems(new Set());
        localStorage.removeItem('destination_trip_progress');
    }, []);

    return { toggleItem, isCompleted, getProgress, resetProgress, completedItems };
};

// ======================================
// 元件: ProgressCheckbox
// ======================================

/**
 * 進度勾選框元件
 * 用於單個行程項目的完成狀態切換
 * 
 * 特點：
 * - 已完成時顯示綠色打勾
 * - 未完成時顯示空心圓圈
 * - 有 hover 動畫效果
 * - 支援緊湊模式（用於較小的空間）
 */
export const ProgressCheckbox: React.FC<ProgressTrackerProps & {
    isCompleted: boolean;      // 是否已完成
    onToggle: () => void;      // 點擊時的回呼函數
}> = ({ isCompleted, onToggle, compact }) => {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onToggle();
            }}
            className={`
                flex items-center justify-center transition-colors
                ${compact ? 'w-6 h-6' : 'w-8 h-8'}
                border
                ${isCompleted
                    ? 'bg-ink-900 border-ink-900 text-white'
                    : 'bg-white border-ink-200 text-ink-300 hover:border-ink-900 hover:text-ink-900'
                }
            `}
            title={isCompleted ? '標記為未完成' : '標記為已完成'}
            aria-pressed={isCompleted}
            aria-label={isCompleted ? '標記為未完成' : '標記為已完成'}
        >
            {isCompleted ? (
                <CheckCircle2 size={compact ? 14 : 18} strokeWidth={1.75} />
            ) : (
                <Circle size={compact ? 14 : 18} strokeWidth={1.5} />
            )}
        </button>
    );
};

// ======================================
// 元件: DayProgressBar
// ======================================

/**
 * 每日進度條元件
 * 顯示當日行程的完成進度
 * 
 * 特點：
 * - 顯示「已完成 / 總數」
 * - 漸層進度條動畫
 * - 100% 完成時顯示獎盃和慶祝訊息
 */
export const DayProgressBar: React.FC<{
    completed: number;      // 已完成數量
    total: number;          // 總數量
    showLabel?: boolean;    // 是否顯示標籤（預設為 true）
}> = ({ completed, total, showLabel = true }) => {
    // 計算完成百分比
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // 判斷是否全部完成
    const isComplete = completed === total && total > 0;

    return (
        <div className="w-full">
            {showLabel && (
                <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-ink-500">
                        Progress
                    </span>
                    <div className="flex items-baseline gap-2">
                        {isComplete && (
                            <Trophy size={12} className="text-vermillion self-center" strokeWidth={1.75} />
                        )}
                        <span className={`font-serif text-sm font-semibold ${isComplete ? 'text-vermillion' : 'text-ink-900'}`}>
                            {completed}
                        </span>
                        <span className="text-xs text-ink-300">/ {total}</span>
                    </div>
                </div>
            )}

            {/* 細扁線條進度條 — 墨線風格 */}
            <div className="h-[2px] bg-ink-100 overflow-hidden">
                <div
                    className={`h-full transition-all duration-500 ease-out ${isComplete ? 'bg-vermillion' : 'bg-ink-900'}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {isComplete && (
                <div className="mt-3 flex items-center gap-2 text-[11px] tracking-wider uppercase text-vermillion font-medium animate-in fade-in">
                    <Sparkles size={11} strokeWidth={1.75} />
                    本日行程完走
                </div>
            )}
        </div>
    );
};
