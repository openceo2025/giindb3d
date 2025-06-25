# AGENTS Instructions

This project visualizes Japanese election candidate information in 3D. It is currently built around the 2021 House of Representatives (衆議院) election. Data is loaded from `giindb.json` and arranged through `CardManager.js` and `CardData.js`.

## Upcoming plan: 2025 House of Councillors (参議院) election
The application must be updated to handle the 2025 参議院 election. Major structural differences from the current version include:

- **Proportional representation (比例代表)** uses a single national list. There are no regional blocks like the House of Representatives.
- **Districts** are prefectural or combined prefectural districts (`選挙区`). They replace the current `小選挙区` based on numbered districts.
- The list of parties and candidates will change.

Candidate CSV/JSON data will be replaced separately, but any data file must follow the format required by the app.

## Candidate data format
Each candidate entry in `giindb.json` currently contains fields such as:

```json
{
  "todoufuken": "北海道",
  "senkyoku": "１区",
  "seitou": "自民",
  "tubohantei": "関わり有り",
  "tubonaiyou": "...",
  "tuboURL": "...",
  "uraganehantei": "",
  "uraganenaiyou": "",
  "uraganeURL": "",
  "title": "候補者名",
  "detail": "プロフィール",
  "type": "text",
  "color": {
    "politicalParty": "#184589",
    "theme": "#ff0000",
    "aiueo": "#007f7f",
    "map": "#007f7f"
  },
  "childrenInfo": {
    "camera": null,
    "cards": []
  },
  "tuboURLarray": ""
}
```

For the 参議院 version, keep these fields but adapt `senkyoku` and `todoufuken` as follows:

- Proportional candidates: `senkyoku` should be set to `"比例"` and `todoufuken` may be empty.
- District candidates: `senkyoku` should hold the prefectural district name (e.g. `"東京都"`, `"京都府"`, or combined districts).

Party codes in `color.politicalParty` and the party‐ID tests in `CardManager.isSeitouID` must be updated when new party names are added.

### csv2giin.py 用CSV形式
公式データを変換する `csv2giin.py` では以下のヘッダー順の CSV を受け付けます。

`id,todoufuken,senkyoku,seitou,title,detail,tubohantei,tubonaiyou,tuboURL,uraganehantei,uraganenaiyou,uraganeURL`

id : 各候補を一意に識別するキー(例: tokyo-yamada)
`todoufuken` : 都道府県名。比例候補は空欄可
`senkyoku` : 選挙区名または "比例"
`seitou` : 政党略称
`title` : 候補者名
`detail` : プロフィール等任意情報
`*_hantei`, `*_naiyou`, `*URL` : 壺・裏金関連情報

カラー情報は `colors.js` によって政党別に自動付与されるため CSV には含めません。

## Tasks to migrate to 参議院
1. **Update data structure**
   - Rename the current `小選挙区` category in `giindb.json` to `選挙区`.
   - Remove regional proportional blocks. Under `比例区`, store all proportional candidates directly or group them as needed.
   - Ensure each prefecture entry lists its district candidates under `childrenInfo.cards`.
2. **Modify map logic** in `CardManager.js`
   - Adjust `addProportionalBlock` to always return the single block name `"比例代表"`.
   - Review `selectWaku` and related functions for assumptions about numbered districts (e.g. checks for `"第"` and `"区"`). These should work with prefectural district names instead.
3. **Update party handling**
   - Edit `isSeitouID` and party lists shown in `showPartyWaku` to match the 2025 party lineup.
4. **Revise UI labels**
   - Any buttons or titles referring to `小選挙区` or regional blocks must be changed to the 参議院 terminology (`選挙区`, `比例代表`).
5. **Replace candidate data**
   - Prepare a new CSV converted to the JSON format above. The JSON must include: candidate name, party, district or proportional, and the fields for "壺"/"裏金" information. These will be loaded via `giindb.json` just like the current version.

No automated tests are provided. Verify changes by loading `index.html` in a browser and confirming that the map, candidate cards, and filters work with the new data.

## Reference: 2025 House of Councillors election overview
The 参議院 consists of 248 seats, with half contested every three years. In 2025
around 124 seats will be up for election. Seats are divided into two systems:

- **District seats (選挙区)**: 148 seats in total. Each prefecture (or combined
  prefectural district) elects members using single non-transferable vote (SNTV)
  or first-past-the-post in single-member districts. As of the most recent
  reform there are 45 districts; Tottori and Shimane are merged, and Tokushima
  and Kōchi are merged.
