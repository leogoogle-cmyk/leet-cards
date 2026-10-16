# LeetCards · LeetCode 觀念閃卡

Duolingo 風格、可離線運作的 LeetCode 演算法觀念閃卡 PWA。以 SM-2 間隔重複安排複習，題型包含觀念四選一、時間複雜度判斷、演算法步驟排序。

本專案由 [JpnDuoSRS](../frontend) 複用而來：狀態機、計時保護、SRS 引擎、儲存層與 iOS 外殼完全沿用，只替換了資料模型、題庫與題型畫面。

> React 19 · TypeScript · Vite · Tailwind CSS · vite-plugin-pwa · Capacitor Preferences
>
> 部署步驟請見 [DEPLOY.md](./DEPLOY.md)。

---

## 亮點

- **觀念四選一**：每題附對應的 LeetCode 題號與難度，作答後顯示解說，答對答錯都學得到東西。
- **看程式碼判斷複雜度**：答案型別限定為 `O(1)`、`O(log n)`、`O(n)`、`O(n log n)`、`O(n²)`、`O(2ⁿ)` 六種。題庫寫錯（例如打成 `O(N)`）會直接編譯失敗；選項依快慢排序，方便比較。
- **演算法步驟排序**：把二分搜尋、BFS 的步驟排成正確順序，題目會混入干擾步驟，必須真的理解流程才排得對。
- **iOS 背景防護計時器**：倒數條是 GPU 合成的 CSS 動畫；App 切到背景再回來時，用負值 `animation-delay` 從實際經過的時間接著播放，不會因為 iOS 暫停動畫而多送時間。
- **斷網離線、單機運作**：沒有後端伺服器、不需要帳號。題庫打包在 App 內，Service Worker 預先快取所有檔案，學習進度透過 `@capacitor/preferences` 存在手機本機，加入主畫面後開飛航模式也能照常複習。

---

## 題型

| 題型 | 內容 | 時限 | 完美秒殺門檻 |
|---|---|---|---|
| 觀念四選一 | 例如「Two Sum 最適合哪種資料結構？」，可附程式碼 | 30 秒 | 12 秒內 |
| 時間複雜度 | 看程式碼選 O(1) ～ O(2ⁿ) | 25 秒 | 10 秒內 |
| 步驟排序 | 把二分搜尋、BFS 等步驟排成正確順序（混有干擾步驟） | 60 秒 | 30 秒內 |

完美秒殺 +50 XP、答對但慢 +30 XP、答錯或逾時 0 XP 並扣一顆愛心。逾時不推進 SRS 排程。

---

## 從第一個專案沿用的底層

- **GPU 倒數條**：`@keyframes srsTimerShrink` 只動 `transform: scaleX`，倒數期間 React 不重新渲染。
- **iOS 背景暫停防禦**：負值 `animation-delay` 從實際經過時間接著播放，加上一次性備援 `setTimeout` 與截止時間判定。
- **辨別聯合型別狀態機**：`QuizState` 中 `pending` 只存在於 `ANSWER_SUBMITTED` / `TIMEOUT`；拒絕雙擊與逾時後送出。
- **ProgressStore 非同步儲存層**：預設為 `@capacitor/preferences`，可替換為分桶、IndexedDB 或 SQLite。
- **離線 PWA**：Workbox 預先快取所有建置產物，題庫打包在 JS 內，首次載入後飛航模式也能使用。

---

## 快速開始

```powershell
npm install
npm run dev -- --host   # 同一 Wi-Fi 的手機可用 Network 網址連線
npm run build           # 型別檢查 + 產生 dist/（含 Service Worker）
```

> 區網 http 網址無法啟用 Service Worker；離線功能請部署到 HTTPS 後測試。

### 部署到 Vercel

`vercel.json` 已設定好建置指令、輸出目錄、Service Worker 不快取、`/assets` 長期快取與 SPA 導覽回退。在 Vercel 匯入 repo 後直接部署即可，部署後用 iPhone Safari →「分享」→「加入主畫面」。

---

## 新增卡片

編輯 `src/core/leetcodeSeed.ts`，`id` 必須穩定唯一：

```ts
// 觀念題
{ id: 'lc-concept-0009', type: 'concept', topic: 'two-pointers', difficulty: 'medium',
  problem: { number: 15, title: '3Sum' },
  prompt: '3Sum 在排序後，固定一個數，剩下兩數用什麼技巧找？',
  answer: '左右雙指標', distractors: ['二分搜尋每一對', '雜湊表存所有三元組', '回溯法'],
  explanation: '排序後固定 nums[i]，用左右指標依和的大小往中間靠攏，整體 O(n²)。' },

// 複雜度題（answer 必須是 COMPLEXITY_LADDER 其中之一）
{ id: 'lc-complexity-0007', type: 'complexity', topic: 'heap', difficulty: 'medium',
  prompt: '把 n 個元素逐一 push 進堆積，時間複雜度是？',
  code: 'for x in nums:\n    heapq.heappush(h, x)', answer: 'O(n log n)',
  explanation: '每次 push 為 O(log n)，共 n 次。' },
```

## 新增題型

1. `src/core/types.ts`：在 `Card` 聯合型別加入新的卡片型別。
2. `src/types/quiz.ts`：在 `QuizQuestion`、`QuizAnswer` 加入新成員，並補上 `TIME_LIMIT_SECONDS`、`QUICK_ANSWER_MS`。
3. 執行 `npm run build`：編譯器會列出所有尚未處理新題型的 `switch`（`isAnswerCorrect`、`describeCorrectAnswer`、`buildQuestion`、`LessonView` 的 `QuestionBody` 等），逐一補上即可。

---

## 專案結構

```
src/
├── App.tsx                    # 畫面切換與 XP 累計
├── components/
│   ├── HomeMapView.tsx        # 關卡地圖、XP 數字滾動
│   └── LessonView.tsx         # iOS 外殼、倒數條、三種題型畫面、結果卡片
├── hooks/
│   ├── useQuizEngine.ts       # 關卡狀態機與計時保護（與第一個專案相同）
│   └── useSRS.tsx             # SRS Context（與第一個專案相同）
├── types/
│   └── quiz.ts                # 題型／答案／狀態型別、評分、題目產生
└── core/
    ├── types.ts               # Card（辨別聯合型別）、SRSProgress
    ├── srsEngine.ts           # SM-2（與第一個專案相同）
    ├── progressStore.ts       # 儲存層（只改了儲存 key）
    └── leetcodeSeed.ts        # 範例題庫（16 張）
```

## 授權

尚未指定授權條款。公開到 GitHub 前，請先選擇授權並新增 `LICENSE` 檔案。
