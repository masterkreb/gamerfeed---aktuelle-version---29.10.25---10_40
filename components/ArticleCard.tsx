import React, { useState, useRef, useEffect, useCallback, memo, forwardRef } from 'react';
import type { Article, ViewMode } from '../types';
import { StarIcon, MoreIcon, CopyIcon, BanIcon, ShareIcon, ArrowLeftIcon, TwitterIcon, FacebookIcon, RedditIcon, WhatsAppIcon, EmailIcon } from './Icons';


interface ArticleCardProps {
    article: Article;
    viewMode: ViewMode;
    isFavorite: boolean;
    onToggleFavorite: (id: string) => void;
    onMuteSource: (source: string) => void;
}


const formatPublicationDate = (date: string): string => {
    const articleDate = new Date(date);
    const now = new Date();
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const articleDay = new Date(articleDate.getFullYear(), articleDate.getMonth(), articleDate.getDate());

    const timeString = articleDate.toLocaleTimeString(navigator.language, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    
    if (articleDay.getTime() === today.getTime()) {
        return `Today at ${timeString}`;
    }

    if (articleDay.getTime() === yesterday.getTime()) {
        return `Yesterday at ${timeString}`;
    }

    // Default for older dates
    return articleDate.toLocaleDateString(navigator.language, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};


const LanguageTag: React.FC<{ language: 'de' | 'en' }> = ({ language }) => (
    <span className="uppercase text-xs font-bold px-2 py-1 rounded bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
    {language}
  </span>
);

interface MoreOptionsMenuProps {
    title: string;
    source: string;
    link: string;
    onMuteSource: (source: string) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    buttonClassName?: string;
}

const MoreOptionsMenu: React.FC<MoreOptionsMenuProps> = ({ title, source, link, onMuteSource, isOpen, setIsOpen, buttonClassName }) => {
    const [menuView, setMenuView] = useState<'main' | 'share'>('main');
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
    const [startAnimation, setStartAnimation] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const closeMenu = useCallback(() => {
        setIsOpen(false);
    }, [setIsOpen]);

    // This handles the animation timing to fix the "flying in" bug.
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                setStartAnimation(true);
            }, 10); // A tiny delay allows the element to be positioned before animating.
            return () => clearTimeout(timer);
        } else {
            setStartAnimation(false);
        }
    }, [isOpen]);

    // This handles resetting internal state after the menu is closed.
    useEffect(() => {
        if (!isOpen) {
            const timer = setTimeout(() => {
                setCopyStatus('idle');
                setMenuView('main');
            }, 200); // Reset state after close animation (duration-300)
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleShare = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const shareData = { title, text: title, url: link };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                closeMenu();
            } catch (err) {
                console.error("Share failed:", err);
            }
        } else {
            setMenuView('share');
        }
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (copyStatus === 'copied') return;
        navigator.clipboard.writeText(link).then(() => {
            setCopyStatus('copied');
        });
    };

    const handleMute = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onMuteSource(source);
        closeMenu();
    };

    const encodedLink = encodeURIComponent(link);
    const encodedTitle = encodeURIComponent(title);

    const shareOptions = [
        { name: 'X', icon: <TwitterIcon className="w-5 h-5"/>, url: `https://x.com/intent/post?url=${encodedLink}&text=${encodedTitle}` },
        { name: 'Facebook', icon: <FacebookIcon className="w-5 h-5"/>, url: `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}` },
        { name: 'Reddit', icon: <RedditIcon className="w-5 h-5"/>, url: `https://www.reddit.com/submit?url=${encodedLink}&title=${encodedTitle}` },
        { name: 'WhatsApp', icon: <WhatsAppIcon className="w-5 h-5"/>, url: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedLink}` },
        { name: 'Email', icon: <EmailIcon className="w-5 h-5"/>, url: `mailto:?subject=${encodedTitle}&body=${encodedLink}` },
    ];


    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50" // Mobile and desktop backdrop
                    aria-hidden="true"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeMenu();
                    }}
                />
            )}
            <div ref={menuRef} className="relative">
                <button
                    ref={triggerRef}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
                    className={`${buttonClassName || "p-2 rounded-full transition-colors duration-200 text-slate-400 bg-black/30 hover:text-white"} ${isOpen ? 'z-50' : ''}`}
                    aria-label="More options"
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                >
                    <MoreIcon className="w-5 h-5" />
                </button>
                <div
                    className={`
                        fixed bottom-0 left-0 right-0 z-50
                        md:absolute md:top-full md:right-0 md:bottom-auto md:left-auto
                        md:mt-2 md:w-56
                        transition-all ease-in-out
                        duration-300 md:duration-150 
                        
                        ${startAnimation ? 'translate-y-0' : 'translate-y-full'}
                        md:origin-top-right md:transform-none 
                        ${startAnimation ? 'md:opacity-100 md:scale-100' : 'md:opacity-0 md:scale-95'}
                        ${!isOpen ? 'pointer-events-none' : ''}
                    `}
                >
                    <div
                        className="
                            bg-white dark:bg-zinc-800 rounded-t-2xl
                            md:dark:bg-zinc-700 md:rounded-lg md:shadow-xl
                            md:ring-1 md:ring-black md:ring-opacity-5
                            pb-[env(safe-area-inset-bottom)] md:pb-0
                        "
                    >
                        {/* Mobile-only header for the bottom sheet */}
                        <div className="md:hidden text-center text-sm font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-700 py-3">
                            Article Options
                        </div>

                        <div className="relative overflow-hidden">
                            {/* Main Menu */}
                            <div className={`transition-all duration-300 ease-in-out ${menuView === 'main' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute pointer-events-none'}`}>
                                <div className="divide-y divide-slate-200 dark:divide-zinc-600">
                                    <div className="p-2 md:p-1">
                                        <button onClick={handleShare} className="w-full flex items-center gap-3 text-left px-3 py-3 text-base md:text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-zinc-600 dark:hover:text-white rounded-md transition-colors">
                                            <ShareIcon className="w-5 h-5 md:w-4 md:h-4" /> Share
                                        </button>
                                    </div>
                                    <div className="p-2 md:p-1">
                                        <button onClick={handleCopy} disabled={copyStatus === 'copied'} className="w-full flex items-center gap-3 text-left px-3 py-3 text-base md:text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-zinc-600 dark:hover:text-white rounded-md transition-colors disabled:opacity-75">
                                            <CopyIcon className="w-5 h-5 md:w-4 md:h-4" /> {copyStatus === 'copied' ? 'Copied!' : 'Copy Link'}
                                        </button>
                                    </div>
                                    <div className="p-2 md:p-1">
                                        <button onClick={handleMute} className="w-full flex items-center gap-3 text-left px-3 py-3 text-base md:text-sm text-slate-700 dark:text-zinc-300 hover:text-white hover:bg-red-500 dark:hover:text-white dark:hover:bg-red-600 rounded-md transition-colors">
                                            <BanIcon className="w-5 h-5 md:w-4 md:h-4" /> Mute {source}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Share Submenu */}
                            <div className={`transition-all duration-300 ease-in-out ${menuView === 'share' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 absolute top-0 pointer-events-none'}`}>
                                <div className="divide-y divide-slate-200 dark:divide-zinc-600">
                                    <div className="p-2 md:p-1">
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuView('main'); }} className="w-full flex items-center gap-3 text-left px-3 py-3 text-base md:text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-zinc-600 dark:hover:text-white rounded-md transition-colors">
                                            <ArrowLeftIcon className="w-5 h-5 md:w-4 md:h-4" /> Back
                                        </button>
                                    </div>
                                    {shareOptions.map(opt => (
                                        <div className="p-2 md:p-1" key={opt.name}>
                                            <a href={opt.url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 text-left px-3 py-3 text-base md:text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-zinc-600 dark:hover:text-white rounded-md transition-colors">
                                                <span className="w-5 flex justify-center md:w-4">{opt.icon}</span> {opt.name}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};


const ArticleCardComponent = forwardRef<HTMLElement, ArticleCardProps>(({ article, viewMode, isFavorite, onToggleFavorite, onMuteSource }, ref) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [allowCardOverflow, setAllowCardOverflow] = useState(false);
    const menuTimerRef = useRef<number | null>(null);
    const [isAnimatingFavorite, setIsAnimatingFavorite] = useState(false);
    const prevIsFavorite = useRef(isFavorite);

    useEffect(() => {
        // When the menu is open, prevent the body from scrolling to maintain focus.
        if (isMenuOpen) {
            document.body.classList.add('body-no-scroll');
        } else {
            // When the menu is closed, restore scrolling.
            document.body.classList.remove('body-no-scroll');
        }

        // Cleanup: Ensure scrolling is re-enabled if the component unmounts while the menu is open.
        return () => {
            document.body.classList.remove('body-no-scroll');
        };
    }, [isMenuOpen]);

    useEffect(() => {
        // Only animate when the status changes from not favorite to favorite
        if (isFavorite && !prevIsFavorite.current) {
            setIsAnimatingFavorite(true);
            const timer = setTimeout(() => setIsAnimatingFavorite(false), 300); // Duration of the animation
            return () => clearTimeout(timer);
        }
        prevIsFavorite.current = isFavorite;
    }, [isFavorite]);


    const cardBaseClasses = "bg-white dark:bg-zinc-800 rounded-xl shadow-md hover:shadow-xl border border-slate-200 dark:border-zinc-700";

    const handleSetIsMenuOpen = useCallback((open: boolean) => {
        if (menuTimerRef.current) {
            clearTimeout(menuTimerRef.current);
            menuTimerRef.current = null;
        }

        if (open) {
            setAllowCardOverflow(true);
            setIsMenuOpen(true);
        } else {
            setIsMenuOpen(false); // Start menu closing animation
            menuTimerRef.current = window.setTimeout(() => {
                setAllowCardOverflow(false);
            }, 300);
        }
    }, []);
    
    if (viewMode === 'grid') {
        const favoriteActiveClass = 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 dark:bg-yellow-500 dark:text-yellow-950 dark:hover:bg-yellow-400';
        const favoriteInactiveClass = 'bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-yellow-400 hover:bg-slate-200 dark:hover:bg-zinc-600';
        const moreButtonClass = "p-3 rounded-full transition-all duration-200 bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-600";
        
        return (
            <a ref={ref as React.ForwardedRef<HTMLAnchorElement>} href={article.link} target="_blank" rel="noopener noreferrer" className={`group ${cardBaseClasses} flex flex-col relative ${allowCardOverflow ? '!overflow-visible z-30' : 'overflow-hidden'} transition-shadow duration-300`}>
                <div className="relative overflow-hidden rounded-t-xl backface-hidden will-change-transform">
                    <img src={article.imageUrl} alt={article.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500 transform-gpu" loading="lazy" decoding="async" />
                    <div className="absolute top-3 left-3">
                        <LanguageTag language={article.language} />
                    </div>
                    <div className="absolute bottom-0 left-0 bg-indigo-500 text-white px-2 py-1 text-xs font-bold rounded-tr-lg">{article.source}</div>
                </div>
                <div className="p-4 flex flex-col flex-grow">
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">{article.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 flex-grow line-clamp-3">{article.summary}</p>
                    <div className="mt-auto pt-4 flex justify-between items-center">
                        <p className="text-sm text-slate-500 dark:text-zinc-400">{formatPublicationDate(article.publicationDate)}</p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={(e) => { e.preventDefault(); onToggleFavorite(article.id); }}
                                className={`p-3 rounded-full transition-all duration-200 ${isFavorite ? favoriteActiveClass : favoriteInactiveClass}`}
                                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <StarIcon className={`w-5 h-5 ${isAnimatingFavorite ? 'animate-pop-in' : ''}`} />
                            </button>
                            <MoreOptionsMenu 
                                title={article.title}
                                source={article.source} 
                                link={article.link}
                                onMuteSource={onMuteSource} 
                                isOpen={isMenuOpen}
                                setIsOpen={handleSetIsMenuOpen}
                                buttonClassName={moreButtonClass} 
                            />
                        </div>
                    </div>
                </div>
            </a>
        );
    }

    if (viewMode === 'list') {
        const favoriteActiveClass = 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 dark:bg-yellow-500 dark:text-yellow-950 dark:hover:bg-yellow-400';
        const favoriteInactiveClass = 'bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-yellow-400 hover:bg-slate-200 dark:hover:bg-zinc-600';
        const moreButtonClass = "p-3 rounded-full transition-all duration-200 bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-600";
        return (
            <a
                ref={ref as React.ForwardedRef<HTMLAnchorElement>}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`group ${cardBaseClasses} flex flex-col md:flex-row items-center relative ${allowCardOverflow ? '!overflow-visible z-30' : 'overflow-hidden'} transition-shadow duration-300`}
            >
                <div className="relative w-full md:w-1/4 lg:w-1/5 h-44 flex-shrink-0 rounded-t-xl md:rounded-l-xl md:rounded-r-none overflow-hidden backface-hidden will-change-transform">
                    <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 transform-gpu"
                        loading="lazy"
                        decoding="async"
                    />
                </div>
                <div className="p-4 flex-grow w-full md:w-3/4 lg:w-4/5 flex flex-col">
                    <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-2 py-1 text-xs font-bold rounded flex-shrink-0">
                {article.source}
              </span>
                            <LanguageTag language={article.language} />
                        </div>
                         <div className="flex items-center gap-1">
                            <button
                                onClick={(e) => { e.preventDefault(); onToggleFavorite(article.id); }}
                                className={`p-3 rounded-full transition-all duration-200 ${isFavorite ? favoriteActiveClass : favoriteInactiveClass}`}
                                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <StarIcon className={`w-5 h-5 ${isAnimatingFavorite ? 'animate-pop-in' : ''}`} />
                            </button>
                            <MoreOptionsMenu 
                                title={article.title}
                                source={article.source} 
                                link={article.link}
                                onMuteSource={onMuteSource} 
                                isOpen={isMenuOpen}
                                setIsOpen={handleSetIsMenuOpen}
                                buttonClassName={moreButtonClass} 
                            />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                        {article.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 line-clamp-2 flex-grow">
                        {article.summary}
                    </p>
                    <div className="mt-auto pt-2">
                         <span className="text-sm text-slate-500 dark:text-zinc-400 flex-shrink-0">
                           {formatPublicationDate(article.publicationDate)}
                        </span>
                    </div>
                </div>
            </a>
        );
    }

    if (viewMode === 'compact') {
        const favoriteActiveClass = 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 dark:bg-yellow-500 dark:text-yellow-950 dark:hover:bg-yellow-400';
        const favoriteInactiveClass = 'text-slate-400 hover:text-yellow-400 hover:bg-slate-200 dark:hover:bg-zinc-700';
        const moreButtonClass = 'p-3 rounded-full transition-all duration-200 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700';

        return (
            <a
                ref={ref as React.ForwardedRef<HTMLAnchorElement>}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`group ${cardBaseClasses} p-3 flex items-center justify-between gap-4 even:bg-slate-100 dark:even:bg-zinc-900/20 relative ${allowCardOverflow ? '!overflow-visible z-30' : ''} transition-shadow duration-200`}
            >
                <div className="flex-grow overflow-hidden">
                    <h3 className="text-md font-semibold line-clamp-3 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                        {article.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        <span className="font-medium text-slate-700 dark:text-zinc-300 flex-shrink-0">{formatPublicationDate(article.publicationDate)}</span>
                        <span className="text-slate-500 dark:text-zinc-400">·</span>
                        <span className="truncate">{article.source}</span>
                        <span className="text-slate-500 dark:text-zinc-400">·</span>
                        <span className="uppercase">{article.language}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onToggleFavorite(article.id);
                        }}
                        className={`p-3 rounded-full transition-all duration-200 ${isFavorite ? favoriteActiveClass : favoriteInactiveClass}`}
                        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        <StarIcon className={`w-5 h-5 ${isAnimatingFavorite ? 'animate-pop-in' : ''}`} />
                    </button>
                    <MoreOptionsMenu 
                        title={article.title}
                        source={article.source} 
                        link={article.link}
                        onMuteSource={onMuteSource} 
                        isOpen={isMenuOpen}
                        setIsOpen={handleSetIsMenuOpen}
                        buttonClassName={moreButtonClass}
                    />
                </div>
            </a>
        );
    }

    return null;
});

ArticleCardComponent.displayName = 'ArticleCard';

const propsAreEqual = (prevProps: Readonly<ArticleCardProps>, nextProps: Readonly<ArticleCardProps>) => {
  // This custom comparison function is a performance optimization.
  // It prevents a card from re-rendering if its props have not meaningfully changed.
  // For example, when another card is favorited, the `onToggleFavorite` function prop
  // changes for all cards. Without this, every card would re-render.
  // Here, we only check for changes that affect this specific card's appearance.
  return (
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.article.id === nextProps.article.id &&
    prevProps.article.imageUrl === nextProps.article.imageUrl &&
    prevProps.article.title === nextProps.article.title
  );
};

// FIX: Cast memoized component to retain forwardRef typing.
// This corrects a TypeScript error where the `ref` prop was not recognized on the memoized component.
export const ArticleCard = memo(ArticleCardComponent, propsAreEqual) as typeof ArticleCardComponent;