# AI 校園情緒關懷系統 — 工程整合與安全性說明

## 系統架構與核心調整

1. **心心 AI 自然對話升級與高風險處置**
   - 後端 `src/server/app.ts` 改為使用 `@google/genai` 呼叫 `gemini-4-hydrogen`（啟用 `ThinkingLevel.LOW` 與結構化 JSON `responseSchema`），移除制式安慰模板與重複的 `history` 最後一則訊息。
   - 明確區分「學生每日簽到心情 (`selfReportedMood`)」與「模型從對話推斷之情緒 (`modelDetectedEmotion`)」，並支援 9 種情境分類（含一般聊天、開心成就、同學衝突、疑似霸凌、家庭困擾、課業壓力、生氣挫折、暴力傷害他人、自傷緊急危險）。
   - 偵測到 `elevated` / `critical` 高風險時，後端透過已驗證的身分權杖寫入 `crisis_alerts` 集合；`teacherNotified` 僅於資料庫寫入確認成功後才為 `true`。API 失敗時誠實回傳 `503` / `429` 並由前端顯示明確系統通知卡，不假冒 AI 回覆。

2. **正式雲端模式與離線沙盒模式嚴格隔離**
   - `src/context/AppContext.tsx` 區分 `'cloud'` 與 `'sandbox'` 模式：正式模式初始資料為空，等待 Firebase Auth 驗證與使用者角色載入完成後才啟動最小權限即時監聽（學生僅讀取本人資料，教師僅讀取自己負責 `classId` 的資料），登出時清除所有私人資料與狀態。
   - 新增/編輯/刪除與簽到/關懷筆記均等待 Firestore 或後端 API 確認才更新畫面狀態，失敗時明確呈現錯誤並保留既有狀態。
   - 每日心情簽到採用 `${uid}_${taiwanDate}` 作為唯一文件 ID，所有時間與日期統一使用 `Asia/Taipei` 時區，寫入前透過 `stripUndefined()` 過濾 `undefined` 欄位。

3. **Vercel Serverless 與全端部署架構**
   - `src/server/app.ts` 匯出 `createApp()`，`server.ts` 僅在非 Vercel 環境啟動本地監聽，`api/index.ts` 與 `vercel.json` 提供 Vercel Serverless API 路由與 SPA fallback。

---

# Security Summary

- **身分驗證與管理員授權邊界**：移除前端與 `firestore.rules` 中的硬編碼管理員信箱與角色字串猜測邏輯；改為使用 `/admins/{uid}`、`/system/admin_bootstrap` 原子化首次認領機制與伺服器端 `ADMIN_BOOTSTRAP_EMAILS` 白名單，並要求已驗證信箱（`email_verified == true`）與啟用中帳號（`status != 'disabled'`）。
- **後端 API 權杖驗證與配額防護**：`POST /api/gemini/chat`、`POST /api/gemini/summarize-student`、`GET /api/admin/usage`、`GET /api/auth/bootstrap-status` 與 `/api/admin/users/*` 皆透過 `jose` 使用 Google Firebase JWKS 進行密碼學 ID Token 簽章與簽發者/受眾驗證；停用帳號立即於中介層攔截回傳 `403`。AI 對話端點實施單則 600 字元上限、每分鐘 12 次與每日 60 次配額限制，以及管理員端 Token 用量監控。
- **Firestore 最小權限與防竄改規則**：已部署更新後之 `firestore.rules`，限制學生僅能修改自身檔案的 `name`、`avatar`、`updatedAt`（禁止竄改 `role`、`classId`、`status` 等敏感欄位）；教師僅能存取自己負責 `classId` 的學生、心情紀錄、關懷筆記、對話紀錄與緊急通報；`chat_messages` 與 `chat_access_logs` 禁止一般使用者修改或刪除。
- **金鑰與機密管理**：`GEMINI_API_KEY` 與選用的 `FIREBASE_SERVICE_ACCOUNT_JSON` 僅限伺服器端環境變數讀取，未暴露於前端程式碼或 `.env.example`。

## PoC Verification

| 檢查項目 | 驗證方式與實際執行結果 |
| --- | --- |
| TypeScript 型別檢查與前端建置 | 執行 `tsc --noEmit`（`lint_applet`）與 `npm run build`（`compile_applet`），兩者皆以 exit code `0` 通過，無型別或建置錯誤。 |
| Firestore 安全規則部署 | 透過 `deploy_firebase` 成功將更新後的 `/firestore.rules` 部署至專案 `sylvan-micron-jh7nb`（資料庫 `ai-studio-ai-62389f36-8f91-4821-9d2a-946437846fb2`）。 |
| 後端服務與金鑰載入確認 | 呼叫 `GET http://localhost:3000/api/health` 回傳 HTTP `200`：`{"status":"ok","model":"gemini-4-hydrogen","hasGeminiKey":true,"adminSdkReady":false}`。 |
| 未驗證 API 存取阻擋 | 使用 `curl` 在無 Bearer Token 下測試 `POST /api/gemini/chat`、`GET /api/admin/usage`、`POST /api/admin/users`，三者皆正確回傳 HTTP `401 Unauthorized`。 |
| 敏感字串與金鑰殘留掃描 | 於 `src/`、`api/`、`firestore.rules`、`server.ts` 執行關鍵字與私鑰特徵掃描，無硬編碼管理員信箱、Google API Key 或私鑰殘留。 |
| Gemini 10 情境即時實測限制說明 | 因運行環境安全隔離設計，`GEMINI_API_KEY` 僅注入於 Port 3000 後端服務行程而未注入命令列子行程，且 `/api/gemini/chat` 強制要求有效 Firebase ID Token；因此「10 種情境實際 Gemini API 回覆品質」需於前端登入真實校園帳號後透過瀏覽器對話實測確認。 |
