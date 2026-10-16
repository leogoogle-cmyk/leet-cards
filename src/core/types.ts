// src/core/types.ts
// ---------------------------------------------------------------------------
// 資料模型：LeetCode 觀念閃卡 (Card) 與 SRS 學習進度 (SRSProgress)
// Card 本身也是辨別聯合型別：type 決定卡片帶哪些欄位。
// ---------------------------------------------------------------------------

/** 演算法主題 */
export type Topic =
  | 'array-hashing'
  | 'two-pointers'
  | 'sliding-window'
  | 'stack'
  | 'binary-search'
  | 'linked-list'
  | 'tree-graph'
  | 'heap'
  | 'dynamic-programming';

/** LeetCode 難度 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** 時間複雜度選項（由快到慢） */
export const COMPLEXITY_LADDER = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)'] as const;
export type Complexity = (typeof COMPLEXITY_LADDER)[number];

/** 對應的 LeetCode 題目（選填） */
export interface ProblemRef {
  number: number;
  title: string;
}

interface CardBase {
  /** 穩定唯一 ID，例如 "lc-concept-0001"（務必穩定，否則進度會對不上） */
  id: string;
  topic: Topic;
  difficulty: Difficulty;
  problem?: ProblemRef;
  /** 作答後顯示的解說 */
  explanation: string;
}

/** 觀念題：四選一（正確答案 + 干擾項） */
export interface ConceptCard extends CardBase {
  type: 'concept';
  prompt: string;
  /** 選填：題目附帶的程式碼 */
  code?: string;
  answer: string;
  /** 至少三個干擾項 */
  distractors: string[];
}

/** 複雜度題：看程式碼判斷時間複雜度 */
export interface ComplexityCard extends CardBase {
  type: 'complexity';
  prompt: string;
  code: string;
  answer: Complexity;
}

/** 步驟題：把演算法步驟排成正確順序 */
export interface StepsCard extends CardBase {
  type: 'steps';
  prompt: string;
  /** 正確順序的步驟 */
  steps: string[];
  /** 選填：混入的干擾步驟 */
  distractorSteps?: string[];
}

export type Card = ConceptCard | ComplexityCard | StepsCard;
export type CardType = Card['type'];

/** SRS 學習進度（一張 Card 對應一筆） */
export interface SRSProgress {
  /** 對應 Card.id */
  cardId: string;
  /** 下次複習時間（Unix epoch 毫秒） */
  nextReviewDate: number;
  /** 當前複習間隔（天） */
  interval: number;
  /** 難易度因子 EF（下限 1.3，預設 2.5） */
  easeFactor: number;
  /** 連續答對次數（答錯歸零） */
  repetitions: number;
  /** 選配：最後複習時間（epoch 毫秒） */
  lastReviewedAt?: number;
  /** 選配：累計複習次數 */
  totalReviews?: number;
  /** 選配：累計逾時次數（逾時不推進排程，只累加此欄位） */
  timeouts?: number;
}

/** 提交給 SRS 的評分：0 答錯、3 勉強答對、5 完美秒殺 */
export type ReviewGrade = 0 | 3 | 5;

/** 單次複習紀錄（統計 / 除錯用） */
export interface ReviewLog {
  cardId: string;
  grade: number;
  reviewedAt: number;
  prevInterval: number;
  nextInterval: number;
  prevEaseFactor: number;
  nextEaseFactor: number;
}
