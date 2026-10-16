// src/components/LessonView.tsx
// ---------------------------------------------------------------------------
// LeetCode 觀念閃卡關卡：useQuizEngine（狀態機）+ useSRS（SM-2）+ iOS 外殼。
//
// 外殼沿用第一個專案：
// - IDLE 預熱畫面：按下「開始」才計時
// - 倒數條：純 CSS @keyframes srsTimerShrink（transform: scaleX，GPU 合成）+ onAnimationEnd
//   以負的 animation-delay 從「實際已經過的時間」接著播放；App 從背景回來時重新掛載即可對時
// - 安全區域：頂部 env(safe-area-inset-top)、底部 env(safe-area-inset-bottom)
// 題型畫面：觀念四選一、時間複雜度判斷、演算法步驟排序
// ---------------------------------------------------------------------------
import { useCallback, useState } from 'react';
import type { AnimationEvent, ReactNode } from 'react';
import { useSRS } from '../hooks/useSRS';
import { useQuizEngine } from '../hooks/useQuizEngine';
import {
  DIFFICULTY_LABEL,
  MAX_LESSON_SIZE,
  TOPIC_LABEL,
  assertNever,
  buildLessonQuestions,
  describeCorrectAnswer,
  isDraftComplete,
  type ComplexityPickQuestion,
  type ConceptChoiceQuestion,
  type QuizAnswer,
  type QuizAttempt,
  type QuizQuestion,
  type StepOrderQuestion,
} from '../types/quiz';

// ===========================================================================
// 型別與常數
// ===========================================================================
interface LessonViewProps {
  /** 離開關卡時呼叫，回傳「本次關卡已提交的總 XP」 */
  onExit?: (earnedXp: number) => void;
}

const INITIAL_LIVES = 5;

// ===========================================================================
// 工具函式
// ===========================================================================
/** 條件式 className 拼接 */
const cx = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');

/** iOS WebKit 需要 touchstart 監聽器，:active 樣式才會在實機觸發 */
const noopTouch = (): void => undefined;

// ===========================================================================
// 小元件
// ===========================================================================
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx('h-5 w-5', className)} fill="currentColor" aria-hidden="true">
      <path d="M12 21s-6.7-4.35-9.33-8.02C.9 10.6 1.9 6.5 5.2 5.5c2-.6 4 .2 5.2 1.9 1.2-1.7 3.2-2.5 5.2-1.9 3.3 1 4.3 5.1 2.53 7.48C18.7 16.65 12 21 12 21z" />
    </svg>
  );
}

/** 3D 大按鈕 */
function BigButton({
  tone,
  disabled = false,
  onClick,
  children,
}: {
  tone: 'green' | 'red';
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onTouchStart={noopTouch}
      className={cx(
        'w-full rounded-2xl border-b-4 py-4 text-center text-lg font-extrabold uppercase tracking-widest',
        'touch-manipulation transition-all duration-150 [-webkit-tap-highlight-color:transparent]',
        disabled
          ? 'cursor-not-allowed border-neutral-300 bg-neutral-200 text-neutral-400'
          : tone === 'green'
            ? 'border-green-600 bg-green-500 text-white active:translate-y-[2px] active:border-b-2'
            : 'border-red-600 bg-red-500 text-white active:translate-y-[2px] active:border-b-2',
      )}
    >
      {children}
    </button>
  );
}

/** 題目標頭：主題、難度、對應的 LeetCode 題號 */
function QuestionMeta({ question }: { question: QuizQuestion }) {
  const difficultyTone =
    question.difficulty === 'easy'
      ? 'bg-teal-50 text-teal-700'
      : question.difficulty === 'medium'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-700';
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold">
      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{TOPIC_LABEL[question.topic]}</span>
      <span className={cx('rounded-full px-2.5 py-1', difficultyTone)}>{DIFFICULTY_LABEL[question.difficulty]}</span>
      {question.problem && (
        <span className="text-neutral-400">
          #{question.problem.number} {question.problem.title}
        </span>
      )}
    </div>
  );
}

/** 程式碼區塊：等寬字、可橫向捲動，不撐破版面 */
function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-2xl bg-neutral-900 p-4 text-[13px] leading-relaxed text-neutral-100">
      <code className="font-mono">{code}</code>
    </pre>
  );
}

