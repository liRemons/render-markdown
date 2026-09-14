import { useState, useRef, useEffect } from 'react';
import { RightOutlined, DownOutlined, SearchOutlined, CloseOutlined } from '@ant-design/icons';
import styles from './index.module.less';

export interface AnchorItem {
  href: string;
  title: string;
  children: AnchorItem[];
  nodeName: string;
  nodeTitle: string;
}

interface TocItemProps {
  item: AnchorItem;
  depth?: number;
  activeId: string;
  searchText?: string;
}

function TocItem({ item, depth = 0, activeId, searchText }: TocItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.href === activeId;
  const itemRef = useRef<HTMLDivElement>(null);

  // 递归过滤子节点
  const filteredChildren = hasChildren
    ? filterAnchors(item.children, searchText)
    : [];

  // 如果有限制搜索且无匹配子节点，则不渲染
  if (searchText && !filteredChildren.length && !matchText(item.title, searchText)) {
    return null;
  }

  useEffect(() => {
    if (activeId && hasChildren) {
      const hasActiveChild = item.children.some(c => c.href === activeId);
      if (hasActiveChild) {
        setExpanded(true);
      }
    }
  }, [activeId, hasChildren, item.children]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const id = item.href;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 高亮匹配文本
  const renderTitle = (text: string) => {
    if (!searchText) {
      return text;
    }
    const escaped = escapeRegex(searchText);
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase().includes(searchText.toLowerCase()) ? (
        <span key={i} className={styles.highlight}>{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <div className={styles.tocItem} ref={itemRef} style={{ paddingLeft: depth * 6 }}>
      <div className={`${styles.tocItemTitle}${isActive ? ` ${styles.active}` : ''}`}>
        {hasChildren && (
          <span
            className={styles.tocExpandIcon}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        )}
        <a className={styles.tocLink} href={`#${item.href}`} onClick={handleClick}>
          {renderTitle(item.title)}
        </a>
      </div>
      {hasChildren && expanded && (
        <div className={styles.tocChildren}>
          {searchText
            ? filteredChildren.map((child, index) => (
                <TocItem key={child.href || index} item={child} depth={depth + 1} activeId={activeId} searchText={searchText} />
              ))
            : item.children.map((child, index) => (
                <TocItem key={child.href || index} item={child} depth={depth + 1} activeId={activeId} searchText={searchText} />
              ))}
        </div>
      )}
    </div>
  );
}

// 转义正则特殊字符
function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 模糊匹配文本
function matchText(text: string, query: string) {
  if (!query) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

// 递归过滤锚点（包含子树匹配）
function filterAnchors(anchors: AnchorItem[], searchText?: string): AnchorItem[] {
  if (!searchText) return anchors;
  return anchors
    .map(anchor => {
      const childrenMatch = filterAnchors(anchor.children, searchText);
      const selfMatch = matchText(anchor.title, searchText);
      if (selfMatch || childrenMatch.length > 0) {
        return {
          ...anchor,
          children: selfMatch ? anchor.children : childrenMatch
        };
      }
      return null;
    })
    .filter(Boolean) as AnchorItem[];
}

interface TocSidebarProps {
  anchors: AnchorItem[];
  activeId: string;
  visible: boolean;
  onClose: () => void;
}

function TocSidebar({ anchors, activeId, visible, onClose }: TocSidebarProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!activeId || !bodyRef.current || !visible) return;
    const activeEl = bodyRef.current.querySelector(`.${styles.active}`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeId, visible]);

  // 点击搜索栏外部关闭
  useEffect(() => {
    if (!searching) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearching(false);
        setSearchText('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searching]);

  const handleSearchToggle = () => {
    setSearching(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSearchClear = () => {
    setSearchText('');
    setSearching(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const filteredAnchors = filterAnchors(anchors, searchText);

  if (!anchors || anchors.length === 0 || !visible) {
    return null;
  }

  return (
    <div className={styles.tocSidebar}>
      <div className={styles.tocHeader}>
        <span className={styles.tocTitle}>目录</span>
        <div className={styles.tocActions}>
          {!searching && (
            <span className={styles.tocSearchBtn} onClick={handleSearchToggle} title="搜索">
              <SearchOutlined />
            </span>
          )}
          <span className={styles.tocClose} onClick={onClose}>
            ×
          </span>
        </div>
      </div>
      {searching && (
        <div ref={searchRef} className={styles.tocSearchBar}>
          <input
            ref={inputRef}
            className={styles.tocSearchInput}
            type="text"
            placeholder="搜索目录…"
            value={searchText}
            onChange={handleInputChange}
          />
          {searchText && (
            <span className={styles.tocSearchClear} onClick={handleSearchClear}>
              <CloseOutlined />
            </span>
          )}
          <span className={styles.tocSearchExit} onClick={handleSearchClear} title="退出搜索">
            ×
          </span>
        </div>
      )}
      <div className={styles.tocBody} ref={bodyRef}>
        {filteredAnchors.length > 0
          ? filteredAnchors.map((item, index) => (
              <TocItem key={item.href || index} item={item} activeId={activeId} searchText={searchText} />
            ))
          : searchText && (
              <div className={styles.tocEmpty}>未找到匹配项</div>
            )}
      </div>
    </div>
  );
}

export default TocSidebar;
