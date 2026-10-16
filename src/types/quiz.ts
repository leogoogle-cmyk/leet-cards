// src/types/quiz.ts
// ---------------------------------------------------------------------------
// 題型、答案、關卡狀態的辨別聯合型別（Discriminated Unions）與純函式。
// 主題：LeetCode 觀念閃卡
//
// 新增題型時：
//   1. 新增 interface 並加入 QuizQuestion
//   2. 新增答案 interface 並加入 QuizAnswer
//   3. TIME_LIMIT_SECONDS、QUICK_ANSWER_MS、isAnswerCorrect、describeCorrectAnswer、
//      buildQuestion 與 LessonView 的 QuestionBody 若漏處理，編譯期就會報錯
// ---------------------------------------------------------------------------
import { COMPLEXITY_LADDER, type Card, type Complexity, type Difficulty, type ProblemRef, type ReviewGrade, type Topic } from '../core/types';

/* ===========================================================================
 * 題型
 * ======================================================================== */

interface QuizQuestionBase {
  /** 題目 ID（每關唯一） */
  id: string;
  /** 對應的 SRS 卡片 ID */
  cardId: string;
  topic: Topic;
  difficulty: Difficulty;
  problem?: ProblemRef;
  /** 時限（秒）；null = 不限時 */
  timeLimitSeconds: number | null;
  prompt: string;
  explanation: string;
}

/** 題型 A：觀念四選一 */
export interface ConceptChoiceQuestion extends QuizQuestionBase {
  kind: 'CONCEPT_CHOICE';
  code?: string;
  options: readonly string[];
  correctIndex: number;
}

/** 題型 B：看程式碼判斷時間複雜度 */
export interface ComplexityPickQuestion extends QuizQuestionBase {
  kind: 'COMPLEXITY_PICK';
  code: string;
  options: readonly Complexity[];
  correctIndex: number;
}

/** 題型 C：演算法步驟排序 */
export interface StepOrderQuestion extends QuizQuestionBase {
  kind: 'STEP_ORDER';
  /** 已洗牌的步驟（含干擾步驟） */
  tiles: readonly string[];
  /** 正確順序的步驟 */
  answerSteps: readonly string[];
}

export type QuizQuestion = ConceptChoiceQuestion | ComplexityPickQuestion | StepOrderQuestion;
export type QuizKind = QuizQuestion['kind'];

/* ===========================================================================
 * 答案
 * ======================================================================== */

export interface ConceptChoiceAnswer {
  kind: 'CONCEPT_CHOICE';
  optionIndex: number;
}

export interface ComplexityPickAnswer {
  kind: 'COMPLEXITY_PICK';
  optionIndex: number;
}

export interface StepOrderAnswer {
  kind: 'STEP_ORDER';
  /** 使用者排列順序（tiles 的索引） */
  tileIndexes: readonly number[];
}

export type QuizAnswer = ConceptChoiceAnswer | ComplexityPickAnswer | StepOrderAnswer;

/** 依題型取得對應答案型別，例如 AnswerFor<'STEP_ORDER'> */
export type AnswerFor<K extends QuizKind> = Extract<QuizAnswer, { kind: K }>;

/* ===========================================================================
 * 作答紀錄與關卡狀態（與第一個專案相同，狀態機不需修改）
 * ======================================================================== */

/** perfect = 快速答對、passed = 答對但慢、incorrect = 答錯、timeout = 逾時 */
export type AttemptOutcome = 'perfect' | 'passed' | 'incorrect' | 'timeout';

export interface QuizAttempt {
  questionId: string;
  cardId: string;
  kind: QuizKind;
  outcome: AttemptOutcome;
  /** SM-2 評分；逾時為 null（不推進排程） */
  grade: ReviewGrade | null;
  /** 本題獲得的 XP */
  xp: number;
  /** 逾時為 null */
  answer: QuizAnswer | null;
  /** 答題耗時（毫秒），限時題以時限為上限 */
  responseTimeMs: number;
  /** 作答時間（epoch ms） */
  answeredAt: number;
}

export type FinishReason = 'completed' | 'out_of_hearts';

