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
