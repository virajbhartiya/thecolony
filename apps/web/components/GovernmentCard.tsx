'use client';
import { useWorld } from '../lib/store';

function fmtMoney(cents: number | string | null | undefined): string {
  const v = Number(cents ?? 0) / 100;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export default function GovernmentCard() {
  const government = useWorld((s) => s.government);
  const selectAgent = useWorld((s) => s.selectAgent);

  if (!government) return null;
  const hasMayor = Boolean(government.mayor_id);

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        top: 88,
        left: 16,
        width: 280,
        padding: '10px 12px',
        zIndex: 20,
      }}
    >
      <div className="panel-title" style={{ marginBottom: 8 }}>
        ▌ CITY GOVERNMENT
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'flex-start' }}>
        <div
          onClick={() => government.mayor_id && selectAgent(government.mayor_id)}
          style={{ cursor: hasMayor ? 'pointer' : 'default' }}
        >
          <div className="pixel" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
            MAYOR
          </div>
          <div
            style={{
              fontSize: 13,
              color: hasMayor ? '#ffc26b' : '#5e5868',
              marginTop: 2,
              textDecoration: hasMayor ? 'underline dotted' : 'none',
              textUnderlineOffset: 3,
            }}
          >
            {government.mayor_name ?? 'vacant'}
          </div>
        </div>
        <div>
          <div className="pixel" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
            TREASURY
          </div>
          <div className="mono" style={{ fontSize: 13, color: '#95b876', marginTop: 2 }}>
            {fmtMoney(government.treasury_cents)}
          </div>
        </div>
        <div>
          <div className="pixel" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
            TAX RATE
          </div>
          <div className="mono" style={{ fontSize: 13, color: '#cdb98a', marginTop: 2 }}>
            {(Number(government.tax_rate_bps ?? 0) / 100).toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="pixel" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
            NEXT ELECTION
          </div>
          <div className="mono" style={{ fontSize: 11, color: '#cdb98a', marginTop: 2 }}>
            {government.next_election_at
              ? new Date(government.next_election_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })
              : 'unscheduled'}
          </div>
        </div>
      </div>
    </div>
  );
}
