# 部署指南：LeetCards 上線到 Vercel

本文件說明如何把 LeetCards 從本機推上 GitHub、部署到 Vercel，並在 iPhone 上安裝成離線可用的 App。

---

## 1. 本機確認

```powershell
cd "C:\Users\leolu\OneDrive\Desktop\實驗室\AI\Claude\App\leetcode-flashcards"
npm install
npm run build        # 必須 Exit 0，且輸出中有 "PWA ... files generated  dist/sw.js"
npm run preview      # 選用：在 http://localhost:4173 預覽正式版
```

## 2. 推上 GitHub

倉庫：`leet-cards`（與日語 App 的 `jpn-duo-srs` 完全獨立）。

```powershell
git remote -v                 # 確認 origin 指向 leet-cards
git push -u origin main       # 第一次推送會跳出 GitHub 登入視窗
```

之後每次更新：

```powershell
git add .
git commit -m "feat: 說明這次改了什麼"
git push
```

## 3. 部署到 Vercel

1. 登入 <https://vercel.com>，選 **Add New → Project**。
2. 匯入 GitHub 上的 `leet-cards` 倉庫。
3. 設定會自動從 `vercel.json` 讀取，不需要手動修改：

   | 項目 | 值 |
   |---|---|
   | Framework | Vite |
   | Install Command | `npm ci` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

4. 按 **Deploy**。之後每次 `git push` 到 `main`，Vercel 都會自動重新部署。

### `vercel.json` 做了什麼

| 路徑 | 設定 | 原因 |
|---|---|---|
| `/sw.js`、`/registerSW.js` | `no-cache, no-store` | 確保使用者一定拿到最新的 Service Worker，新版本才能更新 |
| `/manifest.webmanifest` | `no-cache`、正確的 Content-Type | App 名稱與圖示更新能即時生效 |
| `/assets/*` | 快取一年、`immutable` | 檔名帶雜湊值，內容變了檔名就會變，可以放心長期快取 |
| 其他所有路徑 | 回退到 `index.html` | 單頁應用的導覽回退 |

## 4. 在 iPhone 安裝

1. 用 **Safari** 開啟 Vercel 給的網址（例如 `https://leet-cards.vercel.app`）。
2. 點下方「分享」→「加入主畫面」。
3. 從主畫面打開一次，讓 Service Worker 完成預先快取。
4. 驗證離線：開啟飛航模式，從主畫面再打開，應該能正常進入地圖與答題。

> 必須是 HTTPS 網址。用區網 IP（`http://192.168.x.x:5173`）開啟時 Service Worker 不會啟用，無法離線。

## 5. 資料存在哪裡

- 學習進度透過 `@capacitor/preferences` 存取。在瀏覽器與「加入主畫面」的 PWA 中，它使用該網址的 `localStorage`。
- 進度只存在這支手機的這個網址底下：換網址、換手機或清除 Safari 網站資料，進度都會重新開始。
- iOS 對主畫面 App 有獨立的使用天數計數，持續使用就不會被系統清除。
- 日後若用 Capacitor 打包成原生 iOS App（需要 macOS + Xcode），進度會改存在 iOS 的 `UserDefaults`。

## 6. 常見問題

| 狀況 | 處理 |
|---|---|
| 部署後手機還是舊版 | 完全關閉 App 再重開；`registerType: 'autoUpdate'` 會在下次開啟時套用新版 |
| Vercel 建置失敗 | 先在本機跑 `npm run build`，修正型別錯誤後再推送 |
| 推送時要求登入 | 依提示在瀏覽器完成 GitHub 授權；若用 Token，請貼上 Personal Access Token 而不是密碼 |
| 推送被拒絕（rejected） | 確認 GitHub 上的 `leet-cards` 是空倉庫（建立時不要勾選 README / .gitignore / License） |
