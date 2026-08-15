export type ShortlistStatus = 'shortlisted' | 'not_selected' | 'waitlisted';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export type MockTeam = {
  team_id: string;
  team_name: string;
  team_lead: string;
  email: string;
  shortlist_status: ShortlistStatus;
  payment_status: PaymentStatus;
  mock_token: string;
  payment_deadline: string;
  amount: number;
  transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MockTransaction = {
  team_id: string;
  transaction_id: string;
  amount: number;
  status: 'pending' | 'initiated' | 'success' | 'failed';
  created_at: string;
  updated_at: string;
};

export type MockShortlistState = {
  teams: MockTeam[];
  transactions: MockTransaction[];
};

const DEV_TEAM_DATA: MockTeam[] = [
  {
    team_id: 'SPC2026-001',
    team_name: 'Team Alpha',
    team_lead: 'Sharanya',
    email: 'alpha@example.com',
    shortlist_status: 'shortlisted',
    payment_status: 'pending',
    mock_token: 'demo-alpha-token-8f72',
    payment_deadline: '2026-08-25',
    amount: 1600,
    transaction_id: null,
    paid_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    team_id: 'SPC2026-002',
    team_name: 'Team Beta',
    team_lead: 'Suraj',
    email: 'beta@example.com',
    shortlist_status: 'shortlisted',
    payment_status: 'pending',
    mock_token: 'demo-beta-token-4k91',
    payment_deadline: '2026-08-25',
    amount: 1600,
    transaction_id: null,
    paid_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    team_id: 'SPC2026-003',
    team_name: 'Team Gamma',
    team_lead: 'Rahul',
    email: 'gamma@example.com',
    shortlist_status: 'not_selected',
    payment_status: 'pending',
    mock_token: 'demo-gamma-token-9d12',
    payment_deadline: '2026-08-25',
    amount: 1600,
    transaction_id: null,
    paid_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  {
    team_id: 'SPC2026-004',
    team_name: 'Team Delta',
    team_lead: 'Priya',
    email: 'delta@example.com',
    shortlist_status: 'waitlisted',
    payment_status: 'pending',
    mock_token: 'demo-delta-token-2r77',
    payment_deadline: '2026-08-25',
    amount: 1600,
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
    amount: 1600,
    transaction_id: 'SPC26MOCK7X31A91',
    paid_at: '2026-08-02T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-02T00:00:00.000Z',
  },
];

export const mockShortlistState: MockShortlistState = {
  teams: DEV_TEAM_DATA,
  transactions: [],
};

export const mockShortlistService = {
  getTeamForToken(token: string, state: MockShortlistState = mockShortlistState) {
    if (!token || typeof token !== 'string') return null;
    return state.teams.find((team) => team.mock_token === token) ?? null;
  },
  getPublicMessage() {
    return {
      title: 'Shortlist Results Are In',
      body: 'Registrations are now closed. Shortlisted teams have been notified through their registered contact details. If your team has been selected, use your secure access link to view your shortlist status and complete the next step.',
    };
  },
};

export const paymentService = {
  createPayment(token: string, state: MockShortlistState = mockShortlistState) {
    const team = mockShortlistService.getTeamForToken(token, state);
    if (!team) {
      return { ok: false as const, code: 'invalid_token' as const };
    }
    if (team.shortlist_status !== 'shortlisted') {
      return { ok: false as const, code: 'not_shortlisted' as const };
    }
    if (team.payment_status === 'paid') {
      return { ok: false as const, code: 'already_paid' as const };
    }
    if (team.payment_status === 'failed') {
      return { ok: false as const, code: 'payment_failed' as const };
    }
   const deadline = new Date(team.payment_deadline);
    const now = new Date();
    if (Number.isNaN(deadline.getTime()) || now > deadline) {
      return { ok: false as const, code: 'deadline_expired' as const };
    }
    return {
      ok: true as const,
      code: 'payment_initiated' as const,
      team,
      amount: team.amount,
      transactionId: `SPC26MOCK${token.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'GEN'}`,
    };
  },

  completeSuccess(token: string, state: MockShortlistState = mockShortlistState) {
    const team = mockShortlistService.getTeamForToken(token, state);
    if (!team) return { ok: false as const, code: 'invalid_token' as const };
    if (team.payment_status === 'paid') return { ok: false as const, code: 'already_paid' as const };
    if (team.shortlist_status !== 'shortlisted') return { ok: false as const, code: 'not_shortlisted' as const };

    const transactionId = team.transaction_id ?? `SPC26MOCK${token.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'GEN'}`;
    const now = new Date().toISOString();

    const teamIndex = state.teams.findIndex((entry) => entry.team_id === team.team_id);
    if (teamIndex >= 0) {
      state.teams[teamIndex] = {
        ...state.teams[teamIndex],
        payment_status: 'paid',
        transaction_id: transactionId,
        paid_at: now,
        updated_at: now,
      };
    }

    state.transactions.push({
      team_id: team.team_id,
      transaction_id: transactionId,
      amount: team.amount,
      status: 'success',
      created_at: now,
      updated_at: now,
    });

    return {
      ok: true as const,
      code: 'payment_success' as const,
      team: state.teams[teamIndex >= 0 ? teamIndex : 0],
      transactionId,
      amount: team.amount,
    };
  },

  completeFailure(token: string, state: MockShortlistState = mockShortlistState) {
    const team = mockShortlistService.getTeamForToken(token, state);
    if (!team) return { ok: false as const, code: 'invalid_token' as const };
    if (team.payment_status === 'paid') return { ok: false as const, code: 'already_paid' as const };

    const teamIndex = state.teams.findIndex((entry) => entry.team_id === team.team_id);
    if (teamIndex >= 0) {
      state.teams[teamIndex] = {
        ...state.teams[teamIndex],
        payment_status: 'failed',
        updated_at: new Date().toISOString(),
      };
    }

    state.transactions.push({
      team_id: team.team_id,
      transaction_id: `SPC26MOCKFAIL${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      amount: team.amount,
      status: 'failed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return { ok: true as const, code: 'payment_failed' as const, team: state.teams[teamIndex >= 0 ? teamIndex : 0] };
  },
};

export const mockDevLinks = [
  { label: 'Team Alpha', token: 'demo-alpha-token-8f72' },
  { label: 'Team Beta', token: 'demo-beta-token-4k91' },
  { label: 'Team Nova — Already Paid', token: 'demo-paid-token-7x31' },
  { label: 'Invalid Token', token: 'invalid-demo-token' },
];

/**
 * V2 portal search — match a team by Team Leader Email, Team Name, Team ID,
 * or secure token. Non-breaking helper over the existing mock state; it does
 * not modify any payment logic.
 */
export function searchTeam(
  query: string,
  state: MockShortlistState = mockShortlistState
): MockTeam | null {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return null;
  return (
    state.teams.find(
      (t) =>
        t.email.toLowerCase() === q ||
        t.team_name.toLowerCase() === q ||
        t.team_id.toLowerCase() === q ||
        t.mock_token.toLowerCase() === q ||
        t.team_name.toLowerCase().includes(q)
    ) ?? null
  );
}

export function getMockRecoveryUrl(email: string) {
  const fallback = mockShortlistState.teams.find((team) => team.email.toLowerCase() === email.toLowerCase());
  if (!fallback) return null;
  return `/shortlist/${fallback.mock_token}`;
}

export function getMockReceiptData(team: MockTeam) {
  return {
    teamId: team.team_id,
    teamName: team.team_name,
    teamLead: team.team_lead,
    amount: `₹${team.amount}`,
    transactionId: team.transaction_id ?? 'PENDING',
    paymentStatus: team.payment_status === 'paid' ? 'SUCCESS' : 'PENDING',
    paymentDate: team.paid_at ?? new Date().toISOString(),
  };
}

export const registrationFee = 999;
