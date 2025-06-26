#!/usr/bin/env python3
"""Convert CSV candidate data to giin DB JSON format.

This script validates the CSV structure and outputs JSON for the web app.
"""

import csv
import json
import argparse
import sys
from collections import defaultdict

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

# Accepted political party names
VALID_PARTIES = [
    "自民",
    "公明",
    "立憲",
    "維新",
    "共産",
    "国民",
    "れいわ",
    "社民",
    "NHK",
    "参政",
    "無所属",
    "諸派",
]


def validate_header(header):
    print("[Header Check]")
    if header == EXPECTED_HEADERS:
        print("  OK: header matches expected format")
        return True
    print(f"  ERROR: header mismatch\n  Expected: {EXPECTED_HEADERS}\n  Found:    {header}")
    return False


def validate_row(row, line_num):
    errors = []
    if len(row) != len(EXPECTED_HEADERS):
        errors.append(f"column count {len(row)} != {len(EXPECTED_HEADERS)}")
        return errors
    age = row[EXPECTED_HEADERS.index("age")].strip()
    if age and not age.isdigit():
        errors.append("age is not an integer")
    party = row[EXPECTED_HEADERS.index("seitou")].strip()
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

    for r in rows:
        rid = r["id"].strip()
        todoufuken = r["todoufuken"].strip()
        senkyoku = r["senkyoku"].strip()
        party = r["seitou"].strip()
        age = r.get("age", "").strip()
        title = r["title"].strip()
        detail = r["detail"].strip()
        tubohantei = r["tubohantei"].strip()
        tubonaiyou = r["tubonaiyou"].strip()
        tuboURL = r["tuboURL"].strip()
        uraganehantei = r["uraganehantei"].strip()
        uraganenaiyou = r["uraganenaiyou"].strip()
        uraganeURL = r["uraganeURL"].strip()

        if senkyoku == "比例":
            proportional_cards.append(rid)
        else:
            prefecture_cards[todoufuken].append(rid)

        data[rid] = {
            "todoufuken": todoufuken,
            "senkyoku": senkyoku,
            "seitou": party,
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
                "politicalParty": "#184589",
                "theme": "#ff0000",
                "aiueo": "#007f7f",
                "map": "#007f7f",
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

    # proportional area
    data["比例代表"] = {
        "title": "比例代表",
        "senkyoku": "比例",
        "childrenInfo": {"cards": proportional_cards},
    }
    return data


def main():
    parser = argparse.ArgumentParser(description="Convert CSV to giin JSON")
    parser.add_argument("csv_file", help="input CSV file")
    parser.add_argument("json_file", help="output JSON file")
    args = parser.parse_args()

    try:
        with open(args.csv_file, newline="", encoding="utf-8") as f:
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
                if len(row) != len(header):
                    errors.append((line_num, [f"column count {len(row)} != {len(header)}"]))
                    continue
                record = dict(zip(header, row))
                row_errors = validate_row(row, line_num)
                if row_errors:
                    errors.append((line_num, row_errors))
                rows.append(record)
    except FileNotFoundError:
        print(f"ERROR: {args.csv_file} not found")
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
    with open(args.json_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"JSON written to {args.json_file}")


if __name__ == "__main__":
    main()
