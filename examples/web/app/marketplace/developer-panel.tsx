'use client';

import { useState } from 'react';
import { NetworkDetails } from '../network-details';
import {
  coverage,
  type EndpointId,
  type FieldStatus,
  unmappedPaths,
} from './field-coverage';
import styles from './marketplace.module.css';

export type LogEntry = { at: string; text: string };

type Tab = 'coverage' | 'wire' | 'responses' | 'log';
type WireSample = {
  id: EndpointId;
  path: string;
  status: number;
  body: unknown;
};

const statusClass: Record<FieldStatus, string | undefined> = {
  shown: styles.sShown,
  sdk: styles.sSdk,
  derived: styles.sDerived,
  unused: styles.sUnused,
};
const statusHelp: Record<FieldStatus, string> = {
  shown: 'rendered by this demo',
  sdk: 'consumed by the SDK for validation or paging only',
  derived: 'not rendered directly; feeds a computed value or an action',
  unused: 'neither rendered nor needed by the SDK',
};

function wirePaths(tokenId: string | null): { id: EndpointId; path: string }[] {
  const paths: { id: EndpointId; path: string }[] = [
    { id: 'list', path: 'v2/marketplace?limit=3&listedOnly=true' },
  ];
  if (tokenId)
    paths.push(
      { id: 'detail', path: `v2/marketplace/cards/${tokenId}` },
      { id: 'orders', path: `v2/marketplace/cards/${tokenId}/orders` },
    );
  return paths;
}

/**
 * Developer section: field coverage per endpoint, raw wire samples diffed
 * against the coverage map, the SDK-parsed responses and the action log.
 */
export function DeveloperPanel({
  wireBase,
  tokenId,
  responses,
  log,
}: {
  wireBase: string;
  tokenId: string | null;
  responses: Record<string, unknown>;
  log: LogEntry[];
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

  async function fetchWire() {
    setSampling(true);
    try {
      const results = await Promise.all(
        wirePaths(tokenId).map(async ({ id, path }) => {
          const response = await fetch(
            `${wireBase.replace(/\/$/, '')}/${path}`,
            { cache: 'no-store' },
          );
          let body: unknown;
          try {
            body = JSON.parse(await response.clone().text());
          } catch {
            body = await response.text();
          }
          return { id, path, status: response.status, body };
        }),
      );
      setSamples(results);
    } finally {
      setSampling(false);
    }
  }

  const tabs: [Tab, string][] = [
    ['coverage', 'Field coverage'],
    ['wire', 'Wire vs SDK'],
    ['responses', `SDK responses (${Object.keys(responses).length})`],
    ['log', `Log (${log.length})`],
  ];

  return (
    <details className={styles.dev}>
      <summary className={styles.devSummary}>
        <span>Developer · API field coverage &amp; raw data</span>
        <span className={`${styles.small} ${styles.muted}`}>
          {counts.shown ?? 0} shown · {counts.sdk ?? 0} sdk ·{' '}
          {counts.derived ?? 0} derived ·{' '}
          <span className={styles.sUnused}>{counts.unused ?? 0} unused</span> ·
          API v2
        </span>
      </summary>
      <div className={styles.devBody}>
        <NetworkDetails />
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
                      <th style={{ width: '28%' }}>Field</th>
                      <th style={{ width: '9%' }}>Status</th>
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
              Fetches the raw JSON from {wireBase} for the v2 list
              {tokenId ? ' and the open card' : ''}, then lists any wire field
              the coverage map does not describe. Open a card first to sample
              the detail and orders routes.
            </p>
            <div className={styles.rowLine} style={{ marginTop: 8 }}>
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
