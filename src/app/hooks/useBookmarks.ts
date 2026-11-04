import { bookmarkStore } from '@/core/bookmarks/bookmarkStore';
import { useStore } from './useStore';

export const useBookmarks = () => useStore(bookmarkStore);
