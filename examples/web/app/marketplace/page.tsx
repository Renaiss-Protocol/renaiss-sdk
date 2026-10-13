import { getError, getValue, isFailed } from '@renaiss-protocol/client';
import { type Filters, parseFilters, toListRequest } from './filters';
import { createMarketplaceReader, PROXY_BASE_URL } from './marketplace-client';
import { type InitialResult, MarketplaceExample } from './marketplace-example';

export const dynamic = 'force-dynamic';

/** First page rendered on the server, for the filters in the URL. */
async function loadInitialPage(filters: Filters): Promise<InitialResult> {
  const baseUrl = process.env.RENAISS_API_URL;
  if (!baseUrl) return null;
  const result = await createMarketplaceReader(baseUrl)
    .listMarketplaceCards(toListRequest(filters))
    .firstPage();
  if (isFailed(result)) {
    const error = getError(result);
    return {
      page: null,
      error: `${error.code} (${error.status}): ${error.detail}`,
    };
  }
  const page = getValue(result);
  return {
    page: {
      items: page.items,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      totalCount: page.totalCount,
    },
    error: null,
  };
}

type SearchParams = Record<string, string | string[] | undefined>;

/** URL keys (q, sort, category, …) plus ?card= for the detail. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    if (typeof value === 'string') params.set(key, value);
  const filters = parseFilters(params);
  return (
    <MarketplaceExample
      browserBaseUrl={PROXY_BASE_URL}
      initial={await loadInitialPage(filters)}
      initialFilters={filters}
      initialTokenId={params.get('card')}
    />
  );
}
