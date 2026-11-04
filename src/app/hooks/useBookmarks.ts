import { bookmarkStore, bookmarkUiStore } from '@/core/bookmarks/bookmarkStore';
import { useStore } from './useStore';

export const useBookmarks = () => useStore(bookmarkStore);
export const useCollapsedSections = () => useStore(bookmarkUiStore).collapsed;
