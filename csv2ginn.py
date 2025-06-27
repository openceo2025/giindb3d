#!/usr/bin/env python3
"""Convert CSV candidate data to giin DB JSON format.

This script validates the CSV structure and outputs JSON for the web app.
"""

import csv
import json
import argparse
import sys
from collections import defaultdict

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox
except Exception:
    tk = None

# Expected CSV header order
EXPECTED_HEADERS = [
    "id",
    "todoufuken",
    "senkyoku",
    "seitou",
    "title",
    "detail",
    "age",
    "tubohantei",
    "tubonaiyou",
    "tuboURL",
    "uraganehantei",
    "uraganenaiyou",
    "uraganeURL",
]

# Optional header variant with 'yomi' for AIUEO grouping
EXPECTED_HEADERS_YOMI = [
    "id",
    "todoufuken",
    "senkyoku",
    "seitou",
    "title",
    "yomi",
    "detail",
    "age",
    "tubohantei",
    "tubonaiyou",
    "tuboURL",
    "uraganehantei",
    "uraganenaiyou",
    "uraganeURL",
]

# Map short party names in the CSV to JSON keys
PARTY_KEY_MAP = {
    "自民": "zimin",
    "自由民主党": "zimin",
    "公明": "koumei",
    "立憲": "rikken",
    "維新": "ishin",
    "共産": "kyousan",
    "国民": "kokumin",
    "れいわ": "reiwa",
    "社民": "shamin",
    "社会民主党": "shamin",
    "NHK": "nhk",
    "参政": "sansei",
    "日保": "nippo",
    "日本保守党": "nippo",
    "日本保守党（代表者：百田尚樹）": "nippo",
    "日本保守党（代表者：石濱哲信）": "nippo",
    "日誠": "nissei",
    "日本誠真会": "nissei",
    "日家": "nichiie",
    "日本の家庭を守る会": "nichiie",
    "やまと": "yamato",
    "新党やまと": "yamato",
    "差別": "sabetsu",
    "差別撲滅党#平和フリーズ": "sabetsu",
    "核融": "kakuyu",
    "核融合党": "kakuyu",
    "減日": "genzei",
    "減税日本": "genzei",
    "くにもり": "kunimori",
    "新党くにもり": "kunimori",
    "多夫多妻": "tafu",
    "多夫多妻党": "tafu",
    "国ガ": "kokuga",
    "国政ガバナンスの会": "kokuga",
    "新社": "shinsha",
    "新社会党": "shinsha",
    "みんつく": "mintsuku",
    "N国": "nkoku",
    "再道": "saidou",
    "みらい": "mirai",
    "日改": "nikai",
    "無所属": "mushozoku",
    "諸派": "shoha",
    "": "fumei",
    "不明": "fumei",
}

# Display names for party groups
PARTY_FULLNAMES = {
    "zimin": "自由民主党",
    "koumei": "公明党",
    "rikken": "立憲民主党",
    "ishin": "日本維新の会",
    "kyousan": "日本共産党",
    "kokumin": "国民民主党",
    "reiwa": "れいわ新選組",
    "shamin": "社会民主党",
    "nhk": "NHK党",
    "sansei": "参政党",
    "nippo": "日保",
    "mintsuku": "みんつく",
    "nkoku": "N国",
    "saidou": "再道",
    "mirai": "みらい",
    "nikai": "日改",
    "nissei": "日本誠真会",
    "nichiie": "日本の家庭を守る会",
    "yamato": "新党やまと",
    "sabetsu": "差別撲滅党#平和フリーズ",
    "kakuyu": "核融合党",
    "genzei": "減税日本",
    "kunimori": "新党くにもり",
    "tafu": "多夫多妻党",
    "kokuga": "国政ガバナンスの会",
    "shinsha": "新社会党",
    "mushozoku": "無所属",
    "shoha": "諸派",
    "fumei": "不明",
}

# Default color codes for each party
PARTY_COLORS = {
    "zimin": "#3CA324",
    "koumei": "#F55881",
    "rikken": "#184589",
    "ishin": "#6FBA2C",
    "kyousan": "#DB001C",
    "kokumin": "#F8BC00",
    "reiwa": "#E4027E",
    "shamin": "#01A8EC",
    "nhk": "#000000",
    "sansei": "#D85D0F",
    "nippo": "#D3D3D3",
    "mintsuku": "#F8EA0D",
    "nkoku": "#000000",
    "saidou": "#000000",
    "mirai": "#000000",
    "nikai": "#000000",
    "nissei": "#000000",
    "nichiie": "#000000",
    "yamato": "#000000",
    "sabetsu": "#000000",
    "kakuyu": "#000000",
    "genzei": "#000000",
    "kunimori": "#000000",
    "tafu": "#000000",
    "kokuga": "#000000",
    "shinsha": "#000000",
    "mushozoku": "#DFDFDF",
    "shoha": "#D3D3D3",
    "fumei": "#000000",
    "anshi": "#D3D3D3",
}

