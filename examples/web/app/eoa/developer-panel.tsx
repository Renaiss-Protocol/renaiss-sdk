'use client';

import type { EoaStreamEvent } from '@renaiss-protocol/client';
import { type ReactNode, useEffect, useState } from 'react';
import type { Address } from 'viem';
import { NetworkDetails } from '../network-details';
import type { WalletScope } from '../wallet-scope';
import { coverage, type FieldStatus, unmappedPaths } from './api-coverage';
import styles from './eoa.module.css';

export type LogEntry = { at: string; text: string };
export type StreamLogEntry = { at: string; event: EoaStreamEvent };

type Tab = 'coverage' | 'wire' | 'responses' | 'stream' | 'log';
type WireSample = { id: string; path: string; status: number; body: unknown };

const statusClass: Record<FieldStatus, string | undefined> = {
  shown: styles.sShown,
  sdk: styles.sSdk,
  derived: styles.sDerived,
  unused: styles.sUnused,
};
const statusHelp: Record<FieldStatus, string> = {
  shown: 'rendered by this demo',
  sdk: 'consumed by the SDK for validation, signing or paging only',
  derived: 'not rendered directly; feeds a computed value',
  unused: 'neither rendered nor needed by the SDK',
};

function wirePaths(slug: string | null, wallet?: Address) {
  const paths: { id: string; path: string }[] = [
    { id: 'packs', path: 'v2/gacha/packs?limit=100' },
  ];
  if (slug) {
    paths.push(
      { id: 'pack', path: `v2/gacha/packs/${slug}` },
      {
        id: 'content',
        path: `v2/gacha/packs/${slug}/content?limit=3&offset=0`,
      },
      {
        id: 'pull-history',
        path: `v2/gacha/packs/${slug}/pull-history?limit=3&offset=0`,
      },
    );
  }
  if (wallet) {
    paths.push(
      {
        id: 'wallet-history',
        path: `v2/gacha/pull-history?buyerWalletAddress=${wallet}&limit=3&offset=0`,
      },
      {
        id: 'offers',
        path: `v2/gacha/buyback/offers?buyerWalletAddress=${wallet}`,
      },
    );
  }
  return paths;
}

/**
 * Developer section: field coverage per endpoint, raw wire samples diffed
 * against the coverage map, the SDK-parsed responses, the SSE stream and the
 * action log.
 */
