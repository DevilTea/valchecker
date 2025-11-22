# JIT 模式支援討論

## 摘要

本文件討論如何在 valchecker 中實作 JIT (Just-In-Time) 編譯模式，以優化頻繁執行的 schema 驗證效能。

## 當前架構分析

### 執行模式

目前 valchecker 使用**解釋器模式**：

```typescript
// 定義階段：建立 runtimeSteps 陣列
const schema = v.string()
	.toTrimmed()
	.min(3)

// 執行階段：迴圈執行所有步驟
schema.execute('hello')
// → 在 createPipeExecutor 中遍歷 runtimeSteps
```

**優點**：
- 靈活、可組合
- 易於除錯和理解
- 支援動態 async/sync 偵測

**瓶頸**：
- 函式呼叫開銷
- 陣列迭代開銷
- 每次執行都進行動態型別檢查
- Error handling wrapper 的 try-catch 開銷

## JIT 模式概念

JIT 模式將驗證管線**預編譯**成優化的執行函式，消除：
- Proxy 存取開銷
- 陣列迭代開銷
- 步驟間的函式邊界
- 重複的型別檢查

## 實作策略比較

### 策略 1：使用 `new Function()` 生成程式碼

```typescript
// 輸入
const schema = v.string()
	.toTrimmed()
	.min(3)

// 生成並編譯
const compiled = new Function('value', 'helpers', `
	if (typeof value !== 'string') {
		return helpers.failure(...);
	}
	value = value.trim();
	if (value.length < 3) {
		return helpers.failure(...);
	}
	return helpers.success(value);
`)
```

**優點**：效能最佳、可內聯所有操作
**缺點**：CSP 環境不可用、除錯困難、實作複雜

### 策略 2：惰性編譯（Lazy Compilation）

```typescript
class CompiledSchema {
	execute(value: unknown) {
		this._executionCount++

		// 前 N 次使用解釋器
		if (this._executionCount < THRESHOLD) {
			return this._interpreterExecute(value)
		}

		// 達到閾值後編譯
		if (!this._compiledExecute) {
			this._compiledExecute = this._compile()
		}

		return this._compiledExecute(value)
	}
}
```

**優點**：自動優化熱路徑、漸進式效能改善
**缺點**：前幾次執行仍慢、記憶體開銷

### 策略 3：AOT 編譯 API

```typescript
// 使用者明確要求編譯
const schema = v.string()
	.toTrimmed()
	.min(3)
	.compile()

// 使用編譯版本
const result = schema.execute(userInput)
```

**優點**：明確控制、清晰的效能預期、無破壞性變更
**缺點**：需要使用者意識和操作

### 策略 4：混合式解釋器（快速路徑）

```typescript
function createPipeExecutor(runtimeSteps) {
	const pattern = analyzeStepsPattern(runtimeSteps)

	if (pattern === 'simple-string-validation') {
		return createFastStringValidator(runtimeSteps)
	}

	// 回退到一般解釋器
	return createGeneralExecutor(runtimeSteps)
}
```

**優點**：無 API 變更、自動優化常見模式
**缺點**：優化範圍有限、需維護雙重程式碼路徑

## 建議方案：分階段實作

### 階段 1：基礎優化（低風險、高價值）

1. **優化現有 `createPipeExecutor`**
   - 使用 monomorphic patterns
   - 減少閉包分配
   - 預分配結果物件

2. **為常見原始型別添加快速路徑**
   - 單步驟 schema 的特殊處理（如 `v.string()`）
   - 常見鏈的優化（如 `string + trim + min`）

3. **效能基準測試**
   - 建立各種 schema 模式的 benchmarks
   - 識別真實瓶頸

### 階段 2：明確編譯 API（中風險、高價值）

1. **添加 `.compile()` 方法**
   ```typescript
   interface Schema {
   	compile: (options?: CompileOptions) => CompiledSchema
   }
   ```

2. **實作程式碼生成**
   - 從同步 schema 開始
   - 使用 `new Function()` 生成優化函式
   - 處理簡單的轉換和檢查

3. **提供配置選項**
   ```typescript
   const compiled = schema.compile({
   	mode: 'fast', // 或 'debug'
   	inline: true, // 內聯簡單操作
   })
   ```

### 階段 3：自動編譯（高風險、高價值）

1. **添加自動偵測**
   - 追蹤執行次數
   - 達到閾值後自動編譯

2. **實作去優化機制**
   - 處理編譯版本無法執行的情況
   - 優雅地回退到解釋器

## 技術考量

### 型別安全
- 編譯後的 schema 必須保持完整的 TypeScript 型別推斷
- 返回型別必須與解釋器模式完全匹配

