

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { ArticleCard } from './components/ArticleCard';
import { getPrimaryNewsArticles, getSecondaryNewsArticles, getOgImageFromUrl } from './services/newsService';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { Article, Theme, ViewMode, CachedNews } from './types';
import { LoadingSpinner, SearchIcon, FilterIcon, ResetIcon } from './components/Icons';
import { FilterProvider, useFilter } from './contexts/FilterContext';
import { Footer } from './components/Footer';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { FavoritesHeader } from './components/FavoritesHeader';
import { SettingsModal } from './components/SettingsModal';

const ARTICLES_PER_PAGE = 32;

type ToastType = 'info' | 'success';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    actions: ToastAction[];
    isExiting: boolean;
    isEntering: boolean;
}

const SearchResultsHeader: React.FC<{
  searchQuery: string;
  resultsCount: number;
  onClear: () => void;
  isSearchingFavorites: boolean;
}> = ({ searchQuery, resultsCount, onClear, isSearchingFavorites }) => {
    const themeClasses = isSearchingFavorites ? {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        border: 'border-amber-500',
        icon: 'text-amber-500',
        title: 'text-amber-800 dark:text-amber-200',
        text: 'text-amber-700 dark:text-amber-300',
        buttonHover: 'hover:text-amber-600 dark:hover:text-amber-100',
    } : {
        bg: 'bg-indigo-100 dark:bg-indigo-900/30',
        border: 'border-indigo-500',
        icon: 'text-indigo-500',
        title: 'text-indigo-800 dark:text-indigo-200',
        text: 'text-indigo-700 dark:text-indigo-300',
        buttonHover: 'hover:text-indigo-600 dark:hover:text-indigo-100',
    };

    const titleText = isSearchingFavorites ? "Searching in Favorites" : "Search Results";
    const resultText = `Showing ${resultsCount} ${resultsCount === 1 ? 'article' : 'articles'} for: `;
    const scopeText = isSearchingFavorites ? ' in your favorites' : '';

    return (
        <div className={`mt-6 p-4 ${themeClasses.bg} border-l-4 ${themeClasses.border} rounded-r-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 animate-fade-in`}>
            <div className="flex items-center gap-3">
                <SearchIcon className={`w-6 h-6 ${themeClasses.icon}`} />
                <div>
                    <h2 className={`text-lg font-semibold ${themeClasses.title}`}>
                        {titleText}
                    </h2>
                    <p className={`text-sm ${themeClasses.text}`}>
                        {resultText}
                        <span className="font-bold">"{searchQuery}"</span>
                        {scopeText}
                    </p>
                </div>
            </div>
            <button
                onClick={onClear}
                className={`font-semibold underline text-sm ${themeClasses.text} ${themeClasses.buttonHover} transition-colors sm:ml-auto`}
            >
                Clear Search
            </button>
        </div>
    );
};