/** 選項按鈕（作答後標示正解與選錯的選項） */
function OptionButton({
  label,
  selected,
  locked,
  isCorrect,
  mono = false,
  onClick,
}: {
  label: string;
  selected: boolean;
  locked: boolean;
  isCorrect: boolean;
  mono?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      onTouchStart={noopTouch}
      className={cx(
        'w-full rounded-2xl border-2 border-b-4 px-5 py-4 text-left text-base font-semibold transition-all duration-150',
        mono && 'text-center font-mono text-lg',
        locked && isCorrect
          ? 'border-green-500 border-b-green-600 bg-green-50 text-green-700'
          : locked && selected
            ? 'border-red-400 border-b-red-500 bg-red-50 text-red-600'
            : selected
              ? 'translate-y-[2px] border-sky-500 border-b-sky-600 bg-sky-50 text-sky-700'
              : 'border-neutral-200 border-b-neutral-300 bg-white text-neutral-800 active:translate-y-[2px]',
      )}
    >
      {label}
    </button>
  );
}

// ===========================================================================
// GPU 倒數條（第一層計時保護）
// ===========================================================================
interface TimerBarProps {
  durationMs: number;
  startedAt: number;
  running: boolean;
  onExpire: () => void;
}

/**
 * - 掛載時計算「已經過的時間」，以負的 animation-delay 從該進度開始播放
 * - 父層以 key={題目ID:timerEpoch} 掛載；App 回到前景時 timerEpoch 遞增 → 重新掛載 → 重新對時
 * - 作答後 animation-play-state: paused，畫面凍結在作答當下
 * - React 不逐幀更新任何 state
 */
function TimerBar({ durationMs, startedAt, running, onExpire }: TimerBarProps) {
  const [elapsedAtMount] = useState(() => Math.min(durationMs, Math.max(0, Date.now() - startedAt)));

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>): void => {
    if (event.animationName === 'srsTimerShrink') onExpire();
  };

  return (
    <div
      role="timer"
      aria-label={`限時 ${Math.round(durationMs / 1000)} 秒`}
      className="mx-4 h-2 overflow-hidden rounded-full bg-neutral-100"
    >
      <div
        className="h-full w-full origin-left rounded-full bg-red-500 will-change-transform"
        style={{
          animationName: 'srsTimerShrink',
          animationDuration: `${durationMs}ms`,
          animationTimingFunction: 'linear',
          animationFillMode: 'forwards',
          animationDelay: `-${elapsedAtMount}ms`,
          animationPlayState: running ? 'running' : 'paused',
        }}
        onAnimationEnd={handleAnimationEnd}
      />
    </div>
  );
}

// ===========================================================================
// 題型畫面
// ===========================================================================
interface BodyProps<Q extends QuizQuestion> {
  question: Q;
  draft: QuizAnswer | null;
  locked: boolean;
  onChange: (answer: QuizAnswer | null) => void;
}

function ConceptChoiceBody({ question, draft, locked, onChange }: BodyProps<ConceptChoiceQuestion>) {
  const selected = draft?.kind === 'CONCEPT_CHOICE' ? draft.optionIndex : null;
  return (
    <section>
      <QuestionMeta question={question} />
      <p className="mt-4 text-xl font-bold leading-snug text-neutral-800">{question.prompt}</p>
      {question.code && <CodeBlock code={question.code} />}
      <div className="mt-6 grid grid-cols-1 gap-3">
        {question.options.map((option, index) => (
          <OptionButton
            key={question.id + '-' + index}
            label={option}
            selected={selected === index}
            locked={locked}
            isCorrect={index === question.correctIndex}
            onClick={() => onChange({ kind: 'CONCEPT_CHOICE', optionIndex: index })}
          />
        ))}
      </div>
    </section>
  );
}

function ComplexityPickBody({ question, draft, locked, onChange }: BodyProps<ComplexityPickQuestion>) {
  const selected = draft?.kind === 'COMPLEXITY_PICK' ? draft.optionIndex : null;
  return (
    <section>
      <QuestionMeta question={question} />
      <p className="mt-4 text-xl font-bold leading-snug text-neutral-800">{question.prompt}</p>
      <CodeBlock code={question.code} />
      <div className="mt-6 grid grid-cols-2 gap-3">
        {question.options.map((option, index) => (
          <OptionButton
            key={question.id + '-' + index}
            label={option}
            mono
            selected={selected === index}
            locked={locked}
            isCorrect={index === question.correctIndex}
            onClick={() => onChange({ kind: 'COMPLEXITY_PICK', optionIndex: index })}
          />
        ))}
      </div>
    </section>
  );
}