### 非同步處理
- async 步驟較難高效編譯
- 可能需要初期排除 async schema
- 或使用 `new AsyncFunction()` 生成程式碼

### 記憶體管理
- 編譯函式增加記憶體使用
- 需要清晰的快取淘汰策略
- 考慮使用 WeakMap 讓未使用的編譯 schema 自動 GC

### CSP（內容安全政策）
- `new Function()` 在某些環境中違反 CSP
- 需要回退到解釋器模式
- 文件化 CSP 考量

### 錯誤訊息
- 編譯程式碼必須產生相同的錯誤訊息
- 需要將訊息解析邏輯打包進編譯函式

### 除錯
- 為編譯函式提供 source maps 或除錯資訊
- 添加選項在開發環境中停用編譯
- 考慮 `.compile({ debug: true })` 保持可讀程式碼

## V8 引擎優化對齊

基於專案中的效能指南，JIT 編譯應利用：

1. **Monomorphic 操作**：保持物件 shape 一致
2. **Inline Caching**：生成 V8 IC 可優化的程式碼
3. **Hidden Classes**：以一致的 shape 初始化結果物件
4. **Array Element Kinds**：預分配正確型別的陣列
5. **避免去優化**：保持編譯函式的型別穩定

## 使用者遷移路徑

### 無破壞性變更
- 現有程式碼無需修改即可繼續工作
- 效能改進初期為選擇性加入
- 可在未來主要版本中變為自動

### 選擇性編譯
```typescript
// 明確編譯以獲得最佳效能
const schema = v.string()
	.toTrimmed()
	.min(3)
const compiled = schema.compile()
const result = compiled.execute(userInput)
```

### Valchecker 層級配置
```typescript
const v = createValchecker({
	steps: allSteps,
	jit: {
		enabled: true,
		threshold: 10, // 執行 10 次後編譯
		mode: 'auto', // 或 'explicit'
	},
})
```

## 測試策略

1. **功能等價性測試**
   - 所有現有測試在啟用 JIT 後必須通過
   - 編譯 schema 必須產生與解釋器相同的結果

2. **效能基準測試**
   - 測量編譯開銷
   - 比較執行速度：解釋器 vs 編譯
   - 測試各種 schema 複雜度

3. **記憶體測試**
   - 監控編譯函式記憶體使用
   - 測試快取淘汰
   - 測量 GC 影響

4. **邊緣案例**
   - async/sync 混合
   - 深度巢狀 schema
   - 超長管線
   - 自訂訊息處理器

## 開放討論問題

1. **JIT 應該是選擇性加入還是自動？**
   - 選擇性：更可預測、明確控制
   - 自動：更好的 DX，但可能讓使用者驚訝

2. **如何處理編譯中的 async 步驟？**
   - 完全排除 JIT？
   - 生成 async 函式程式碼？
   - 混合方法？

3. **合理的編譯閾值是什麼？**
   - 太低：浪費編譯時間在一次性驗證上
   - 太高：錯過優化機會

4. **編譯後的 schema 應該支援鏈式呼叫嗎？**
   - 如果編譯 schema 是「終端」會更簡單
   - 但會破壞可組合性模式

5. **如何平衡打包大小與效能？**
   - JIT 基礎設施會增加程式碼
   - 這種權衡對所有使用者來說值得嗎？

6. **應該只支援 CSP 安全模式嗎？**
   - 限制優化潛力
   - 但在所有環境中都能工作

7. **應該使用哪些指標觸發編譯？**
   - 僅執行次數？
   - Schema 複雜度？
   - 執行時效能測量？

## 下一步

1. **收集反饋**：與維護者和社群討論此提案
2. **原型驗證**：建立最小 POC 驗證方法
3. **基準測試**：在真實世界 schema 上測量實際效能增益
4. **決策**：基於數據選擇實作策略
5. **規劃**：將工作分解為可實作的階段
6. **執行**：從階段 1（低風險優化）開始

## 參考資料

- 專案中的 V8 效能指南：`agents_guides/how-to-improve-performance.md`
- 類似實作：
  - Valibot：模組化驗證函式庫，專注於打包大小
  - Zod：流行的 TypeScript-first 驗證，有廣泛的優化
  - AJV：具有 JIT 編譯的 JSON schema 驗證器
  - Yup：支援同步/非同步驗證的 schema 建構器

## 結論

JIT 模式支援可以顯著提升 valchecker 在熱路徑驗證中的效能。建議的分階段方法平衡了：
- **短期**：對現有解釋器進行低風險優化
- **中期**：為進階使用者提供明確編譯 API
- **長期**：基於分析的自動編譯

這種方法在提供明確效能優勢的同時，保持了 API 穩定性。