# Prefecture suffix handling
PREF_MAP = {
    "北海道": "北海道",
    "東京": "東京都",
    "大阪": "大阪府",
    "京都": "京都府",
}


def normalize_prefecture(name: str) -> str:
    """Return name with prefecture suffix attached if needed."""
    if not name:
        return name
    if name in PREF_MAP:
        return PREF_MAP[name]
    if name[-1] in {"県", "府", "都", "道"}:
        return name
    return name + "県"

# Accepted political party names
VALID_PARTIES = [
    "自民",
    "自由民主党",
    "公明",
    "立憲",
    "維新",
    "共産",
    "国民",
    "れいわ",
    "社民",
    "社会民主党",
    "NHK",
    "参政",
    "日保",
    "日本保守党",
    "日本保守党（代表者：百田尚樹）",
    "日本保守党（代表者：石濱哲信）",
    "日誠",
    "日本誠真会",
    "日家",
    "日本の家庭を守る会",
    "やまと",
    "新党やまと",
    "差別",
    "差別撲滅党#平和フリーズ",
    "核融",
    "核融合党",
    "減日",
    "減税日本",
    "くにもり",
    "新党くにもり",
    "多夫多妻",
    "多夫多妻党",
    "国ガ",
    "国政ガバナンスの会",
    "新社",
    "新社会党",
    "みんつく",
    "N国",
    "再道",
    "みらい",
    "日改",
    "無所属",
    "諸派",
    "",
    "不明",
]


def select_files_gui():
    """Open GUI dialogs to choose input and output files."""
    if tk is None:
        print("tkinter is not available. Please specify files as command line arguments.")
        return None, None
    try:
        root = tk.Tk()
    except tk.TclError as e:
        print(f"GUI cannot be started: {e}")
        return None, None
    root.withdraw()
    csv_file = filedialog.askopenfilename(
        title="Select CSV file",
        filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
    )
    if not csv_file:
        messagebox.showerror("csv2ginn", "No CSV file selected")
        root.destroy()
        return None, None
    json_file = filedialog.asksaveasfilename(
        title="Save JSON file as",
        defaultextension=".json",
        filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
    )
    if not json_file:
        messagebox.showerror("csv2ginn", "No JSON file path specified")
        root.destroy()
        return None, None
    root.destroy()
    return csv_file, json_file


def validate_header(header):
    print("[Header Check]")
    if header == EXPECTED_HEADERS or header == EXPECTED_HEADERS_YOMI:
        print("  OK: header matches expected format")
        return True
    print(f"  ERROR: header mismatch\n  Expected: {EXPECTED_HEADERS} or {EXPECTED_HEADERS_YOMI}\n  Found:  {header}")
    return False



def validate_row(row, line_num, header):
    errors = []
    if len(row) != len(header):
        errors.append(f"column count {len(row)} != {len(header)}")
        return errors
    idx = {h: i for i, h in enumerate(header)}
    age = row[idx.get("age")].strip() if "age" in idx else ""
    if age and not age.isdigit():
        errors.append("age is not an integer")
    party = row[idx.get("seitou")].strip() if "seitou" in idx else ""
    if not party:
        party = "不明"
    if party not in VALID_PARTIES:
        errors.append(f"unknown party '{party}'")
    return errors