interface SessionBase {
  questions: readonly QuizQuestion[];
  hearts: number;
  maxHearts: number;
  /** 已按 CONTINUE 提交的紀錄 */
  results: readonly QuizAttempt[];
}

interface ActiveBase extends SessionBase {
  index: number;
  /** 本題開始時間（epoch ms） */
  startedAt: number;
  /** 截止時間（epoch ms）；null = 不限時 */
  deadline: number | null;
}

/**
 * 關卡狀態本身就是辨別聯合型別：
 * pending 只存在於 ANSWER_SUBMITTED 與 TIMEOUT，
 * 在 IDLE / PLAYING / FINISHED 讀取 state.pending 會直接編譯錯誤。
 */
export type QuizState =
  | (SessionBase & { status: 'IDLE' })
  | (ActiveBase & { status: 'PLAYING' })
  | (ActiveBase & { status: 'ANSWER_SUBMITTED'; pending: QuizAttempt })
  | (ActiveBase & { status: 'TIMEOUT'; pending: QuizAttempt })
  | (SessionBase & { status: 'FINISHED'; reason: FinishReason; nextIndex: number });

export type QuizStatus = QuizState['status'];

export type QuizAction =
  | { type: 'START'; questions: readonly QuizQuestion[]; now: number }
  | { type: 'SUBMIT'; answer: QuizAnswer; now: number }
  | { type: 'TIMEOUT'; now: number }
  | { type: 'CONTINUE'; now: number }
  | { type: 'REFILL_HEARTS'; now: number }
  | { type: 'RESET' };

/* ===========================================================================
 * 常數
 * ======================================================================== */

/** 各題型時限（秒）；Record<QuizKind, …> 確保新增題型時必須設定 */
export const TIME_LIMIT_SECONDS: Record<QuizKind, number | null> = {
  CONCEPT_CHOICE: 30,
  COMPLEXITY_PICK: 25,
  STEP_ORDER: 60,
};

/** 在此毫秒數內答對視為「完美秒殺」(grade 5)，否則「勉強答對」(grade 3) */
export const QUICK_ANSWER_MS: Record<QuizKind, number> = {
  CONCEPT_CHOICE: 12_000,
  COMPLEXITY_PICK: 10_000,
  STEP_ORDER: 30_000,
};

/** 每關最多題數 */
export const MAX_LESSON_SIZE = 10;

