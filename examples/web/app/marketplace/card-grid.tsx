'use client';

import type { MarketplaceCard } from '@renaiss-protocol/client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { usd, usdt } from '../eoa/format';
import {
  ALL,
  ALL_CHARACTERS_LABEL,
  CATEGORIES,
  type CategoryName,
  CHARACTERS,
  clearCascade,
  type Filters,
  GRADES,
  GRADING_COMPANIES,
  LANGUAGES,
  PRICE_RANGES,
  SEARCH_MAX_LENGTH,
  SORT_OPTIONS,
  YEAR_RANGES,
} from './filters';
import { relativeAgoLong, splitCardName } from './helpers';
import styles from './marketplace.module.css';

/*
 * Marketplace list components:
 * the sticky filter bar (chosen cascade chips, next-level options, listed-only
 * switch, search, sort) and the 2/3/4/5-column grid with its infinite-scroll
 * footer.
 */

type Chip = { key: string; label: string; icon?: string; onClick: () => void };

function chosenChips(
  filters: Filters,
  onChange: (next: Partial<Filters>) => void,
): Chip[] {
  const chips: Chip[] = [];
  const category = CATEGORIES.find((c) => c.value === filters.category);
  if (!category) return chips;
  chips.push({
    key: 'category',
    label: category.label,
    icon: category.icon,
    onClick: () => onChange(clearCascade('category')),
  });
  if (filters.character)
    chips.push({
      key: 'character',
      label:
        filters.character === ALL
          ? ALL_CHARACTERS_LABEL[category.value]
          : filters.character,
      onClick: () => onChange(clearCascade('character')),
    });
  if (filters.language)
    chips.push({
      key: 'language',
      label: filters.language === ALL ? 'All languages' : filters.language,
      onClick: () => onChange(clearCascade('language')),
    });
  if (filters.gradingCompany)
    chips.push({
      key: 'gradingCompany',
      label:
        filters.gradingCompany === ALL
          ? 'All grading companies'
          : filters.gradingCompany,
      onClick: () => onChange(clearCascade('gradingCompany')),
    });
  if (filters.grade)
    chips.push({
      key: 'grade',
      label:
        filters.grade === ALL
          ? 'All grade'
          : `${filters.gradingCompany === ALL ? '' : `${filters.gradingCompany} `}${filters.grade}`,
      onClick: () => onChange(clearCascade('grade')),
    });
  if (filters.yearRange)
    chips.push({
      key: 'yearRange',
      label: filters.yearRange === ALL ? 'All years' : filters.yearRange,
      onClick: () => onChange(clearCascade('yearRange')),
    });
  return chips;
}

