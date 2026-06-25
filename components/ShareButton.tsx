import React, { useEffect, useRef, useState } from 'react';
import { Check, Link2, Share2, X } from 'lucide-react';

interface ShareButtonProps {
  dayIndex: number;
  dayTitle: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ dayIndex, dayTitle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const getShareUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('day', dayIndex.toString());
    return url.toString();
  };

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy share link:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `福岡之旅 - ${dayTitle}`,
          text: `查看我的福岡旅遊行程：${dayTitle}`,
          url: getShareUrl(),
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    setIsOpen(true);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleShare}
        className="flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Share2 size={14} aria-hidden="true" />
        <span>分享</span>
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/20"
            onClick={() => setIsOpen(false)}
            aria-label="關閉分享視窗"
          />
          <div
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-gray-100 bg-white p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 id="share-dialog-title" className="font-bold text-gray-800">分享行程</h4>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className="min-h-11 min-w-11 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="關閉分享視窗"
              >
                <X size={16} className="mx-auto" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              className={`flex min-h-11 w-full items-center gap-3 rounded-lg border p-3 transition-all ${copied ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
            >
              {copied ? <Check size={18} aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}
              <span className="text-sm font-medium">{copied ? '已複製！' : '複製連結'}</span>
            </button>

            <a
              href={`https://line.me/R/msg/text/?${encodeURIComponent(`查看我的福岡旅遊行程：${dayTitle}\n${getShareUrl()}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg bg-[#00B900] p-3 text-white transition-all hover:bg-[#00A000]"
            >
              <span className="text-sm font-medium">分享到 LINE</span>
            </a>

            <p className="mt-3 truncate border-t border-gray-100 pt-3 font-mono text-[10px] text-gray-400">{getShareUrl()}</p>
          </div>
        </>
      )}
    </div>
  );
};