def build_json(rows):
    data = {}
    # top categories
    data["選挙区"] = {"title": "選挙区", "childrenInfo": {"cards": []}}
    data["比例区"] = {"title": "比例代表", "childrenInfo": {"cards": ["比例代表"]}}

    prefecture_cards = defaultdict(list)
    proportional_cards = []
    party_cards = defaultdict(list)
    aiueo_cards = defaultdict(list)

    for r in rows:
        rid = r["id"].strip()
        todoufuken = normalize_prefecture(r["todoufuken"].strip())
        senkyoku = r["senkyoku"].strip()
        party = r["seitou"].strip()
        if not party:
            party = "不明"
        party_key = PARTY_KEY_MAP.get(party)
        age = r.get("age", "").strip()
        title = r["title"].strip()
        detail = r["detail"].strip()
        tubohantei = r["tubohantei"].strip()
        tubonaiyou = r["tubonaiyou"].strip()
        tuboURL = r["tuboURL"].strip()
        uraganehantei = r["uraganehantei"].strip()
        uraganenaiyou = r["uraganenaiyou"].strip()
        uraganeURL = r["uraganeURL"].strip()
        yomi = r.get("yomi", "").strip()

        if senkyoku == "比例":
            proportional_cards.append(rid)
        else:
            prefecture_cards[todoufuken].append(rid)

        if party_key:
            party_cards[party_key].append(rid)

        if yomi:
            head = yomi[0]
            if head in "あいうえお":
                aiueo_cards["あ"].append(rid)
            elif head in "かきくけこ":
                aiueo_cards["か"].append(rid)
            elif head in "さしすせそ":
                aiueo_cards["さ"].append(rid)
            elif head in "たちつてと":
                aiueo_cards["た"].append(rid)
            elif head in "なにぬねの":
                aiueo_cards["な"].append(rid)
            elif head in "はひふへほ":
                aiueo_cards["は"].append(rid)
            elif head in "まみむめも":
                aiueo_cards["ま"].append(rid)
            elif head in "やゆよ":
                aiueo_cards["や"].append(rid)
            elif head in "らりるれろ":
                aiueo_cards["ら"].append(rid)
            elif head in "わをん":
                aiueo_cards["わ"].append(rid)

        party_color = PARTY_COLORS.get(party_key, "#007f7f")
        data[rid] = {
            "todoufuken": todoufuken,
            "senkyoku": senkyoku,
            "seitou": party,
            "yomi": yomi,
            "age": age,
            "tubohantei": tubohantei,
            "tubonaiyou": tubonaiyou,
            "tuboURL": tuboURL,
            "uraganehantei": uraganehantei,
            "uraganenaiyou": uraganenaiyou,
            "uraganeURL": uraganeURL,
            "title": title,
            "detail": detail,
            "type": "text",
            "color": {
                "politicalParty": party_color,
                "theme": party_color,
                "aiueo": party_color,
                "map": party_color,
            },
            "childrenInfo": {"camera": None, "cards": []},
            "tuboURLarray": "",
        }

    # prefecture entries
    prefectures = sorted(prefecture_cards.keys())
    data["選挙区"]["childrenInfo"]["cards"] = prefectures
    for pref in prefectures:
        data[pref] = {
            "title": pref,
            "todoufuken": pref,
            "senkyoku": pref,
            "childrenInfo": {"cards": prefecture_cards[pref]},
        }

    # party groups
    for key, cards in party_cards.items():
        data[key] = {
            "title": PARTY_FULLNAMES.get(key, key),
            "childrenInfo": {"cards": cards},
        }

    # AIUEO groups (only if yomi provided)
    for key, cards in aiueo_cards.items():
        data[key] = {
            "title": key,
            "childrenInfo": {"cards": cards},
        }

    # proportional area
    data["比例代表"] = {
        "title": "比例代表",
        "senkyoku": "比例",
        "childrenInfo": {"cards": proportional_cards},
    }
    return data


def main():
    parser = argparse.ArgumentParser(description="Convert CSV to giin JSON")
    parser.add_argument("csv_file", nargs="?", help="input CSV file")
    parser.add_argument("json_file", nargs="?", help="output JSON file")
    args = parser.parse_args()

    csv_path = args.csv_file
    json_path = args.json_file
    if not csv_path or not json_path:
        csv_path, json_path = select_files_gui()
        if not csv_path or not json_path:
            print("No files selected. Aborting.")
            return

    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            try:
                header = next(reader)
            except StopIteration:
                print("ERROR: CSV file is empty")
                sys.exit(1)
            valid_header = validate_header(header)
            rows = []
            errors = []
            for line_num, row in enumerate(reader, start=2):
                if not row or all(not c.strip() for c in row):
                    continue  # skip empty lines
                record = dict(zip(header, row))
                row_errors = validate_row(row, line_num, header)
                if row_errors:
                    errors.append((line_num, row_errors))
                rows.append(record)
    except FileNotFoundError:
        print(f"ERROR: {csv_path} not found")
        sys.exit(1)

    for line_num, errs in errors:
        for err in errs:
            print(f"Row {line_num}: {err}")

    if errors:
        print(f"Validation completed with {len(errors)} error rows")
    else:
        print("Validation completed successfully")

    if not valid_header or errors:
        print("Aborting JSON output due to validation errors")
        sys.exit(1)

    data = build_json(rows)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"JSON written to {json_path}")


if __name__ == "__main__":
    main()
