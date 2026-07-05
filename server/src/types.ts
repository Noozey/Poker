export interface Env {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  LOBBY_ROOM: DurableObjectNamespace;
}

export interface Suit {
  name: string;
  symbol: string;
}

export interface Card {
  rank: string;
  suit: Suit;
}

export interface CheckState {
  players: boolean[];
  community: boolean[];
}

export interface Player {
  id: string;
  buy_in_amount?: number;
  [key: string]: unknown;
}

export interface LobbyDataRow {
  name: string;
  draweddeck: Card[];
  check: CheckState;
  dealer: number;
  show: boolean;
  currentTurn: number;
  folduser: string[];
  pot: number;
  call: number;
}

export interface Lobby {
  id: string;
  name: string;
  game_type: string;
  max_players: number;
  buy_in_amount: number;
  password: string | null;
  creator_id: string;
  players: Player[];
}

// ── Realtime message shapes sent over the LobbyRoom WebSocket ──────────────
// Replaces the old socket.io event names. Every message has a `type` and a
// `payload`; the client sends/receives JSON of this shape.

export interface GameDetailsPayload {
  lobbyName: string;
  currentTurn: number;
  numPlayer: number;
  foldedIds?: number[];
}

export interface CallPayload {
  lobbyName: string;
  [key: string]: unknown;
}

export interface FoldPayload {
  lobbyName: string;
  id: string;
  [key: string]: unknown;
}

export interface WinnerPayload {
  name: string;
  winner: string;
  pot: number;
}

export interface MsgPayload {
  lobbyName?: string;
  [key: string]: unknown;
}

export type RealtimeMessage =
  | { type: "gamedetails"; payload: GameDetailsPayload }
  | { type: "call"; payload: CallPayload }
  | { type: "fold"; payload: FoldPayload }
  | { type: "winner"; payload: WinnerPayload }
  | { type: "msg"; payload: MsgPayload };

export interface LobbyDataRow {
  name: string;
  draweddeck: Card[];
  check: CheckState;
  dealer: number;
  show: boolean;
  currentTurn: number;
  folduser: string[]; // was number[]
  pot: number;
  call: number;
}
