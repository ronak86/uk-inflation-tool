from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Weights And Prices.xlsx"
OUTPUT = ROOT / "web" / "data" / "cpih.json"
JS_OUTPUT = ROOT / "web" / "data" / "cpih-data.js"


def iso_month(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m")
    raise ValueError(f"Unexpected month header: {value!r}")


def clean(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip()
    return value


def clean_code(value):
    value = clean(value)
    if value in (None, "", "#N/A"):
        return None
    return str(value).strip()


def item_prefix(name):
    if not name:
        return ""
    return str(name).strip().split(" ", 1)[0]


def read_sector_defs(workbook) -> dict:
    if "SectorDefs" not in workbook.sheetnames:
        return {}

    rows = list(workbook["SectorDefs"].iter_rows(values_only=True))
    sector_defs = {
        "CPI": {"boeCodes": set(), "servicesCodes": set(), "nonCoreCodes": set()},
        "CPIH": {"boeCodes": set(), "servicesCodes": set(), "nonCoreCodes": set()},
    }

    for row in rows[1:]:
        for code in (row[1] if len(row) > 1 else None, row[2] if len(row) > 2 else None):
            code = clean_code(code)
            if code:
                sector_defs["CPI"]["boeCodes"].add(code)
        for code in (row[3] if len(row) > 3 else None, row[4] if len(row) > 4 else None):
            code = clean_code(code)
            if code:
                sector_defs["CPIH"]["boeCodes"].add(code)

        for code in (row[7] if len(row) > 7 else None, row[8] if len(row) > 8 else None):
            code = clean_code(code)
            if code:
                sector_defs["CPI"]["servicesCodes"].add(code)
        for code in (row[9] if len(row) > 9 else None, row[10] if len(row) > 10 else None):
            code = clean_code(code)
            if code:
                sector_defs["CPIH"]["servicesCodes"].add(code)

        for code in (row[13] if len(row) > 13 else None, row[14] if len(row) > 14 else None):
            code = clean_code(code)
            if code:
                sector_defs["CPI"]["nonCoreCodes"].add(code)
        for code in (row[15] if len(row) > 15 else None, row[16] if len(row) > 16 else None):
            code = clean_code(code)
            if code:
                sector_defs["CPIH"]["nonCoreCodes"].add(code)

    return sector_defs


def annotate_sectors(payload: dict, sector_defs: dict) -> None:
    series_defs = sector_defs.get(payload["series"], {})
    boe_codes = series_defs.get("boeCodes", set())
    services_codes = series_defs.get("servicesCodes", set())
    non_core_codes = series_defs.get("nonCoreCodes", set())

    for item in payload["items"]:
        codes = {clean_code(item["weightCode"]), clean_code(item["priceCode"])}
        codes.discard(None)
        item["sectors"] = {
            "boe": bool(codes & boe_codes),
            "services": bool(codes & services_codes),
            "nonCore": bool(codes & non_core_codes),
        }


def read_series(workbook, series: str) -> dict:
    weights = workbook[f"{series}_Weights"]
    prices = workbook[f"{series}_Prices"]

    weight_rows = list(weights.iter_rows(values_only=True))
    price_rows = list(prices.iter_rows(values_only=True))

    if len(weight_rows) != len(price_rows):
        raise ValueError("Weight and price sheets have different row counts")

    months = [iso_month(value) for value in weight_rows[0][4:]]
    items = []

    for weight_row, price_row in zip(weight_rows[1:], price_rows[1:]):
        weight_key = tuple(clean(value) for value in weight_row[:4])
        price_key = tuple(clean(value) for value in price_row[:4])
        if weight_key != price_key:
            raise ValueError(f"Row mismatch: {weight_key!r} != {price_key!r}")

        name, level, weight_code, price_code = weight_key
        items.append(
            {
                "name": name,
                "level": int(level),
                "weightCode": weight_code,
                "priceCode": price_code,
                "weights": [float(value) for value in weight_row[4:]],
                "prices": [float(value) for value in price_row[4:]],
            }
        )

    return {
        "series": series,
        "sourceWorkbook": SOURCE.name,
        "months": months,
        "items": items,
    }


def read_overall_3dp(workbook) -> dict:
    sheet = workbook["3dpOverall"]
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return {}

    header = [clean(value) for value in rows[0]]
    code_map = {"D7BT": "CPI", "L522": "CPIH"}
    code_columns = {
        series: header.index(code)
        for code, series in code_map.items()
        if code in header
    }
    if not code_columns:
        return {}

    months = []
    values = {series: [] for series in code_columns}
    for row in rows[1:]:
        if row[0] is None:
            continue
        months.append(iso_month(row[0]))
        for series, column in code_columns.items():
            value = row[column]
            values[series].append(float(value) if value is not None else None)

    return {
        series: {
            "priceCode": "D7BT" if series == "CPI" else "L522",
            "months": months,
            "prices": values[series],
        }
        for series in values
    }


def main() -> None:
    workbook = load_workbook(SOURCE, read_only=True, data_only=True)
    overall_3dp = read_overall_3dp(workbook)
    sector_defs = read_sector_defs(workbook)
    series_payloads = {
        series: read_series(workbook, series)
        for series in ("CPIH", "CPI")
    }
    for series, overall in overall_3dp.items():
        if series in series_payloads:
            series_payloads[series]["overall3dp"] = overall
    for payload in series_payloads.values():
        annotate_sectors(payload, sector_defs)

    payload = {
        "sourceWorkbook": SOURCE.name,
        "series": series_payloads,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload_json = json.dumps(payload, separators=(",", ":"))
    OUTPUT.write_text(payload_json, encoding="utf-8")
    JS_OUTPUT.write_text(f"window.CPIH_DATA={payload_json};\n", encoding="utf-8")
    summary = ", ".join(
        f"{series}: {len(data['items'])} items, {len(data['months'])} months"
        for series, data in series_payloads.items()
    )
    print(f"Wrote {OUTPUT} with {summary}")


if __name__ == "__main__":
    main()
