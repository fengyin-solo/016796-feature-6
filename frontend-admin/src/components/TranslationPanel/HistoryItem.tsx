import React from 'react';
import { Copy, Check, Pin } from 'lucide-react';
import { formatTime } from '@/utils/helpers';
import type { TranslationResult } from '@/types';

interface HistoryItemProps {
  item: TranslationResult;
  isPinned: boolean;
  isCopied: boolean;
  onCopy: (text: string, id: string) => void;
  onTogglePin: (id: string) => void;
}

// 单条翻译历史记录，使用 React.memo 避免长列表中无关记录重复渲染；
// contentVisibility 让浏览器跳过屏幕外卡片的渲染，保证历史很多时也不卡顿
export const HistoryItem = React.memo<HistoryItemProps>(({
  item,
  isPinned,
  isCopied,
  onCopy,
  onTogglePin,
}) => {
  return (
    <div
      className={`glass-card p-4 space-y-3 animate-fade-in ${
        isPinned ? 'border border-primary-500/30' : ''
      }`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 140px' } as React.CSSProperties}
    >
      {/* 原文 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-dark-500 flex items-center gap-2">
            原文
            {isPinned && (
              <span className="inline-flex items-center gap-0.5 text-primary-400">
                <Pin className="w-3 h-3 fill-current" />
                置顶
              </span>
            )}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-dark-600 font-mono">
              {formatTime(item.timestamp)}
            </span>
            <button
              onClick={() => onTogglePin(item.id)}
              className={`p-1 rounded transition-colors ${
                isPinned
                  ? 'text-primary-400 hover:bg-primary-500/10'
                  : 'text-dark-500 hover:bg-white/5 hover:text-dark-300'
              }`}
              title={isPinned ? '取消置顶' : '定位到最前'}
            >
              <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
        <p className="text-sm text-dark-200 break-words">
          {item.sourceText}
        </p>
      </div>

      {/* 分隔线 */}
      <div className="border-t border-white/5" />

      {/* 译文 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-primary-400">译文</span>
          <button
            onClick={() => onCopy(item.targetText, item.id)}
            className="p-1 hover:bg-white/5 rounded transition-colors"
            title="复制译文"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-accent-green" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-dark-500" />
            )}
          </button>
        </div>
        <p className="text-sm text-dark-100 break-words">
          {item.targetText}
        </p>
      </div>
    </div>
  );
});

HistoryItem.displayName = 'HistoryItem';
