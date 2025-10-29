export type Theme = 'light' | 'dark';
export type ViewMode = 'grid' | 'list' | 'compact';
export type TimeFilter = 'today' | 'yesterday' | '7d' | 'all';

export interface Article {
  id: string;
  title: string;
  source: string;
  publicationDate: string; // ISO 8601 string
  summary: string;
  link: string;
  imageUrl: string;
  needsScraping?: boolean;
  language: 'de' | 'en';
}

export interface CachedNews {
  articles: Article[];
  timestamp: number;
}