function StepOrderBody({ question, draft, locked, onChange }: BodyProps<StepOrderQuestion>) {
  const placed: readonly number[] = draft?.kind === 'STEP_ORDER' ? draft.tileIndexes : [];
  const placedSet = new Set(placed);
  const full = placed.length >= question.answerSteps.length;

  const place = (tileIndex: number): void => {
    if (full) return;
    onChange({ kind: 'STEP_ORDER', tileIndexes: [...placed, tileIndex] });
  };
  const removeAt = (position: number): void => {
    const next = placed.filter((_, i) => i !== position);
    onChange(next.length === 0 ? null : { kind: 'STEP_ORDER', tileIndexes: next });
  };

  return (
    <section>
      <QuestionMeta question={question} />
      <p className="mt-4 text-xl font-bold leading-snug text-neutral-800">{question.prompt}</p>
      <p className="mt-1 text-sm text-neutral-400">
        共 {question.answerSteps.length} 步{question.tiles.length > question.answerSteps.length ? '，其中混有干擾步驟' : ''}
      </p>

      {/* 已排好的步驟 */}
      <ol className="mt-5 flex min-h-[4.5rem] flex-col gap-2 rounded-2xl border-2 border-dashed border-neutral-200 p-3">
        {placed.map((tileIndex, position) => (
          <li key={'placed-' + position + '-' + tileIndex}>
            <button
              type="button"
              disabled={locked}
              onClick={() => removeAt(position)}
              onTouchStart={noopTouch}
              className="flex w-full animate-srsPop items-start gap-3 rounded-xl border-2 border-b-4 border-sky-300 border-b-sky-400 bg-white px-3 py-2 text-left text-sm font-semibold text-neutral-800 active:translate-y-[2px]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-black text-white">
                {position + 1}
              </span>
              <span className="min-w-0">{question.tiles[tileIndex]}</span>
            </button>
          </li>
        ))}
        {placed.length === 0 && <li className="px-2 py-2 text-sm text-neutral-300">依序點選下方步驟</li>}
      </ol>

      {/* 待選步驟 */}
      <div className="mt-5 flex flex-col gap-2">
        {question.tiles.map((tile, tileIndex) => {
          const used = placedSet.has(tileIndex);
          return (
            <button
              key={'tile-' + tileIndex}
              type="button"
              disabled={locked || used || full}
              onClick={() => place(tileIndex)}
              onTouchStart={noopTouch}
              className={cx(
                'w-full rounded-xl border-2 border-b-4 px-4 py-3 text-left text-sm font-semibold transition-all duration-150',
                used
                  ? 'border-neutral-200 border-b-neutral-200 bg-neutral-100 text-neutral-300'
                  : 'border-neutral-200 border-b-neutral-300 bg-white text-neutral-800 active:translate-y-[2px] disabled:active:translate-y-0',
              )}
            >
              {tile}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** 題型分派：完全窮舉，新增題型未處理時編譯期報錯 */
function QuestionBody({ question, draft, locked, onChange }: BodyProps<QuizQuestion>) {
  switch (question.kind) {
    case 'CONCEPT_CHOICE':
      return <ConceptChoiceBody question={question} draft={draft} locked={locked} onChange={onChange} />;
    case 'COMPLEXITY_PICK':
      return <ComplexityPickBody question={question} draft={draft} locked={locked} onChange={onChange} />;
    case 'STEP_ORDER':
      return <StepOrderBody question={question} draft={draft} locked={locked} onChange={onChange} />;
    default:
      return assertNever(question);
  }
}

// ===========================================================================
// 結果卡片（由下往上滑出）
// ===========================================================================
function ResultSheet({
  attempt,
  question,
  onContinue,
}: {
  attempt: QuizAttempt;
  question: QuizQuestion;
  onContinue: () => void;
}) {
  const correct = attempt.outcome === 'perfect' || attempt.outcome === 'passed';
  const answer = describeCorrectAnswer(question);

  return (
    <div
      role="status"
      className={cx(
        'max-h-[70vh] w-full animate-srsSlideUp overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5',
        correct ? 'bg-green-100' : 'bg-red-100',
      )}
    >
      {correct ? (
        <div className="mb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 animate-srsPop items-center justify-center rounded-full bg-green-500 text-2xl font-black text-white">
              ✓
            </span>
            <span className="text-2xl font-extrabold text-green-700">
              {attempt.outcome === 'perfect' ? '太棒了！' : '勉強答對！'}
            </span>
            <span className="ml-auto text-lg font-extrabold text-green-600">+{attempt.xp} XP</span>
          </div>
          <p className="mt-3 text-sm text-green-800">{answer.sub}</p>
        </div>
      ) : (
        <div className="mb-3">
          <p className="text-lg font-extrabold text-red-600">
            {attempt.outcome === 'timeout' ? '時間到！正確解答：' : '正確解答：'}
          </p>
          <p className="mt-1 whitespace-pre-line text-base font-bold text-red-700">{answer.main}</p>
          <p className="mt-2 text-sm text-red-600">{answer.sub}</p>
        </div>
      )}

      <BigButton tone={correct ? 'green' : 'red'} onClick={onContinue}>
        繼續 Continue
      </BigButton>
    </div>
  );
}

// ===========================================================================
// 主元件
// ===========================================================================
export default function LessonView({ onExit }: LessonViewProps) {
  const { dueCards, isLoaded, recordAttempt, saveError } = useSRS();

  // CONTINUE 時把結果交給 SRS：逾時不推進排程，其餘交給 SM-2
  const handleCommit = useCallback(
    (attempt: QuizAttempt) => {
      recordAttempt(
        attempt.cardId,
        attempt.grade === null ? { kind: 'timeout' } : { kind: 'graded', grade: attempt.grade },
      );
    },
    [recordAttempt],
  );

  const engine = useQuizEngine({ maxHearts: INITIAL_LIVES, onCommit: handleCommit });
  const { state, currentQuestion, timer } = engine;

  // 草稿綁定題目 ID：換題時自動失效
  const [draft, setDraft] = useState<{ questionId: string; answer: QuizAnswer } | null>(null);
  const currentDraft =
    currentQuestion !== null && draft !== null && draft.questionId === currentQuestion.id ? draft.answer : null;

  const handleDraftChange = useCallback(
    (answer: QuizAnswer | null) => {
      if (currentQuestion === null) return;
      setDraft(answer === null ? null : { questionId: currentQuestion.id, answer });
    },
    [currentQuestion],
  );

  // IDLE：按下「開始」→ 建立題目快照並開始計時
  const handleStart = useCallback(() => {
    engine.start(buildLessonQuestions(dueCards));
  }, [dueCards, engine]);

  const handleCheck = useCallback(() => {
    if (currentQuestion !== null && currentDraft !== null && isDraftComplete(currentQuestion, currentDraft)) {
      engine.submit(currentDraft);
    }
  }, [currentQuestion, currentDraft, engine]);

  // 離開關卡：只回傳已按 CONTINUE 提交的 XP
  const finish = useCallback(() => {
    onExit?.(engine.earnedXp);
  }, [onExit, engine.earnedXp]);

  // =========================================================================
  // 載入中
  // =========================================================================
  if (!isLoaded) {
    return <div className="flex min-h-screen items-center justify-center bg-white text-neutral-400">載入中…</div>;
  }

  // =========================================================================
  // IDLE：預熱畫面
  // =========================================================================
  if (state.status === 'IDLE') {
    if (dueCards.length === 0) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
          <span className="text-6xl">🎉</span>
          <h1 className="text-2xl font-extrabold text-neutral-800">今天沒有待複習的卡片</h1>
          <p className="text-neutral-500">所有卡片都還沒到期，明天再來吧。</p>
          <div className="mt-2 w-full max-w-xs">
            <BigButton tone="green" onClick={finish}>
              返回
            </BigButton>
          </div>
        </div>
      );
    }

    const count = Math.min(dueCards.length, MAX_LESSON_SIZE);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-white px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] text-center">
        <span className="flex h-24 w-24 animate-srsPop items-center justify-center rounded-full border-b-[6px] border-[#46a302] bg-[#58cc02] font-mono text-3xl font-black text-white">
          {'</>'}
        </span>
        <h1 className="text-3xl font-extrabold text-neutral-800">準備好了嗎？</h1>
        <p className="max-w-xs text-neutral-500">
          本關共 {count} 題：觀念題 30 秒、複雜度題 25 秒、步驟排序 60 秒。按下開始後才會開始計時。
        </p>
        <div className="w-full max-w-xs">
          <BigButton tone="green" onClick={handleStart}>
            開始 Start
          </BigButton>
        </div>
        <button type="button" onClick={finish} className="text-sm font-semibold text-neutral-400 underline">
          返回地圖
        </button>
      </div>
    );
  }

  // =========================================================================
  // FINISHED：完成 / 愛心用完
  // =========================================================================
  if (state.status === 'FINISHED') {
    const correctCount = state.results.filter((r) => r.outcome === 'perfect' || r.outcome === 'passed').length;

    if (state.reason === 'out_of_hearts') {
      const canRefill = state.nextIndex < state.questions.length;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-white px-6 text-center">
          <HeartIcon className="h-16 w-16 animate-srsPop text-red-500" />
          <h1 className="text-2xl font-extrabold text-neutral-800">愛心用完了！</h1>
          <p className="max-w-xs text-neutral-500">
            答錯的卡片明天會再出現。目前已獲得 {engine.earnedXp} XP。
          </p>
          {canRefill && (
            <div className="w-full max-w-xs">
              <BigButton tone="green" onClick={engine.refillHearts}>
                補充愛心 ❤ {INITIAL_LIVES}
              </BigButton>
            </div>
          )}
          <button type="button" onClick={finish} className="text-sm font-semibold text-neutral-400 underline">
            帶著 {engine.earnedXp} XP 離開
          </button>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <span className="animate-srsPop text-6xl">🎉</span>
        <h1 className="text-2xl font-extrabold text-neutral-800">今日複習完成！</h1>
        <p className="text-neutral-500">
          答對 {correctCount} / {state.results.length} 題
        </p>
        <p className="text-3xl font-extrabold text-amber-500">+{engine.earnedXp} XP</p>
        <div className="mt-2 w-full max-w-xs">
          <BigButton tone="green" onClick={finish}>
            返回地圖
          </BigButton>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 作答中（PLAYING / ANSWER_SUBMITTED / TIMEOUT）
  // =========================================================================
  if (currentQuestion === null) {
    return null;
  }

  const locked = state.status !== 'PLAYING';
  const progressPct = Math.min(100, engine.progress * 100);

  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      {/* 頂部導覽列（避開瀏海） */}
      <header className="flex items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={finish}
          onTouchStart={noopTouch}
          aria-label="關閉"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-neutral-400 active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {/* 綠色發光進度條（width + transition-all duration-500） */}
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.85)] transition-all duration-500 ease-out"
            style={{ width: progressPct + '%' }}
          />
        </div>

        {/* 紅愛心與生命值（數字變動時彈跳） */}
        <div
          key={state.hearts}
          className="flex shrink-0 animate-srsPop items-center gap-1 text-red-500"
          aria-label={`剩餘 ${state.hearts} 顆愛心`}
        >
          <HeartIcon />
          <span className="text-base font-extrabold">{state.hearts}</span>
        </div>
      </header>

      {/* 限時倒數條：key 含 timerEpoch，App 回到前景時重新掛載並對時 */}
      {timer !== null && (
        <TimerBar
          key={timer.questionId + ':' + engine.timerEpoch}
          durationMs={timer.durationMs}
          startedAt={timer.startedAt}
          running={state.status === 'PLAYING'}
          onExpire={engine.notifyTimerEnd}
        />
      )}

      {/* 題目區 */}
      <main className="flex-1 overflow-y-auto px-4 pb-72">
        {saveError !== null && (
          <p role="alert" className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-800">
            進度未能寫入手機：{saveError}
          </p>
        )}
        <QuestionBody
          key={currentQuestion.id}
          question={currentQuestion}
          draft={currentDraft}
          locked={locked}
          onChange={handleDraftChange}
        />
      </main>

      {/* 底部固定區（避開 Home Indicator） */}
      <div className="fixed bottom-0 left-0 w-full">
        {state.status === 'PLAYING' ? (
          <div className="border-t border-neutral-200 bg-white px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
            <BigButton
              tone="green"
              disabled={!isDraftComplete(currentQuestion, currentDraft)}
              onClick={handleCheck}
            >
              檢查答案 Check
            </BigButton>
          </div>
        ) : (
          <ResultSheet
            key={state.pending.questionId}
            attempt={state.pending}
            question={currentQuestion}
            onContinue={engine.continueLesson}
          />
        )}
      </div>
    </div>
  );
}
