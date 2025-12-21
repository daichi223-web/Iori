# Definition of Done (DoD)

**Project:** Iori v3.0
**Last Updated:** 2025-12-21
**Overall Progress:** 55% (11/20 required items)

---

## 1. Spec (3/4 = 75%)
- [x] SPEC.md が最新で、実装と一致している
- [x] 非対象（Non-goals）が明記されている
- [x] 主要ユースケースが列挙されている
- [ ] エラーハンドリング仕様が完全に文書化されている

---

## 2. Functionality (4/5 = 80%)
- [x] 主要ユースケースが動作する（手順が EVIDENCE にある）
- [x] すべてのユースケースが動作する
- [ ] エラー時の挙動が定義されている（入力不正、失敗時）
- [x] Mock Snapshot機能が動作する
- [x] DoD進捗率表示が動作する

---

## 3. Proof (Required) (2/5 = 40%)
- [x] テストが存在する（unit / integration / e2e のいずれか）
- [ ] すべてのコア機能にテストがある
- [x] Lint / Typecheck が通る（存在する場合）
- [ ] カバレッジ 80% 以上
- [ ] 再現手順がある（README または EVIDENCE）

---

## 4. Operability (2/4 = 50%)
- [x] 起動方法が README にある
- [ ] 設定（env など）が README にある
- [x] ログの見方が書かれている
- [ ] トラブルシューティングガイドがある

---

## 5. Safety (0/3 = 0%)
- [ ] 破壊的操作に確認がある（該当する場合）
- [ ] ローカル限定 or 認証がある（該当する場合）
- [ ] Safe Mode実装とテスト完了

---

## 6. Release (0/4 = 0%)
- [ ] 成果物の形が決まっている（exe / web / zip / script 等）
- [ ] デプロイ／配布手順がある（該当する場合）
- [ ] ロールバック手順がある（該当する場合）
- [ ] バージョニング戦略が確定している

---

## Progress Summary

| Category | Progress | Status |
|----------|----------|--------|
| **Spec** | 75% (3/4) | 🟡 In Progress |
| **Functionality** | 80% (4/5) | 🟢 Nearly Complete |
| **Proof** | 40% (2/5) | 🔴 Blocked |
| **Operability** | 50% (2/4) | 🟡 In Progress |
| **Safety** | 0% (0/3) | 🔴 Not Started |
| **Release** | 0% (0/4) | 🔴 Not Started |
| **Overall** | **55% (11/20)** | 🟡 In Progress |

---

## Next Recommended Work Units

### Priority 1 (Blocking Release)
1. **WU-04**: Mock Snapshot機能実装
   - `/api/snapshot/create`
   - `/api/snapshot/list`
   - meta.json生成

2. **WU-05**: DoD進捗率API実装
   - `/api/progress`
   - DOD.mdパーサー

### Priority 2 (Quality)
3. **WU-06**: テストカバレッジ向上
   - コア機能のユニットテスト
   - 統合テスト追加

4. **WU-07**: Safety機能実装
   - Safe Mode追加
   - 破壊的操作の確認プロンプト

### Priority 3 (Usability)
5. **WU-08**: ドキュメント整備
   - README詳細化
   - EVIDENCE.md作成
   - トラブルシューティングガイド

---

## Completion Criteria

**このプロジェクトは以下がすべて満たされるまで「Done」を宣言できない：**

### Critical Path (必須)
- [ ] Overall Progress が **100%** (20/20)
- [ ] すべてのセクションが **100%** 完了
- [ ] 再現可能な証拠が EVIDENCE.md にある
- [ ] 人間による最終レビュー完了

### Nice to Have (推奨)
- Mock Snapshot Gallery UI実装
- Work Unit自動分解機能
- パフォーマンスベンチマーク

---

**絶対ルール:**
> DOD.md の required 項目がすべて ✅ にならない限り、
> Iori は完成宣言をしてはならない。

---

**End of DoD**