const AppContent: React.FC = () => {
    const [theme, setTheme] = useLocalStorage<Theme>('theme', 'dark');
    const [viewMode, setViewMode] = useLocalStorage<ViewMode>('viewMode', 'grid');
    const [favorites, setFavorites] = useLocalStorage<string[]>('favorites', []);
    const [mutedSources, setMutedSources] = useLocalStorage<string[]>('mutedSources', []);

    const [articles, setArticles] = useState<Article[]>([]);
    const [isBlockingLoading, setIsBlockingLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [isScraping, setIsScraping] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const [allSources, setAllSources] = useState<{ name: string; language: 'de' | 'en' }[]>([]);
    const [scrapingProgress, setScrapingProgress] = useState<number>(0);

    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [toast, setToast] = useState<Toast | null>(null);
    const toastTimerRef = useRef<number | null>(null);

    const isInitialLoad = useRef(true);
    const articlesRef = useRef(articles);
    articlesRef.current = articles;

    const CACHE_KEY = 'gaming_news_cache';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const updateArticlesAndCache = useCallback((newArticles: Article[]) => {
        // Prune articles older than 7 days
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        // Deduplicate articles before processing
        const articleMap = new Map();
        newArticles.forEach(a => articleMap.set(a.id, a));
        const deduplicatedArticles = Array.from(articleMap.values());

        const finalArticles = deduplicatedArticles
            .filter(article => new Date(article.publicationDate).getTime() >= sevenDaysAgo)
            .sort((a, b) => new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime());

        localStorage.setItem(CACHE_KEY, JSON.stringify({
            articles: finalArticles,
            timestamp: Date.now()
        }));

        const availableArticleIds = new Set(finalArticles.map(a => a.id));
        setFavorites(prevFavorites => prevFavorites.filter(favId => availableArticleIds.has(favId)));

        setArticles(finalArticles);

        const sourceMap = new Map<string, 'de' | 'en'>();
        finalArticles.forEach(article => {
            if (!sourceMap.has(article.source)) {
                sourceMap.set(article.source, article.language);
            }
        });
        const uniqueSources = Array.from(sourceMap.entries()).map(([name, language]) => ({ name, language }));
        setAllSources(uniqueSources);

    }, [setFavorites]);

    const runImageScraper = useCallback(async (articlesToCheck: Article[]) => {
        const articlesToScrape = articlesToCheck.filter(a => a.needsScraping || a.imageUrl.includes('placehold.co'));
        if (articlesToScrape.length === 0) return;

        setIsScraping(true);
        setScrapingProgress(0);
        try {
            const BATCH_SIZE = 3;
            for (let i = 0; i < articlesToScrape.length; i += BATCH_SIZE) {
                const batch = articlesToScrape.slice(i, i + BATCH_SIZE);
                await Promise.allSettled(
                    batch.map(async article => {
                        const scrapedUrl = await getOgImageFromUrl(article.link);
                        setArticles(prevArticles =>
                            prevArticles.map(prevArticle =>
                                prevArticle.id === article.id
                                    ? { ...prevArticle, imageUrl: scrapedUrl || prevArticle.imageUrl, needsScraping: false }
                                    : prevArticle
                            )
                        );
                    })
                );
                const progress = Math.min(100, Math.round(((i + batch.length) / articlesToScrape.length) * 100));
                setScrapingProgress(progress);
                if (i + BATCH_SIZE < articlesToScrape.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } finally {
            setTimeout(() => {
                setScrapingProgress(0);
                setIsScraping(false);
            }, 1500);
        }
    }, []);

    const loadNews = useCallback(async (isManualRefresh = false) => {
        setError(null);

        let isCurrentlyBlocking = false;

        let cachedData: CachedNews | null = null;
        const cachedJSON = localStorage.getItem(CACHE_KEY);
        if (cachedJSON) {
            try {
                cachedData = JSON.parse(cachedJSON);
            } catch (e) {
                console.error("Failed to parse cache", e);
                localStorage.removeItem(CACHE_KEY);
            }
        }

        const isCacheStale = !cachedData || (Date.now() - cachedData.timestamp) > CACHE_DURATION;

        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            if (cachedData && !isCacheStale) {
                // Fresh cache exists: load it immediately, don't block, and proceed to a background refresh.
                updateArticlesAndCache(cachedData.articles);
                runImageScraper(cachedData.articles);
                setIsBlockingLoading(false);
            } else {
                // Stale or no cache: set blocking to true for the initial fetch.
                isCurrentlyBlocking = true;
                // The default state is already blocking, so no need to set it again.
            }
        }

        if (!isManualRefresh && !isCacheStale) {
            return; // We loaded from a fresh cache and it's not a manual refresh, so we're done.
        }

        // Perform live fetch
        if (!isCurrentlyBlocking) {
            setIsRefreshing(true);
        }
        try {
            const [primary, secondary] = await Promise.all([
                getPrimaryNewsArticles(),
                getSecondaryNewsArticles(),
            ]);

            const newlyFetchedArticles = [...primary, ...secondary];
            const articlesToProcess = isCurrentlyBlocking ? newlyFetchedArticles : [...articlesRef.current, ...newlyFetchedArticles];

            updateArticlesAndCache(articlesToProcess);
            runImageScraper(newlyFetchedArticles);

        } catch (error) {
            console.error("Failed to fetch articles:", error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";

            // If the blocking initial fetch failed, try the static cache as a fallback.
            if (isCurrentlyBlocking) {
                try {
                    const response = await fetch('/news-cache.json');
                    if (response.ok) {
                        const fallbackArticles: Article[] = await response.json();
                        updateArticlesAndCache(fallbackArticles);
                        runImageScraper(fallbackArticles);
                    } else {
                        setError(message);
                    }
                } catch (e) {
                    console.warn("Could not load static news cache.", e);
                    setError(message);
                }
            } else if (articlesRef.current.length === 0) {
                setError(message);
            }
        } finally {
            setIsRefreshing(false);
            if (isCurrentlyBlocking) {
                setIsBlockingLoading(false);
            }
        }
    }, [updateArticlesAndCache, runImageScraper]);

    useEffect(() => {
        loadNews();
    }, [loadNews]);
    
    const showToast = useCallback((message: string, type: ToastType, actions: ToastAction[] = []) => {
        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }

        const newToastId = Date.now();
        setToast({
            id: newToastId,
            message,
            type,
            actions,
            isExiting: false,
            isEntering: true,
        });

        setTimeout(() => {
            setToast(prev => prev ? { ...prev, isEntering: false } : null);
        }, 10);

        toastTimerRef.current = window.setTimeout(() => {
            setToast(prev => prev ? { ...prev, isExiting: true } : null);
            toastTimerRef.current = window.setTimeout(() => {
                setToast(null);
                toastTimerRef.current = null;
            }, 600);
        }, 5000);
    }, []);

    const handleMuteSource = useCallback((source: string) => {
        setMutedSources(prev => [...prev, source]);
        
        showToast(
            `"${source}" has been muted. Manage in Settings (⚙️).`,
            'info',
            [{
                label: 'Undo',
                onClick: () => {
                    setMutedSources(prev => prev.filter(s => s !== source));
                    setToast(null);
                }
            }]
        );
    }, [setMutedSources, showToast]);

    const handleToggleFavorite = useCallback((id: string) => {
        const isCurrentlyFavorite = favorites.includes(id);

        setFavorites(prev =>
            isCurrentlyFavorite ? prev.filter(favId => favId !== id) : [...prev, id]
        );
        
        if (!isCurrentlyFavorite) {
            const actions: ToastAction[] = [
                {
                    label: 'Undo',
                    onClick: () => {
                        setFavorites(prev => prev.filter(favId => favId !== id));
                        setToast(null); 
                    },
                }
            ];
            showToast('Article added to favorites.', 'success', actions);
        }
    }, [favorites, setFavorites, showToast]);


    const handleRefresh = useCallback(() => {
        loadNews(true);
        const articlesWithPlaceholders = articlesRef.current.filter(a =>
            a.imageUrl.includes('placehold.co')
        );
        if (articlesWithPlaceholders.length > 0) {
            runImageScraper(articlesWithPlaceholders);
        }
    }, [loadNews, runImageScraper]);

    const {
        timeFilter,
        sourceFilter,
        languageFilter,
        showFavoritesOnly,
        setShowFavoritesOnly,
        searchQuery,
        setSearchQuery,
        onResetFilters,
    } = useFilter();

    const handleResetApp = useCallback(() => {
        onResetFilters();
        setShowFavoritesOnly(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [onResetFilters, setShowFavoritesOnly]);


    const filteredArticles = useMemo(() => {
        let result = articles;

        // When viewing favorites, muted sources should still be shown.
        // The mute filter only applies to the general feed.
        if (!showFavoritesOnly) {
            result = result.filter(article => !mutedSources.includes(article.source));
        }

        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            result = result.filter(article =>
                article.title.toLowerCase().includes(lowercasedQuery) ||
                article.summary.toLowerCase().includes(lowercasedQuery)
            );
        }

        if (showFavoritesOnly) {
            result = result.filter(article => favorites.includes(article.id));
        }

        if (sourceFilter !== 'all') {
            result = result.filter(article => article.source === sourceFilter);
        }

        if (languageFilter !== 'all') {
            result = result.filter(article => article.language === languageFilter);
        }

        if (timeFilter !== 'all') {
            const now = new Date();
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            if (timeFilter === 'today') {
                result = result.filter(article => new Date(article.publicationDate) >= todayStart);
            } else if (timeFilter === 'yesterday') {
                const yesterdayStart = new Date(todayStart);
                yesterdayStart.setDate(todayStart.getDate() - 1);

                result = result.filter(article => {
                    const articleDate = new Date(article.publicationDate);
                    return articleDate >= yesterdayStart && articleDate < todayStart;
                });
            } else if (timeFilter === '7d') {
                const hours = 7 * 24;
                const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
                result = result.filter(article => new Date(article.publicationDate) >= cutoff);
            }
        }

        return result;
    }, [
        articles, showFavoritesOnly, sourceFilter, timeFilter, favorites, languageFilter,
        searchQuery, mutedSources
    ]);

    const availableFavoritesCount = useMemo(() => {
        if (!articles.length || !favorites.length) {
            return 0;
        }
        const articleIds = new Set(articles.map(a => a.id));
        return favorites.filter(favId => articleIds.has(favId)).length;
    }, [articles, favorites]);

    const filterKey = useMemo(() => JSON.stringify({
        searchQuery,
        showFavoritesOnly,
        sourceFilter,
        languageFilter,
        timeFilter,
        favorites: showFavoritesOnly ? favorites : [],
    }), [searchQuery, showFavoritesOnly, sourceFilter, languageFilter, timeFilter, favorites]);

    useEffect(() => {
        setPage(1);
        window.scrollTo(0, 0);
    }, [filterKey]);

    const articlesToShow = useMemo(() => {
        return filteredArticles.slice(0, page * ARTICLES_PER_PAGE);
    }, [filteredArticles, page]);

    const availableSources = useMemo(() => {
        return allSources.filter(s => !mutedSources.includes(s.name));
    }, [allSources, mutedSources]);
    
    const viewClasses = {
        grid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6',
        list: 'flex flex-col gap-6',
        compact: 'flex flex-col gap-2',
    };
    
    const toastStyles: Record<ToastType, { bg: string, text: string, border: string, buttonHover: string }> = {
      info: {
        bg: 'bg-slate-800',
        text: 'text-white',
        border: 'border-slate-700',
        buttonHover: 'hover:bg-slate-700/50',
      },
      success: {
        bg: 'bg-yellow-400 dark:bg-yellow-500',
        text: 'text-yellow-900 dark:text-yellow-950',
        border: 'border-yellow-500/50 dark:border-yellow-600/50',
        buttonHover: 'hover:bg-yellow-500/50 dark:hover:bg-yellow-600/50',
      },
    };

    const EmptyState = () => {
        const areFiltersActive = timeFilter !== 'all' || sourceFilter !== 'all' || languageFilter !== 'all' || showFavoritesOnly;

        if (searchQuery) {
            return (
                <div className="col-span-full text-center text-slate-500 dark:text-slate-400 py-16">
                    <SearchIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <h3 className="text-2xl font-semibold">No articles found for "{searchQuery}"</h3>
                    <p className="mt-2">Try checking your spelling or using different keywords.</p>
                </div>
            );
        }

        if (areFiltersActive) {
            return (
                <div className="col-span-full text-center text-slate-500 dark:text-slate-400 py-16">
                    <FilterIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <h3 className="text-2xl font-semibold">No Articles Match Your Filters</h3>
                    <p className="mt-2">Try removing some filters to see more results.</p>
                    <button
                        onClick={onResetFilters}
                        className="mt-6 inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 transition-colors"
                    >
                        <ResetIcon className="w-5 h-5" />
                        Reset Filters
                    </button>
                </div>
            );
        }
        
        return (
            <div className="col-span-full text-center text-slate-500 dark:text-slate-400 py-16">
                <h3 className="text-2xl font-semibold">No Articles Found</h3>
                <p className="mt-2">There are currently no articles to display. Please check back later.</p>
            </div>
        );
    };


    return (
        <div className="min-h-screen text-slate-800 dark:text-slate-200 transition-colors duration-300 flex flex-col">
            <Header
                theme={theme}
                setTheme={setTheme}
                viewMode={viewMode}
                setViewMode={setViewMode}
                isRefreshing={isRefreshing || isScraping}
                onRefresh={handleRefresh}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onLogoClick={handleResetApp}
            />
            <main className="container mx-auto p-4 md:p-6 flex-grow">
                <FilterBar
                    sources={availableSources}
                    favoritesCount={availableFavoritesCount}
                    allArticles={articles}
                    favoriteIds={favorites}
                    mutedSources={mutedSources}
                />

                {showFavoritesOnly && !searchQuery && (
                    <FavoritesHeader
                        totalFavorites={availableFavoritesCount}
                        filteredFavoritesCount={filteredArticles.length}
                        onResetFilters={onResetFilters}
                        onExitFavorites={() => setShowFavoritesOnly(false)}
                    />
                )}
                
                {searchQuery && (
                    <SearchResultsHeader
                        searchQuery={searchQuery}
                        resultsCount={filteredArticles.length}
                        onClear={() => setSearchQuery('')}
                        isSearchingFavorites={showFavoritesOnly}
                    />
                )}


                {scrapingProgress > 0 && (
                    <div className="my-4">
                        <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Updating article images...</span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{scrapingProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                            <div
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${scrapingProgress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {isBlockingLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="text-center py-16">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50">
                            <svg className="h-6 w-6 text-red-600 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>
                        <h3 className="mt-4 text-2xl font-semibold text-red-600 dark:text-red-400">Could not load news</h3>
                        <p className="mt-2 text-slate-600 dark:text-slate-400">{error}</p>
                        <button
                            onClick={() => loadNews(true)}
                            className="mt-6 inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                    <>
                        <div key={filterKey} className={`mt-8 ${viewClasses[viewMode]} animate-fade-in`}>
                            {articlesToShow.length > 0 ? (
                                articlesToShow.map(article => (
                                    <ArticleCard
                                        key={article.id}
                                        article={article}
                                        viewMode={viewMode}
                                        isFavorite={favorites.includes(article.id)}
                                        onToggleFavorite={handleToggleFavorite}
                                        onMuteSource={handleMuteSource}
                                    />
                                ))
                            ) : (
                                showFavoritesOnly && !searchQuery ? (
                                    // The FavoritesHeader provides all necessary context/messages when in favorites view.
                                    null
                                ) : (
                                   <EmptyState />
                                )
                            )}
                        </div>

                        {articlesToShow.length < filteredArticles.length && (
                            <div className="mt-10 text-center">
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900"
                                >
                                    Load More Articles
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
            <Footer />
            <ScrollToTopButton />
            <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                allSources={allSources}
                mutedSources={mutedSources}
                setMutedSources={setMutedSources}
            />
            {toast && (
                <div
                    key={toast.id}
                    className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 rounded-xl shadow-lg flex items-stretch w-11/12 max-w-2xl overflow-hidden transition-all duration-600 ease-in-out ${toastStyles[toast.type].bg} ${toastStyles[toast.type].text} ${
                        toast.isExiting
                            ? 'opacity-0 scale-95'
                            : toast.isEntering
                                ? 'opacity-0 scale-95'
                                : 'opacity-100 scale-100'
                    }`}
                >
                    <p className="py-4 px-6 flex-grow">{toast.message}</p>
                    {toast.actions.length > 0 && (
                        <div className={`border-l ${toastStyles[toast.type].border} flex-shrink-0 flex items-stretch`}>
                            {toast.actions.map((action, index) => (
                                <button
                                    key={action.label}
                                    onClick={action.onClick}
                                    className={`font-bold px-6 h-full ${toastStyles[toast.type].buttonHover} transition-colors ${ index > 0 ? `border-l ${toastStyles[toast.type].border}` : ''}`}
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const App: React.FC = () => {
    return (
        <FilterProvider>
            <AppContent />
        </FilterProvider>
    );
};

export default App;