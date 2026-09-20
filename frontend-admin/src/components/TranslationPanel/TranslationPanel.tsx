import React, { useCallback, useMemo, useState } from 'react';
import { Send, Languages, History, Search, SearchX, X, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui';
import { MAX_INPUT_LENGTH, LANGUAGES } from '@/utils/constants';
import { getLanguageDisplayName } from '@/utils/helpers';
import { HistoryItem } from './HistoryItem';
import type { TranslationResult } from '@/types';

// 检测文本是否主要是指定语言
const isTextInLanguage = (text: string, lang: string): boolean => {
  const trimmedText = text.trim();
  if (!trimmedText) return false;

  const chineseRegex = /[\u4e00-\u9fa5]/g;
  const englishRegex = /[a-zA-Z]/g;

  const chineseMatches = trimmedText.match(chineseRegex) || [];
  const englishMatches = trimmedText.match(englishRegex) || [];

  const chineseCount = chineseMatches.length;
  const englishCount = englishMatches.length;

  if (lang.startsWith('zh')) {
    return chineseCount > 0;
  }

  if (lang.startsWith('en')) {
    return chineseCount === 0 && englishCount > 0;
  }

  return true;
};

// 简单翻译函数
const translateText = (text: string, sourceLang: string, targetLang: string): string => {
  // 英文→中文
  if (sourceLang.startsWith('en') && targetLang.startsWith('zh')) {
    const enToCn: Record<string, string> = {
      'hello': '你好',
      'good morning': '早上好',
      'good evening': '晚上好',
      'good night': '晚安',
      'thank you': '谢谢',
      'thanks': '谢谢',
      'sorry': '对不起',
      'goodbye': '再见',
      'bye': '再见',
      'yes': '是的',
      'no': '不是',
      'ok': '好的',
      'please': '请',
      'welcome': '欢迎',
      'how are you': '你好吗',
      'good afternoon': '下午好',
    };

    const lowerText = text.toLowerCase().trim().replace(/[.!?。！？]+$/, '');
    if (enToCn[lowerText]) {
      return enToCn[lowerText];
    }

    let result = text;
    Object.entries(enToCn).forEach(([en, cn]) => {
      result = result.replace(new RegExp(`\\b${en}\\b`, 'gi'), cn);
    });
    return result !== text ? result : `[待翻译] ${text}`;
  }

  // 中文→英文
  if (sourceLang.startsWith('zh') && targetLang.startsWith('en')) {
    const cnToEn: Record<string, string> = {
      '你好': 'Hello',
      '早上好': 'Good morning',
      '晚上好': 'Good evening',
      '晚安': 'Good night',
      '下午好': 'Good afternoon',
      '谢谢': 'Thank you',
      '对不起': 'Sorry',
      '再见': 'Goodbye',
      '是的': 'Yes',
      '不是': 'No',
      '好的': 'OK',
      '请': 'Please',
      '欢迎': 'Welcome',
    };

    const trimmedText = text.trim().replace(/[.!?。！？]+$/, '');
    if (cnToEn[trimmedText]) {
      return cnToEn[trimmedText];
    }

    let result = text;
    Object.entries(cnToEn).forEach(([cn, en]) => {
      result = result.replace(new RegExp(cn, 'g'), en);
    });
    return result !== text ? result : `[Translation] ${text}`;
  }

  return text;
};

// 由语言代码得到语言对标识，如 zh-CN + en-US → 'zh-en'
const getLangPairKey = (sourceLang: string, targetLang: string): string => {
  return `${sourceLang.split('-')[0]}-${targetLang.split('-')[0]}`;
};

export const TranslationPanel: React.FC = () => {
  const inputText = useAppStore(state => state.inputText);
  const translationHistory = useAppStore(state => state.translationHistory);
  const pinnedTranslationIds = useAppStore(state => state.pinnedTranslationIds);
  const isTranslating = useAppStore(state => state.isTranslating);
  const sourceLang = useAppStore(state => state.sourceLang);
  const targetLang = useAppStore(state => state.targetLang);
  const setInputText = useAppStore(state => state.setInputText);
  const addToast = useAppStore(state => state.addToast);
  const addSessionRecord = useAppStore(state => state.addSessionRecord);
  const addTranslation = useAppStore(state => state.addTranslation);
  const togglePinTranslation = useAppStore(state => state.togglePinTranslation);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [localTranslating, setLocalTranslating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [langPair, setLangPair] = useState('all');

  // 语言对筛选项，基于支持的语言生成（如 简体中文 → English）
  const langPairOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: 'all', label: '全部语言对' },
    ];
    LANGUAGES.forEach(source => {
      LANGUAGES.forEach(target => {
        if (source.code !== target.code) {
          options.push({
            value: getLangPairKey(source.code, target.code),
            label: `${source.nativeName} → ${target.nativeName}`,
          });
        }
      });
    });
    return options;
  }, []);

  // 置顶的记录排在最前（最近置顶的在最上面），其余保持原有次序
  const orderedHistory = useMemo(() => {
    if (pinnedTranslationIds.length === 0) return translationHistory;
    const pinnedSet = new Set(pinnedTranslationIds);
    const recordById = new Map(translationHistory.map(item => [item.id, item]));
    const pinned = pinnedTranslationIds
      .map(id => recordById.get(id))
      .filter((item): item is TranslationResult => Boolean(item));
    const unpinned = translationHistory.filter(item => !pinnedSet.has(item.id));
    return [...pinned, ...unpinned];
  }, [translationHistory, pinnedTranslationIds]);

  // 关键词（按原文）与语言对即时筛选
  const filteredHistory = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    return orderedHistory.filter(item => {
      const matchesKeyword =
        !keyword || item.sourceText.toLowerCase().includes(keyword);
      const matchesPair =
        langPair === 'all' || getLangPairKey(item.sourceLang, item.targetLang) === langPair;
      return matchesKeyword && matchesPair;
    });
  }, [orderedHistory, searchQuery, langPair]);

  const pinnedSet = useMemo(() => new Set(pinnedTranslationIds), [pinnedTranslationIds]);
  const isFiltering = searchQuery.trim() !== '' || langPair !== 'all';

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setLangPair('all');
  }, []);

  const handleTogglePin = useCallback((id: string) => {
    togglePinTranslation(id);
  }, [togglePinTranslation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputText.trim()) {
      addToast('warning', '请输入要翻译的文本');
      return;
    }

    // 检查输入文本是否符合源语言
    if (!isTextInLanguage(inputText, sourceLang)) {
      const expectedLang = sourceLang.startsWith('zh') ? '中文' : '英文';
      addToast('warning', `请输入${expectedLang}文本（当前源语言设置）`);
      return;
    }

    setLocalTranslating(true);

    // 模拟翻译延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    const translated = translateText(inputText, sourceLang, targetLang);

    // 翻译历史与会话记录写入同一份原文/译文，保证两处内容一致
    addTranslation({
      sourceText: inputText,
      targetText: translated,
      sourceLang,
      targetLang,
    });

    addSessionRecord({
      type: 'manual',
      sourceText: inputText,
      targetText: translated,
      sourceLang,
      targetLang,
    });

    setInputText('');
    setLocalTranslating(false);
    addToast('success', '翻译完成');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      addToast('success', '已复制到剪贴板');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      addToast('error', '复制失败');
    }
  }, [addToast]);

  const charCount = inputText.length;
  const isOverLimit = charCount > MAX_INPUT_LENGTH;

  return (
    <aside className="w-full h-full flex-shrink-0 glass-panel rounded-2xl p-6 flex flex-col gap-6 overflow-hidden">
      {/* 标题 */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
        <div className="p-2 bg-primary-500/20 rounded-lg">
          <Languages className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-dark-100">文本翻译</h2>
          <p className="text-xs text-dark-500">
            {getLanguageDisplayName(sourceLang, LANGUAGES)} →{' '}
            {getLanguageDisplayName(targetLang, LANGUAGES)}
          </p>
        </div>
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`输入${sourceLang.startsWith('zh') ? '中文' : '英文'}文本...`}
            rows={4}
            className={`
              input-field resize-none
              ${isOverLimit ? 'border-accent-red focus:ring-accent-red/50' : ''}
            `}
          />

          {/* 字符计数 */}
          <div
            className={`
              absolute bottom-3 right-3 text-xs font-mono
              ${isOverLimit ? 'text-accent-red' : 'text-dark-500'}
            `}
          >
            {charCount}/{MAX_INPUT_LENGTH}
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={localTranslating || isTranslating}
          disabled={!inputText.trim() || isOverLimit}
          icon={<Send className="w-4 h-4" />}
          className="w-full"
        >
          {localTranslating ? '翻译中...' : '发送翻译'}
        </Button>
      </form>

      {/* 翻译历史 */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-dark-300 flex items-center gap-2">
            <History className="w-4 h-4" />
            翻译历史
          </h3>
          {orderedHistory.length > 0 && (
            <span className="text-xs text-dark-500">
              {isFiltering ? (
                <>
                  命中{' '}
                  <span className="text-primary-400 font-medium">
                    {filteredHistory.length}
                  </span>
                  {' '}/ {orderedHistory.length} 条
                </>
              ) : (
                `${orderedHistory.length} 条记录`
              )}
            </span>
          )}
        </div>

        {/* 检索与筛选工具栏 */}
        {orderedHistory.length > 0 && (
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索原文关键词..."
                className="w-full pl-8 pr-7 py-2 bg-dark-800/50 border border-white/10 rounded-lg text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-white/10 rounded"
                  title="清除关键词"
                >
                  <X className="w-3.5 h-3.5 text-dark-500" />
                </button>
              )}
            </div>
            <div className="relative flex-shrink-0">
              <select
                value={langPair}
                onChange={e => setLangPair(e.target.value)}
                className="h-full pl-3 pr-8 py-2 bg-dark-800/50 border border-white/10 rounded-lg text-sm text-dark-200 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                title="按语言对筛选"
              >
                {langPairOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500 pointer-events-none" />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {orderedHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-dark-500">
              <History className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">暂无翻译记录</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-dark-500">
              <SearchX className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">未找到匹配的翻译记录</p>
              <p className="text-xs mt-1 mb-3 text-dark-600">
                试试更换关键词或语言对
              </p>
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-xs bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-lg border border-white/10 transition-colors"
              >
                清除筛选条件
              </button>
            </div>
          ) : (
            filteredHistory.map(item => (
              <HistoryItem
                key={item.id}
                item={item}
                isPinned={pinnedSet.has(item.id)}
                isCopied={copiedId === item.id}
                onCopy={handleCopy}
                onTogglePin={handleTogglePin}
              />
            ))
          )}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="pt-3 border-t border-white/10">
        <p className="text-xs text-dark-500 text-center">
          按 Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </aside>
  );
};
