import { create } from 'zustand';
import type { AppState, ToastType, AudioSettings, SessionRecord, TranslationResult } from '@/types';
import { generateId } from '@/utils/helpers';
import { DEFAULT_AUDIO_SETTINGS, TOAST_DURATION } from '@/utils/constants';

const STORAGE_KEY = 'subtitle-translator-session-records';
const TRANSLATION_HISTORY_KEY = 'subtitle-translator-translation-history';
const TRANSLATION_PINS_KEY = 'subtitle-translator-translation-pins';

const loadRecordsFromStorage = (): SessionRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((r: SessionRecord) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      }));
    }
  } catch {
    console.error('Failed to load session records from storage');
  }
  return [];
};

const saveRecordsToStorage = (records: SessionRecord[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    console.error('Failed to save session records to storage');
  }
};

const loadTranslationHistoryFromStorage = (): TranslationResult[] => {
  try {
    const stored = localStorage.getItem(TRANSLATION_HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((r: TranslationResult) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      }));
    }
  } catch {
    console.error('Failed to load translation history from storage');
  }
  return [];
};

const saveTranslationHistoryToStorage = (records: TranslationResult[]) => {
  try {
    localStorage.setItem(TRANSLATION_HISTORY_KEY, JSON.stringify(records));
  } catch {
    console.error('Failed to save translation history to storage');
  }
};

const loadPinnedIdsFromStorage = (): string[] => {
  try {
    const stored = localStorage.getItem(TRANSLATION_PINS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter(id => typeof id === 'string');
      }
    }
  } catch {
    console.error('Failed to load pinned translation ids from storage');
  }
  return [];
};

const savePinnedIdsToStorage = (ids: string[]) => {
  try {
    localStorage.setItem(TRANSLATION_PINS_KEY, JSON.stringify(ids));
  } catch {
    console.error('Failed to save pinned translation ids to storage');
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  // 控制面板状态
  sourceLang: 'zh-CN',
  targetLang: 'en-US',
  isMicOn: false,
  isRecording: false,
  audioSettings: DEFAULT_AUDIO_SETTINGS,
  
  // 字幕状态 - 初始为空
  subtitles: [],
  currentSubtitle: '',
  
  // 翻译状态
  inputText: '',
  translationHistory: loadTranslationHistoryFromStorage(),
  pinnedTranslationIds: loadPinnedIdsFromStorage(),
  isTranslating: false,
  
  // Toast状态
  toasts: [],
  
  // 会话记录
  sessionRecords: loadRecordsFromStorage(),
  
  // Actions
  setSourceLang: (lang: string) => {
    set({ sourceLang: lang });
    get().addToast('info', `源语言已切换`);
  },
  
  setTargetLang: (lang: string) => {
    set({ targetLang: lang });
    get().addToast('info', `目标语言已切换`);
  },
  
  toggleMic: () => {
    const { isMicOn } = get();
    const newState = !isMicOn;
    set({ isMicOn: newState, isRecording: newState });
  },
  
  setAudioSettings: (settings: Partial<AudioSettings>) => {
    set(state => ({
      audioSettings: { ...state.audioSettings, ...settings },
    }));
  },
  
  addSubtitle: (original: string, translated: string) => {
    const { sourceLang, targetLang } = get();
    set(state => ({
      subtitles: [
        ...state.subtitles.map(s => ({ ...s, isActive: false })),
        {
          id: generateId(),
          originalText: original,
          translatedText: translated,
          timestamp: new Date(),
          isActive: true,
        },
      ],
      currentSubtitle: '',
    }));
    get().addSessionRecord({
      type: 'voice',
      sourceText: original,
      targetText: translated,
      sourceLang,
      targetLang,
    });
  },
  
  setCurrentSubtitle: (text: string) => {
    set({ currentSubtitle: text });
  },
  
  setInputText: (text: string) => {
    set({ inputText: text });
  },
  
  translate: async () => {
    const { inputText, sourceLang, targetLang, addToast, addSessionRecord, addTranslationRecord } = get();

    if (!inputText.trim()) {
      addToast('warning', '请输入要翻译的文本');
      return;
    }

    set({ isTranslating: true });

    try {
      // 模拟翻译
      await new Promise(resolve => setTimeout(resolve, 800));
      const result = `[Translated] ${inputText}`;

      addTranslationRecord({
        sourceText: inputText,
        targetText: result,
        sourceLang,
        targetLang,
      });

      set({ inputText: '', isTranslating: false });

      addSessionRecord({
        type: 'manual',
        sourceText: inputText,
        targetText: result,
        sourceLang,
        targetLang,
      });

      addToast('success', '翻译完成');
    } catch {
      set({ isTranslating: false });
      addToast('error', '翻译失败，请重试');
    }
  },

  addTranslationRecord: (record) => {
    set(state => {
      const newRecord: TranslationResult = {
        id: generateId(),
        timestamp: new Date(),
        ...record,
      };
      const newHistory = [newRecord, ...state.translationHistory];
      saveTranslationHistoryToStorage(newHistory);
      return { translationHistory: newHistory };
    });
  },

  togglePinnedTranslation: (id: string) => {
    set(state => {
      const isPinned = state.pinnedTranslationIds.includes(id);
      // 新置顶的记录排在已置顶序列的最前，其余保持原有置顶次序
      const newPinnedIds = isPinned
        ? state.pinnedTranslationIds.filter(pinnedId => pinnedId !== id)
        : [id, ...state.pinnedTranslationIds];
      savePinnedIdsToStorage(newPinnedIds);
      return { pinnedTranslationIds: newPinnedIds };
    });
  },
  
  addToast: (type: ToastType, message: string) => {
    const id = generateId();
    set(state => ({
      toasts: [...state.toasts, { id, type, message, duration: TOAST_DURATION }],
    }));
    
    // 自动移除
    setTimeout(() => {
      get().removeToast(id);
    }, TOAST_DURATION);
  },
  
  removeToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }));
  },
  
  addSessionRecord: (record) => {
    set(state => {
      const newRecord: SessionRecord = {
        id: generateId(),
        timestamp: new Date(),
        ...record,
      };
      const newRecords = [newRecord, ...state.sessionRecords];
      saveRecordsToStorage(newRecords);
      return { sessionRecords: newRecords };
    });
  },
  
  deleteSessionRecord: (id: string) => {
    set(state => {
      const newRecords = state.sessionRecords.filter(r => r.id !== id);
      saveRecordsToStorage(newRecords);
      return { sessionRecords: newRecords };
    });
    get().addToast('success', '记录已删除');
  },
  
  clearSessionRecords: () => {
    set({ sessionRecords: [] });
    saveRecordsToStorage([]);
    get().addToast('success', '所有记录已清空');
  },
}));
