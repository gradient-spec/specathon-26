import { describe, expect, it } from 'vitest';
import {
  mockShortlistService,
  paymentService,
  type MockShortlistState,
} from './mockShortlist';

const baseState: MockShortlistState = {
  teams: [
    {
      team_id: 'SPC2026-001',
      team_name: 'Team Alpha',
      team_lead: 'Sharanya',
      email: 'alpha@example.com',
      shortlist_status: 'shortlisted',
      payment_status: 'pending',
      mock_token: 'demo-alpha-token-8f72',
      payment_deadline: '2026-08-25',
      amount: 999,
      transaction_id: null,
      paid_at: null,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
    },
    {
      team_id: 'SPC2026-005',
      team_name: 'Team Nova',
      team_lead: 'Arjun',
      email: 'nova@example.com',
      shortlist_status: 'shortlisted',
      payment_status: 'paid',
      mock_token: 'demo-paid-token-7x31',
      payment_deadline: '2026-08-25',
      amount: 999,
      transaction_id: 'SPC26MOCK7X31A91',
      paid_at: '2026-08-02T00:00:00.000Z',
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-02T00:00:00.000Z',
    },
  ],
  transactions: [],
};

describe('mock shortlist access', () => {
  it('validates a known token and returns the team without leaking full shortlist data', () => {
    const result = mockShortlistService.getTeamForToken('demo-alpha-token-8f72', baseState);
    expect(result).not.toBeNull();
    expect(result?.team_name).toBe('Team Alpha');
    expect(result?.team_id).toBe('SPC2026-001');
    expect(result?.email).toBe('alpha@example.com');
  });

  it('rejects invalid tokens and expired payment windows', () => {
    expect(mockShortlistService.getTeamForToken('invalid-demo-token', baseState)).toBeNull();
    const expired: MockShortlistState = {
      ...baseState,
      teams: [
        {
          ...baseState.teams[0],
          payment_deadline: '2026-08-01',
          payment_status: 'pending',
        },
      ],
      transactions: [],
    };
    expect(paymentService.createPayment('demo-alpha-token-8f72', expired)).toMatchObject({ ok: false, code: 'deadline_expired' });
  });

  it('prevents duplicate successful payment', () => {
    const paidState: MockShortlistState = {
      ...baseState,
      teams: [
        { ...baseState.teams[0], payment_status: 'paid', transaction_id: 'SPC26MOCK8F72A91', paid_at: '2026-08-02T00:00:00.000Z' },
      ],
      transactions: [{ team_id: 'SPC2026-001', transaction_id: 'SPC26MOCK8F72A91', amount: 999, status: 'success', created_at: '2026-08-02T00:00:00.000Z', updated_at: '2026-08-02T00:00:00.000Z' }],
    };

    const result = paymentService.completeSuccess('demo-alpha-token-8f72', paidState);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('already_paid');
  });
});