/** The options row for the next unfilled cascade level. */
function nextOptions(
  filters: Filters,
  onChange: (next: Partial<Filters>) => void,
): { active?: string; options: Chip[] } {
  const category = filters.category as CategoryName | '';
  if (!category)
    return {
      options: CATEGORIES.map((option) => ({
        key: option.value,
        label: option.label,
        icon: option.icon,
        onClick: () =>
          onChange({ ...clearCascade('category'), category: option.value }),
      })),
    };
  if (!filters.character)
    return {
      options: [ALL, ...CHARACTERS[category]].map((value) => ({
        key: value,
        label: value === ALL ? ALL_CHARACTERS_LABEL[category] : value,
        onClick: () =>
          onChange({ ...clearCascade('character'), character: value }),
      })),
    };
  if (!filters.language)
    return {
      options: [ALL, ...LANGUAGES].map((value) => ({
        key: value,
        label: value === ALL ? 'All languages' : value,
        onClick: () =>
          onChange({
            ...clearCascade('language'),
            language: value === ALL ? ALL : value,
          }),
      })),
    };
  if (!filters.gradingCompany)
    return {
      options: [ALL, ...GRADING_COMPANIES].map((value) => ({
        key: value,
        label: value === ALL ? 'All grading companies' : value,
        onClick: () =>
          onChange({
            ...clearCascade('gradingCompany'),
            gradingCompany: value === ALL ? ALL : value,
          }),
      })),
    };
  if (!filters.grade)
    return {
      options: [ALL, ...GRADES].map((value) => ({
        key: value,
        label: value === ALL ? 'All grade' : value,
        onClick: () => onChange({ ...clearCascade('grade'), grade: value }),
      })),
    };
  if (!filters.yearRange)
    return {
      options: [ALL, ...YEAR_RANGES].map((value) => ({
        key: value,
        label: value === ALL ? 'All years' : value,
        onClick: () =>
          onChange({ ...clearCascade('yearRange'), yearRange: value }),
      })),
    };
  // Picking a price range also turns on "Listed only".
  return {
    active: filters.priceRange,
    options: [ALL, ...PRICE_RANGES].map((value) => ({
      key: value,
      label: value === ALL ? 'All prices' : value,
      onClick: () =>
        onChange(
          value === ALL
            ? { priceRange: ALL }
            : { priceRange: value, listedOnly: true },
        ),
    })),
  };
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
}) {
  const [stuck, setStuck] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const nearLimit = filters.q.length > SEARCH_MAX_LENGTH * 0.7;
  const chosen = chosenChips(filters, onChange);
  const next = nextOptions(filters, onChange);

  useEffect(() => {
    const target = sentinel.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(entry ? !entry.isIntersecting : false),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} />
      <div
        className={`${styles.filterBar} ${stuck ? styles.filterBarStuck : ''}`}
      >
        <div className={styles.chipRow}>
          {chosen.length > 0 && (
            <>
              <div className={styles.chipGroup}>
                {chosen.map((chip, index) => (
                  <button
                    type='button'
                    key={chip.key}
                    className={`${styles.filterChip} ${index === chosen.length - 1 ? styles.filterChipActive : ''}`}
                    onClick={chip.onClick}
                  >
                    {chip.icon && <span aria-hidden>{chip.icon}</span>}
                    {chip.label}
                    <span aria-hidden>✕</span>
                  </button>
                ))}
              </div>
              <div className={styles.chipDivider} />
            </>
          )}
          <div className={styles.chipGroup}>
            {next.options.map((option) => (
              <button
                type='button'
                key={option.key}
                className={`${styles.filterChip} ${next.active === option.key ? styles.filterChipActive : ''}`}
                onClick={option.onClick}
              >
                {option.icon && <span aria-hidden>{option.icon}</span>}
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.searchRow}>
          <label className={styles.switchLabel}>
            <button
              type='button'
              role='switch'
              aria-checked={filters.listedOnly}
              className={`${styles.switch} ${filters.listedOnly ? styles.switchOn : ''}`}
              onClick={() => onChange({ listedOnly: !filters.listedOnly })}
            />
            Listed only
          </label>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden>
              ⌕
            </span>
            <input
              className={`${styles.input} ${styles.searchInput}`}
              placeholder='Search cards by name, set, etc'
              aria-label='Search cards'
              maxLength={SEARCH_MAX_LENGTH}
              value={filters.q}
              onChange={(e) =>
                onChange({ q: e.target.value.slice(0, SEARCH_MAX_LENGTH) })
              }
            />
            {nearLimit && (
              <span className={styles.charCount}>
                {filters.q.length}/{SEARCH_MAX_LENGTH}
              </span>
            )}
          </div>
          <select
            className={styles.select}
            aria-label='Sort by'
            value={filters.sort}
            onChange={(e) =>
              onChange({
                sort:
                  SORT_OPTIONS.find((o) => o.value === e.target.value)?.value ??
                  filters.sort,
              })
            }
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}

export function CardGrid({
  cards,
  loading,
  loadingMore,
  hasMore,
  error,
  onOpen,
  onLoadMore,
  onRetry,
}: {
  cards: MarketplaceCard[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onOpen: (tokenId: string) => void;
  onLoadMore: () => void;
  onRetry: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(onLoadMore);
  loadMoreRef.current = onLoadMore;

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore || loading || loadingMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) loadMoreRef.current();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore]);

  if (loading && cards.length === 0)
    return <div className={styles.loader}>Loading cards…</div>;

  if (cards.length === 0)
    return (
      <div className={styles.emptyWrap}>
        <div className={styles.emptyCard}>
          <span>{error ?? "We couldn't find any collectibles to show"}</span>
          <button
            type='button'
            className={`${styles.btn} ${styles.btnRainbow}`}
            style={{ width: 'auto', padding: '0 32px' }}
            onClick={onRetry}
          >
            Try again
          </button>
        </div>
        <div className={`${styles.grid} ${styles.emptyGrid}`} aria-hidden>
          {['a', 'b', 'c', 'd', 'e'].map((key) => (
            <div key={key} className={styles.emptyTile}>
              <div />
              <div />
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <>
      <div className={styles.grid}>
        {cards.map((card) => (
          <CardTile
            key={card.tokenId}
            card={card}
            image={card.frontImageUrl}
            onOpen={onOpen}
          />
        ))}
      </div>
      {hasMore || loadingMore ? (
        <div ref={sentinel} className={styles.loadMore}>
          {loadingMore ? (
            <span className={styles.muted}>Loading more cards...</span>
          ) : (
            'Scroll for more'
          )}
        </div>
      ) : (
        <div className={`${styles.loadMore} ${styles.muted}`}>End of list</div>
      )}
    </>
  );
}

function CardTile({
  card,
  image,
  onOpen,
}: {
  card: MarketplaceCard;
  image: string | null | undefined;
  onOpen: (tokenId: string) => void;
}) {
  const { title, subtitle } = splitCardName(card.name);
  const listed = card.askPriceInUsdt !== null;
  return (
    <button
      type='button'
      className={styles.tile}
      onClick={() => onOpen(card.tokenId)}
    >
      <div className={styles.tileMedia}>
        {listed && <span className={styles.listedPill}>Listed</span>}
        {image ? (
          <Image
            fill
            sizes='(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1180px) 25vw, 20vw'
            className={styles.tileImg}
            src={image}
            alt='Card'
          />
        ) : image === null ? (
          <span className={`${styles.tileNoImg} ${styles.small}`}>
            <span className={styles.missing}>Image unavailable</span>
          </span>
        ) : null}
        <span
          className={`${styles.btn} ${styles.btnRainbow} ${styles.tileCta}`}
        >
          {listed ? 'Buy now' : 'Make an offer'}
        </span>
      </div>
      <div className={styles.tileBody}>
        <div>
          <div className={styles.tileTitle}>{title || '​'}</div>
          {subtitle && <div className={styles.tileSubtitle}>{subtitle}</div>}
        </div>
        <div className={styles.tileFooter}>
          <span className={styles.tilePrice}>
            {card.askPriceInUsdt === null
              ? 'unlisted'
              : `$ ${usdt(card.askPriceInUsdt, 2)}`}
          </span>
          {card.rixPriceInUsd !== null && (
            <FmvBadge
              cents={card.rixPriceInUsd}
              updatedAt={card.rixPriceUpdatedAt}
            />
          )}
        </div>
      </div>
    </button>
  );
}

/** Gold "FMV $ 172" pill; the hover text explains how fresh the value is. */
export function FmvBadge({
  cents,
  updatedAt,
  size = 'small',
}: {
  cents: string;
  updatedAt: string | null;
  size?: 'small' | 'large';
}) {
  const title = updatedAt
    ? `Fair market value · Priced ${relativeAgoLong(updatedAt, Date.now())} ago`
    : undefined;
  return (
    <span
      className={styles.fmvBadge}
      title={title}
      style={size === 'large' ? { fontSize: 14 } : undefined}
    >
      <span className={styles.fmvLabel}>FMV</span>
      <span>$ {usd(cents, 2)}</span>
    </span>
  );
}