export function DeveloperPanel({
  slug,
  wallet,
  scope,
  walletGeneration,
  responses,
  events,
  log,
  recovery,
}: {
  slug: string | null;
  wallet?: Address;
  scope: WalletScope;
  /** Changes whenever the connected wallet or chain does; clears the samples. */
  walletGeneration: number;
  responses: Record<string, unknown>;
  events: StreamLogEntry[];
  log: LogEntry[];
  recovery?: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>('coverage');
  const [samples, setSamples] = useState<WireSample[]>([]);
  const [sampling, setSampling] = useState(false);
  const counts = coverage
    .flatMap((c) => c.fields)
    .reduce<Record<string, number>>((acc, f) => {
      acc[f.status] = (acc[f.status] ?? 0) + 1;
      return acc;
    }, {});

  // Samples may hold the previous wallet's history and offers.
  useEffect(() => {
    setSamples([]);
  }, [walletGeneration]);

  async function fetchWire() {
    // No wallet route is requested unless that wallet is still connected.
    const token = wallet ? scope.token(wallet) : undefined;
    setSampling(true);
    try {
      const results = await Promise.all(
        wirePaths(slug, token ? wallet : undefined).map(
          async ({ id, path }) => {
            const response = await fetch(`/api/renaiss/${path}`, {
              cache: 'no-store',
            });
            let body: unknown;
            try {
              body = await response.json();
            } catch {
              body = await response.text();
            }
            return { id, path, status: response.status, body };
          },
        ),
      );
      if (token && !scope.isCurrent(token)) return;
      setSamples(results);
    } finally {
      setSampling(false);
    }
  }

  const tabs: [Tab, string][] = [
    ['coverage', 'Field coverage'],
    ['wire', 'Wire vs SDK'],
    ['responses', `SDK responses (${Object.keys(responses).length})`],
    ['stream', `Stream events (${events.length})`],
    ['log', `Log (${log.length})`],
  ];

  return (
    <details className={styles.dev}>
      <summary className={styles.devSummary}>
        <span>Developer · API field coverage &amp; raw data</span>
        <span className={`${styles.small} ${styles.muted}`}>
          {counts.shown ?? 0} shown · {counts.sdk ?? 0} sdk ·{' '}
          {counts.derived ?? 0} derived ·{' '}
          <span className={styles.sUnused}>{counts.unused ?? 0} unused</span>
        </span>
      </summary>
      <div className={styles.devBody}>
        <NetworkDetails />
        {recovery && (
          <details>
            <summary>Manual recovery tools</summary>
            {recovery}
          </details>
        )}
        <div className={styles.devTabs}>
          {tabs.map(([key, label]) => (
            <button
              type='button'
              key={key}
              className={`${styles.btn} ${styles.btnSmall} ${tab === key ? styles.devTabActive : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'coverage' && (
          <div>
            <div className={styles.legend}>
              {(Object.keys(statusHelp) as FieldStatus[]).map((s) => (
                <span key={s}>
                  <span className={statusClass[s]}>{s}</span> — {statusHelp[s]}
                </span>
              ))}
            </div>
            {coverage.map((entry) => (
              <div key={entry.id}>
                <div className={styles.endpointHead}>
                  <span className={styles.mono}>{entry.endpoint}</span>
                  <span className={`${styles.mono} ${styles.muted}`}>
                    {entry.sdk}
                  </span>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '38%' }}>Field</th>
                      <th style={{ width: '10%' }}>Status</th>
                      <th>Where the demo uses it</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.fields.map((f) => (
                      <tr key={f.field}>
                        <td className={styles.mono}>{f.field}</td>
                        <td className={statusClass[f.status]}>{f.status}</td>
                        <td>{f.use}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {tab === 'wire' && (
          <div>
            <p className={`${styles.muted} ${styles.small}`}>
              Fetches the raw JSON through the demo proxy for the current
              machine
              {wallet ? ' and the connected wallet' : ''}, then lists any wire
              field the coverage map does not describe. Public routes need no
              key; wallet routes use the server key.
            </p>
            <div
              className={styles.center}
              style={{ justifyContent: 'flex-start', marginTop: 8 }}
            >
              <button
                type='button'
                className={styles.btn}
                disabled={sampling}
                onClick={() => void fetchWire()}
              >
                {sampling ? 'Fetching…' : 'Fetch wire samples'}
              </button>
            </div>
            {samples.map((sample) => {
              const unmapped = unmappedPaths(sample.id, sample.body);
              return (
                <div key={sample.path}>
                  <div className={styles.endpointHead}>
                    <span className={styles.mono}>
                      GET /{sample.path} → {sample.status}
                    </span>
                    <span
                      className={
                        unmapped.length ? styles.sUnused : styles.sShown
                      }
                    >
                      {unmapped.length
                        ? `${unmapped.length} unmapped: ${unmapped.join(', ')}`
                        : 'every wire field is mapped'}
                    </span>
                  </div>
                  <pre className={styles.pre}>
                    {JSON.stringify(sample.body, null, 2)}
                  </pre>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'responses' && (
          <div>
            {Object.keys(responses).length === 0 && (
              <p className={styles.muted}>No SDK responses yet.</p>
            )}
            {Object.entries(responses).map(([label, value]) => (
              <div key={label}>
                <div className={styles.endpointHead}>
                  <span className={styles.mono}>{label}</span>
                  <span className={`${styles.muted} ${styles.small}`}>
                    as parsed by the SDK schema
                  </span>
                </div>
                <pre className={styles.pre}>
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}

        {tab === 'stream' && (
          <div>
            {events.length === 0 && (
              <p className={styles.muted}>
                No stream events yet. Rip a pack to see them.
              </p>
            )}
            {events.map(({ at, event }) => (
              <div key={`${at}-${event.event}`}>
                <div className={styles.endpointHead}>
                  <span className={styles.mono}>{event.event}</span>
                  <span className={`${styles.muted} ${styles.small}`}>
                    {new Date(at).toLocaleTimeString()}
                  </span>
                </div>
                <pre className={styles.pre}>
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}

        {tab === 'log' && (
          <ul className={styles.logList}>
            {log.length === 0 && (
              <li className={styles.muted}>Nothing logged yet.</li>
            )}
            {log.map((entry) => (
              <li key={`${entry.at}-${entry.text}`} className={styles.mono}>
                <span className={styles.muted}>
                  {new Date(entry.at).toLocaleTimeString()}
                </span>{' '}
                {entry.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
