import React from 'react';
import {
  BookCopy,
  BookOpen,
  BookmarkCheck,
  CheckCircle2,
  Heart,
  Archive,
  History,
  Settings,
  Plus,
  Globe
} from 'lucide-react';
import { BookStatus } from '../types';

export type LibraryFilter = 'all' | BookStatus | 'history';

interface SidebarProps {
  currentFilter: LibraryFilter;
  onSelectFilter: (filter: LibraryFilter) => void;
  counts: Record<string, number>;
  onOpenImport: () => void;
  onOpenBrowser: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentFilter,
  onSelectFilter,
  counts,
  onOpenImport,
  onOpenBrowser,
  onOpenSettings,
}) => {
  const navItems: Array<{ id: LibraryFilter; label: string; icon: React.ComponentType<{ className?: string }>; countKey: string }> = [
    { id: 'all', label: 'Tất cả', icon: BookCopy, countKey: 'all' },
    { id: 'reading', label: 'Đang đọc', icon: BookOpen, countKey: 'reading' },
    { id: 'unread', label: 'Chưa đọc', icon: BookmarkCheck, countKey: 'unread' },
    { id: 'completed', label: 'Đã hoàn thành', icon: CheckCircle2, countKey: 'completed' },
    { id: 'favorite', label: 'Yêu thích', icon: Heart, countKey: 'favorite' },
    { id: 'archived', label: 'Đã lưu trữ', icon: Archive, countKey: 'archived' },
    { id: 'history', label: 'Lịch sử', icon: History, countKey: 'history' },
  ];

  return (
    <aside className="w-56 bg-neutral-900 border-r border-neutral-800 flex flex-col justify-between shrink-0 select-none">
      {/* Top actions: Add book & Web Browser Mode */}
      <div className="p-3 border-b border-neutral-800 space-y-2">
        <button
          onClick={onOpenImport}
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium text-xs shadow-sm transition-all duration-150 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm truyện</span>
        </button>
        <button
          onClick={onOpenBrowser}
          className="w-full flex items-center justify-center space-x-2 py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/80 rounded-lg font-medium text-xs transition-all duration-150 cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>Trình duyệt Web</span>
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        <div className="px-3 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Thư viện
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentFilter === item.id;
          const count = counts[item.countKey] || 0;

          return (
            <button
              key={item.id}
              onClick={() => onSelectFilter(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-neutral-800 text-amber-400 font-semibold shadow-xs'
                  : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </div>
              {count > 0 && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-300 font-bold'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section: Settings & Storage indicator */}
      <div className="p-2 border-t border-neutral-800 space-y-1">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4 text-neutral-400" />
          <span>Cài đặt</span>
        </button>
      </div>
    </aside>
  );
};
