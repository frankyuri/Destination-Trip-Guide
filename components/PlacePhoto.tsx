/**
 * PlacePhoto.tsx — 景點照片元件
 *
 * 功能：
 * - 根據景點名稱自動搜尋 Unsplash 照片
 * - 照片載入時顯示骨架動畫
 * - 顯示攝影師姓名（Unsplash TOS 要求）
 * - 無照片時不佔空間
 */

import React, { useState, useEffect } from 'react';
import { Camera, ExternalLink } from 'lucide-react';
import { searchPlacePhoto, PlacePhotoResult } from '../utils/unsplash';

interface PlacePhotoProps {
    /** 景點名稱，用於搜尋照片 */
    placeName: string;
    /** 是否啟用載入（用於延遲載入，如只在展開時載入） */
    enabled?: boolean;
}

export const PlacePhoto: React.FC<PlacePhotoProps> = ({ placeName, enabled = true }) => {
    const [photo, setPhoto] = useState<PlacePhotoResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!enabled || !placeName) return;

        let cancelled = false;

        const fetchPhoto = async () => {
            setLoading(true);
            setError(false);

            try {
                const result = await searchPlacePhoto(placeName);
                if (!cancelled) {
                    setPhoto(result);
                }
            } catch {
                if (!cancelled) {
                    setError(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchPhoto();
        return () => { cancelled = true; };
    }, [placeName, enabled]);

    // 載入中：顯示骨架動畫
    if (loading) {
        return (
            <div className="w-full h-[120px] rounded-xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse mb-3 overflow-hidden relative">
                <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                    <Camera size={24} />
                </div>
            </div>
        );
    }

    // 無照片或錯誤：不顯示任何內容
    if (!photo || error) {
        return null;
    }

    return (
        <div className="relative w-full h-[120px] md:h-[160px] rounded-xl overflow-hidden mb-3 group/photo">
            {/* 照片 */}
            <img
                src={photo.smallUrl}
                alt={placeName}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                className={`w-full h-full object-cover transition-all duration-700 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                    }`}
            />

            {/* 載入前的佔位背景 */}
            {!loaded && (
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse" />
            )}

            {/* 漸層遮罩 + 攝影師姓名（Unsplash TOS） */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-3 py-2 flex items-end justify-between opacity-0 group-hover/photo:opacity-100 transition-opacity duration-300">
                <a
                    href={photo.photographerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-white/80 hover:text-white font-medium flex items-center gap-1 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Camera size={10} />
                    {photo.photographer}
                </a>
                <a
                    href={photo.photoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-white/60 hover:text-white font-medium flex items-center gap-1 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                >
                    Unsplash
                    <ExternalLink size={9} />
                </a>
            </div>
        </div>
    );
};