- **Proportional representation (比例代表)**: 100 seats decided by a nationwide
  open-list system. Voters may write a party name or a candidate name. Seats are
  allocated to parties using the D'Hondt method, and candidates within each
  party are ranked by the number of individual votes they receive.

Major parties expected to contest include (subject to change): 自由民主党
(LDP), 立憲民主党, 公明党, 日本維新の会, 国民民主党, 日本共産党, れいわ新選組,
社会民主党, NHK党, 参政党, and others.

These details are provided as a reference for updating candidate data and UI
labels. Confirm official information closer to the election.

## Task Progress
- [x] Rename 小選挙区 to 選挙区 in giindb.json and update UI labels accordingly.
- [x] Remove regional proportional blocks and list district candidates for each prefecture in giindb.json.
- [x] Update map logic for 参議院: addProportionalBlock returns "比例代表" and district checks handle prefectural names.
- [x] Update party handling: adjusted isSeitouID and showPartyWaku for the 2025 party lineup including NHK党.
- [x] Replace candidate data with sample 参議院 entries for 2025 election.

## Current progress (2025 参議院 version)

The following table summarizes the main tasks completed so far and their status.

| タスク | 状態 | 補足 |
| --- | --- | --- |
| **データ構造の更新**<br>・`小選挙区`→`選挙区` へリネーム<br>・地域比例ブロックを削除し、各都道府県の district 候補を `childrenInfo.cards` に格納 | ✔ 完了 | `giindb.json` 内部で確認済み。 |
| **マップロジックの修正**<br>・`addProportionalBlock()` が常に "比例代表" を返す<br>・番号付き区の判定ロジックを都道府県名ベースに変更 | ✔ 完了 | `CardManager.js` の `selectWaku`, `addProportionalBlock` を更新。 |
| **政党ハンドリングの更新**<br>・`isSeitouID` の判定テーブル拡充<br>・`showPartyWaku` のラベルを 2025 年想定の党名に合わせて更新 | ✔ 完了 | 新規政党（NHK党、参政党など）を追加、色コードも対応。 |
| **UI ラベルの置換**<br>・ボタン／タイトルから「小選挙区」を除去し「選挙区」「比例代表」に統一 | ✔ 完了 | `header.html` が見当たらず残タスク無しと判断。既存ファイル中に旧語は確認できず。 |
| **候補者データ差し替え**<br>・サンプル 参議院データを JSON 形式で投入 | ✔ サンプル投入済み | 124 全候補の正式データ待ち。確定次第、CSV→JSON 変換スクリプトで一括置換予定。 |
| **カラーパレット拡張**<br>・新党の `color.politicalParty` を定義 | ▲ 下準備済み | 正式カラー未公表の党（例: 参政党）については仮色。公式発表後に再設定。 |
| **動作検証**<br>・`index.html` をローカルで読み込み、選挙区／比例代表フィルタとカード表示をチェック | ▲ 手動検証中 | 選挙区フィルタは OK。比例代表で多人数表示時のカード幅自動調整がやや崩れるため、CSS チューニング要。 |
| **自動テスト** | – | もともと未整備。今後 E2E (Playwright) を導入検討。 |
現在までにCodexへ依頼していた修正・機能実装はすべて反映済み。
以降は正式候補データと政党カラーの入力待ち。これらが揃い次第、
再度JSONを更新し最終調整を行う。

### Next steps
1. ~~**UI ラベル残り差し替え** — `header.html` のツールチップ 2 箇所を修正。~~ 完了: `header.html` が存在せず、該当箇所も見当たらないため対応不要と判断。
2. **カード幅の自動調整バグ修正** — 比例代表を 50 名以上同時表示した際、カードが 3D 空間外にはみ出すため `CardManager.updateLayout()` の行列計算を見直す。
3. **本番CSVデータ取り込み** — 提供された公式候補リストを `csv2giin.py` で JSON 化し `giindb.json` を更新する。
4. **政党正式カラー反映** — ご提供の色コードに基づき `colors.js` を修正。
5. **自動テスト基盤の整備 (任意)** — E2E テストで選挙区／比例代表切替とカードクリック動作を確認。

PowerShell でのビルド／ローカル確認手順は以下の通りです。

```powershell
# 依存の取得
npm install

# 開発サーバー
npm run dev      # ↔ webpack-dev-server で http://localhost:8080/

# 本番ビルド
npm run build
```
