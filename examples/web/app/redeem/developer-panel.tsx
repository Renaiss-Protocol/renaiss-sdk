'use client';

import { useState } from 'react';
import { shortHex } from '../eoa/format';
import { NetworkDetails } from '../network-details';
import { coverage, type FieldStatus } from './field-coverage';
import styles from './redeem.module.css';
import { useRedeem } from './redeem-provider';

type Tab = 'coverage' | 'responses' | 'log' | 'recovery';

const statusClass: Record<FieldStatus, string | undefined> = {
  shown: styles.sShown,
  sdk: styles.sSdk,
  signing: styles.sSigning,
  derived: styles.sDerived,
};
const statusHelp: Record<FieldStatus, string> = {
  shown: 'rendered by this demo',
  sdk: 'consumed by the SDK for validation, paging or the wallet access token only',
  signing: 'used only to build, cross-check or verify the Permit2 witness',
  derived: 'not rendered directly; feeds a computed value or an action',
};

/**
 * Developer section: field coverage per /v2/redeem endpoint, the SDK-parsed
 * responses, the action log and the recovery journal (the only thing this demo
 * persists).
 */
export function DeveloperPanel() {
  const { responses, log, journal, session, wallet } = useRedeem();
  const [tab, setTab] = useState<Tab>('coverage');
  const counts = coverage
    .flatMap((c) => c.fields)
    .reduce<Record<string, number>>((acc, f) => {
      acc[f.status] = (acc[f.status] ?? 0) + 1;
      return acc;
    }, {});

  const tabs: [Tab, string][] = [
    ['coverage', 'Field coverage'],
    ['responses', `SDK responses (${Object.keys(responses).length})`],
    ['log', `Log (${log.length})`],
    ['recovery', `Recovery${journal ? ' (1 pending)' : ''}`],
  ];

  return (
    <details className={styles.dev}>
      <summary className={styles.devSummary}>
        <span>Developer · API field coverage &amp; raw data</span>
        <span className={`${styles.small} ${styles.muted}`}>
          {counts.shown ?? 0} shown · {counts.sdk ?? 0} sdk ·{' '}
          <span className={styles.sSigning}>{counts.signing ?? 0} signing</span>{' '}
          · {counts.derived ?? 0} derived · API v2
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
                  {JSON.stringify(
                    value,
                    (_, v) => (typeof v === 'bigint' ? `${v.toString()}n` : v),
                    2,
                  )}
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

        {tab === 'recovery' && (
          <div className={styles.col}>
            <p className={`${styles.small} ${styles.muted}`}>
              localStorage holds only this journal: opaque preparation/request
              ids and the wallet they belong to, written before the network
              submit. The wallet access token
              {session
                ? ` (${shortHex(session.walletAddress)}, until ${new Date(session.expiresAt).toLocaleString()})`
                : ''}{' '}
              lives in SDK memory and is gone after a reload.
            </p>
            <pre className={styles.pre}>
              {journal
                ? JSON.stringify(journal, null, 2)
                : 'No pending checkout.'}
            </pre>
            <span className={`${styles.small} ${styles.muted}`}>
              Connected wallet: {wallet ? wallet.account : 'none'}
            </span>
          </div>
        )}
      </div>
    </details>
  );
}