/** 主題顯示名稱 */
export const TOPIC_LABEL: Record<Topic, string> = {
  'array-hashing': '陣列與雜湊',
  'two-pointers': '雙指標',
  'sliding-window': '滑動視窗',
  stack: '堆疊',
  'binary-search': '二分搜尋',
  'linked-list': '鏈結串列',
  'tree-graph': '樹與圖',
  heap: '堆積',
  'dynamic-programming': '動態規劃',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const OPTION_COUNT = 4;

/* ===========================================================================
 * 純函式
 * ======================================================================== */

/** 窮舉檢查：若有分支未處理，傳入值不是 never，編譯期即報錯 */
export function assertNever(x: never): never {
  throw new Error(`未處理的辨別聯合成員：${JSON.stringify(x)}`);
}

/** 題目時限（毫秒）；null = 不限時 */
export function getTimeLimitMs(question: QuizQuestion): number | null {
  const seconds = question.timeLimitSeconds;
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.round(seconds * 1000);
}

/** 判斷答案是否正確（題型與答案種類不符時一律錯誤） */
export function isAnswerCorrect(question: QuizQuestion, answer: QuizAnswer): boolean {
  switch (question.kind) {
    case 'CONCEPT_CHOICE':
      return answer.kind === 'CONCEPT_CHOICE' && answer.optionIndex === question.correctIndex;
    case 'COMPLEXITY_PICK':
      return answer.kind === 'COMPLEXITY_PICK' && answer.optionIndex === question.correctIndex;
    case 'STEP_ORDER': {
      if (answer.kind !== 'STEP_ORDER') return false;
      const indexes = answer.tileIndexes;
      if (indexes.length !== question.answerSteps.length) return false;
      if (new Set(indexes).size !== indexes.length) return false;
      return indexes.every((tileIndex, position) => question.tiles[tileIndex] === question.answerSteps[position]);
    }
    default:
      return assertNever(question);
  }
}

/** 答對 + 耗時 → SM-2 評分：快速 5、慢 3、答錯 0（快慢門檻依題型） */
export function gradeAttempt(question: QuizQuestion, answer: QuizAnswer, responseTimeMs: number): ReviewGrade {
  if (!isAnswerCorrect(question, answer)) return 0;
  return responseTimeMs <= QUICK_ANSWER_MS[question.kind] ? 5 : 3;
}

/** 評分 → XP：完美 50、勉強 30、答錯或逾時 0 */
export function xpForGrade(grade: ReviewGrade | null): number {
  if (grade === 5) return 50;
  if (grade === 3) return 30;
  return 0;
}

/** 結果卡片上顯示的正確答案與解說 */
export function describeCorrectAnswer(question: QuizQuestion): { main: string; sub: string } {
  switch (question.kind) {
    case 'CONCEPT_CHOICE':
    case 'COMPLEXITY_PICK':
      return { main: question.options[question.correctIndex] ?? '', sub: question.explanation };
    case 'STEP_ORDER':
      return {
        main: question.answerSteps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
        sub: question.explanation,
      };
    default:
      return assertNever(question);
  }
}

/** 草稿是否已可檢查 */
export function isDraftComplete(question: QuizQuestion, draft: QuizAnswer | null): boolean {
  if (draft === null) return false;
  switch (question.kind) {
    case 'CONCEPT_CHOICE':
      return draft.kind === 'CONCEPT_CHOICE';
    case 'COMPLEXITY_PICK':
      return draft.kind === 'COMPLEXITY_PICK';
    case 'STEP_ORDER':
      return draft.kind === 'STEP_ORDER' && draft.tileIndexes.length === question.answerSteps.length;
    default:
      return assertNever(question);
  }
}

/* ===========================================================================
 * 題目產生（Card → QuizQuestion）
 * ======================================================================== */

/** Fisher-Yates 洗牌（回傳新陣列，不改動輸入） */
export function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    if (a === undefined || b === undefined) continue;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

/** 單張卡片 → 題目 */
export function buildQuestion(card: Card, index: number): QuizQuestion {
  const base = {
    id: `${card.id}#${index}`,
    cardId: card.id,
    topic: card.topic,
    difficulty: card.difficulty,
    problem: card.problem,
    prompt: card.prompt,
    explanation: card.explanation,
  };

  switch (card.type) {
    case 'concept': {
      const options = shuffle([card.answer, ...shuffle(card.distractors).slice(0, OPTION_COUNT - 1)]);
      return {
        ...base,
        kind: 'CONCEPT_CHOICE',
        timeLimitSeconds: TIME_LIMIT_SECONDS.CONCEPT_CHOICE,
        code: card.code,
        options,
        correctIndex: options.indexOf(card.answer),
      };
    }
    case 'complexity': {
      // 從複雜度階梯中挑三個干擾項，選項依由快到慢排序，方便比較
      const distractors = shuffle(COMPLEXITY_LADDER.filter((c) => c !== card.answer)).slice(0, OPTION_COUNT - 1);
      const options = [card.answer, ...distractors].sort(
        (a, b) => COMPLEXITY_LADDER.indexOf(a) - COMPLEXITY_LADDER.indexOf(b),
      );
      return {
        ...base,
        kind: 'COMPLEXITY_PICK',
        timeLimitSeconds: TIME_LIMIT_SECONDS.COMPLEXITY_PICK,
        code: card.code,
        options,
        correctIndex: options.indexOf(card.answer),
      };
    }
    case 'steps':
      return {
        ...base,
        kind: 'STEP_ORDER',
        timeLimitSeconds: TIME_LIMIT_SECONDS.STEP_ORDER,
        tiles: shuffle([...card.steps, ...(card.distractorSteps ?? [])]),
        answerSteps: [...card.steps],
      };
    default:
      return assertNever(card);
  }
}

/** 到期卡片 → 一關的題目快照（開始後題目不會因 SRS 更新而變動） */
export function buildLessonQuestions(dueCards: readonly Card[], maxSize: number = MAX_LESSON_SIZE): QuizQuestion[] {
  return dueCards.slice(0, maxSize).map((card, index) => buildQuestion(card, index));
}
