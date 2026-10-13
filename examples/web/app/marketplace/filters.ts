import {
  type ListMarketplaceCardsV2Request,
  MarketplaceCardCategory,
  MarketplaceGradingCompany,
  MarketplaceLanguage,
  MarketplacePriceRange,
  MarketplaceSortOrder,
  MarketplaceV2Sort,
} from '@renaiss-protocol/client';

export const PAGE_SIZE = 25;
export const SEARCH_MAX_LENGTH = 150;
/** The search term is only sent at three or more characters. */
const SEARCH_MIN_LENGTH = 3;
export const SEARCH_DEBOUNCE_MS = 300;

/** Value for "any" at a cascade level. Sent as "omit the filter". */
export const ALL = 'All' as const;

export type CategoryName = 'Pokemon' | 'One Piece';
type Category = '' | CategoryName;

type CategoryOption = {
  value: CategoryName;
  label: string;
  icon: string;
  api: MarketplaceCardCategory;
};

export const CATEGORIES: CategoryOption[] = [
  {
    value: 'Pokemon',
    label: 'Pokémon',
    icon: '◓',
    api: MarketplaceCardCategory.Pokemon,
  },
  {
    value: 'One Piece',
    label: 'One Piece',
    icon: '☠',
    api: MarketplaceCardCategory.OnePiece,
  },
];

/** Fixed character shortlist per category. */
export const CHARACTERS: Record<CategoryName, string[]> = {
  Pokemon: [
    'Charizard',
    'Pikachu',
    'Umbreon',
    'Mew',
    'Gengar',
    'Mewtwo',
    'Eevee',
    'Rayquaza',
    'Lugia',
  ],
  'One Piece': ['Luffy', 'Zoro', 'Nami', 'Usopp', 'Sanji'],
};

export const ALL_CHARACTERS_LABEL: Record<CategoryName, string> = {
  Pokemon: 'All Pokémon',
  'One Piece': 'All characters',
};

export type Language = '' | 'All' | MarketplaceLanguage;
/** "Chinese" expands to Traditional and Simplified on the backend. */
export const LANGUAGES: Language[] = [
  MarketplaceLanguage.English,
  MarketplaceLanguage.Japanese,
  MarketplaceLanguage.Chinese,
];

type GradingCompany = '' | 'All' | MarketplaceGradingCompany;
export const GRADING_COMPANIES: GradingCompany[] = [
  MarketplaceGradingCompany.PSA,
  MarketplaceGradingCompany.BGS,
  MarketplaceGradingCompany.CGC,
];

export const GRADES = ['10', '9', '8', '7'];

export const YEAR_RANGES = [
  '1996-2000',
  '2001-2005',
  '2006-2010',
  '2011-2015',
  '2016-2020',
  '2021-2025',
  '2026+',
];

export const PRICE_RANGES = Object.values(MarketplacePriceRange);

type SortValue =
  | 'mint-date-desc'
  | 'mint-date-asc'
  | 'year-desc'
  | 'year-asc'
  | 'name-asc'
  | 'name-desc'
  | 'price-asc'
  | 'price-desc'
  | 'list-date-desc'
  | 'list-date-asc';

type SortOption = {
  value: SortValue;
  label: string;
  sortBy: MarketplaceV2Sort;
  sortOrder: MarketplaceSortOrder;
};

/** Same ten options, labels and wire keys as the sort select. */
export const SORT_OPTIONS: SortOption[] = [
  {
    value: 'mint-date-desc',
    label: 'Newest',
    sortBy: MarketplaceV2Sort.MintDate,
    sortOrder: MarketplaceSortOrder.Descending,
  },
  {
    value: 'mint-date-asc',
    label: 'Oldest',
    sortBy: MarketplaceV2Sort.MintDate,
    sortOrder: MarketplaceSortOrder.Ascending,
  },
  {
    value: 'year-desc',
    label: 'Year: Newest to Oldest',
    sortBy: MarketplaceV2Sort.Year,
    sortOrder: MarketplaceSortOrder.Descending,
  },
  {
    value: 'year-asc',
    label: 'Year: Oldest to Newest',
    sortBy: MarketplaceV2Sort.Year,
    sortOrder: MarketplaceSortOrder.Ascending,
  },
  {
    value: 'name-asc',
    label: 'Name: A–Z',
    sortBy: MarketplaceV2Sort.Name,
    sortOrder: MarketplaceSortOrder.Ascending,
  },
  {
    value: 'name-desc',
    label: 'Name: Z–A',
    sortBy: MarketplaceV2Sort.Name,
    sortOrder: MarketplaceSortOrder.Descending,
  },
  {
    value: 'price-asc',
    label: 'Lowest price',
    sortBy: MarketplaceV2Sort.Price,
    sortOrder: MarketplaceSortOrder.Ascending,
  },
  {
    value: 'price-desc',
    label: 'Highest price',
    sortBy: MarketplaceV2Sort.Price,
    sortOrder: MarketplaceSortOrder.Descending,
  },
  {
    value: 'list-date-desc',
    label: 'List date: Newest to oldest',
    sortBy: MarketplaceV2Sort.ListDate,
    sortOrder: MarketplaceSortOrder.Descending,
  },
  {
    value: 'list-date-asc',
    label: 'List date: Oldest to newest',
    sortBy: MarketplaceV2Sort.ListDate,
    sortOrder: MarketplaceSortOrder.Ascending,
  },
];

const DEFAULT_SORT: SortValue = 'list-date-desc';

export type Filters = {
  q: string;
  sort: SortValue;
  listedOnly: boolean;
  category: Category;
  character: string;
  language: Language;
  gradingCompany: GradingCompany;
  grade: string;
  yearRange: string;
  priceRange: string;
};

type CascadeKey =
  | 'category'
  | 'character'
  | 'language'
  | 'gradingCompany'
  | 'grade'
  | 'yearRange'
  | 'priceRange';

/** Choosing or clearing a level resets every deeper level. */
export function clearCascade(from: CascadeKey): Partial<Filters> {
  switch (from) {
    case 'category':
      return {
        category: '',
        character: '',
        language: '',
        gradingCompany: '',
        grade: '',
        yearRange: '',
        priceRange: '',
      };
    case 'character':
      return {
        character: '',
        language: '',
        gradingCompany: '',
        grade: '',
        yearRange: '',
        priceRange: '',
      };
    case 'language':
      return {
        language: '',
        gradingCompany: '',
        grade: '',
        yearRange: '',
        priceRange: '',
      };
    case 'gradingCompany':
      return { gradingCompany: '', grade: '', yearRange: '', priceRange: '' };
    case 'grade':
      return { grade: '', yearRange: '', priceRange: '' };
    case 'yearRange':
      return { yearRange: '', priceRange: '' };
    default:
      return { priceRange: '' };
  }
}

function isSortValue(value: string): value is SortValue {
  return SORT_OPTIONS.some((option) => option.value === value);
}

function isCategory(value: string): value is Category {
  return value === '' || CATEGORIES.some((option) => option.value === value);
}

function isLanguage(value: string): value is Language {
  return value === '' || value === ALL || LANGUAGES.includes(value as Language);
}

function isGradingCompany(value: string): value is GradingCompany {
  return (
    value === '' ||
    value === ALL ||
    GRADING_COMPANIES.includes(value as GradingCompany)
  );
}

/** Search term as sent: trimmed, three characters or more. */
function effectiveSearch(q: string): string | undefined {
  const trimmed = q.trim();
  return trimmed.length >= SEARCH_MIN_LENGTH ? trimmed : undefined;
}

/** "" and "All" both mean "do not filter" and are omitted from the request. */
function wireValue(value: string): string | undefined {
  return value === '' || value === ALL ? undefined : value;
}

export function toListRequest(
  filters: Filters,
  search: string | undefined = effectiveSearch(filters.q),
): ListMarketplaceCardsV2Request {
  const sort =
    SORT_OPTIONS.find((option) => option.value === filters.sort) ??
    SORT_OPTIONS[0];
  const category = CATEGORIES.find(
    (option) => option.value === filters.category,
  );
  return {
    category: category?.api,
    listedOnly: filters.listedOnly ? true : undefined,
    pageSize: PAGE_SIZE,
    search,
    sortBy: sort?.sortBy,
    sortOrder: sort?.sortOrder,
    character: wireValue(filters.character),
    language:
      filters.language === '' || filters.language === ALL
        ? undefined
        : filters.language,
    gradingCompany:
      filters.gradingCompany === '' || filters.gradingCompany === ALL
        ? undefined
        : filters.gradingCompany,
    grade: wireValue(filters.grade),
    yearRange: wireValue(filters.yearRange),
    priceRange: PRICE_RANGES.find((range) => range === filters.priceRange),
  };
}

/** Stable identity of a list query, for cache keys and effect dependencies. */
export function listKey(request: ListMarketplaceCardsV2Request): string {
  return JSON.stringify(request);
}

export function parseFilters(params: URLSearchParams): Filters {
  const sort = params.get('sort') ?? '';
  const category = params.get('category') ?? '';
  const language = params.get('language') ?? '';
  const gradingCompany = params.get('gradingCompany') ?? '';
  return {
    q: (params.get('q') ?? '').slice(0, SEARCH_MAX_LENGTH),
    sort: isSortValue(sort) ? sort : DEFAULT_SORT,
    listedOnly: params.get('listedOnly') === 'true',
    category: isCategory(category) ? category : '',
    character: params.get('character') ?? '',
    language: isLanguage(language) ? language : '',
    gradingCompany: isGradingCompany(gradingCompany) ? gradingCompany : '',
    grade: params.get('grade') ?? '',
    yearRange: params.get('yearRange') ?? '',
    priceRange: params.get('priceRange') ?? '',
  };
}

export function serializeState(
  filters: Filters,
  tokenId: string | null,
): string {
  const params = new URLSearchParams();
  if (tokenId) params.set('card', tokenId);
  if (filters.q) params.set('q', filters.q);
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  if (filters.listedOnly) params.set('listedOnly', 'true');
  for (const key of [
    'category',
    'character',
    'language',
    'gradingCompany',
    'grade',
    'yearRange',
    'priceRange',
  ] as CascadeKey[]) {
    if (filters[key]) params.set(key, filters[key]);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
