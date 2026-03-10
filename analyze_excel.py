#!/usr/bin/env python3
"""Comprehensive analysis of Adobe financials Excel file."""

import openpyxl
import sys

FILE = "/Users/markdillemuth/Desktop/Company_Data/Adobe_Financials/AdobeInc.NASDAQGSADBE_Report_02-20-2026.xlsx"

def analyze():
    print(f"Opening: {FILE}")
    wb = openpyxl.load_workbook(FILE, data_only=True)

    print(f"\n{'='*120}")
    print(f"SHEET NAMES ({len(wb.sheetnames)} total):")
    for i, name in enumerate(wb.sheetnames):
        print(f"  [{i}] '{name}'")
    print(f"{'='*120}")

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        print(f"\n{'#'*120}")
        print(f"## SHEET: '{sheet_name}'")
        print(f"{'#'*120}")
        print(f"  Dimensions: {ws.dimensions}")
        print(f"  Min row: {ws.min_row}, Max row: {ws.max_row}")
        print(f"  Min col: {ws.min_column}, Max col: {ws.max_column}")
        print(f"  Total rows: {ws.max_row}, Total cols: {ws.max_column}")

        # Merged cells
        merged = list(ws.merged_cells.ranges)
        if merged:
            print(f"  Merged cell ranges ({len(merged)}):")
            for m in merged:
                print(f"    {m}")
        else:
            print(f"  Merged cell ranges: NONE")

        # Determine how many rows to print
        max_row = ws.max_row or 0
        max_col = ws.max_column or 0

        if max_row == 0:
            print("  ** EMPTY SHEET **")
            continue

        # Print FIRST 35 rows
        first_n = min(35, max_row)
        print(f"\n  --- FIRST {first_n} ROWS (all {max_col} columns) ---")
        for row_idx in range(1, first_n + 1):
            vals = []
            for col_idx in range(1, max_col + 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                v = cell.value
                vals.append(v)
            print(f"  Row {row_idx:>4}: {vals}")

        # Print LAST 5 rows (if not already covered)
        if max_row > first_n:
            last_start = max(first_n + 1, max_row - 4)
            print(f"\n  --- LAST 5 ROWS (rows {last_start}-{max_row}) ---")
            for row_idx in range(last_start, max_row + 1):
                vals = []
                for col_idx in range(1, max_col + 1):
                    cell = ws.cell(row=row_idx, column=col_idx)
                    v = cell.value
                    vals.append(v)
                print(f"  Row {row_idx:>4}: {vals}")

        # Additional: check for any rows between first_n and last_start that have year-like values
        # or special metadata
        print(f"\n  --- SUMMARY for '{sheet_name}' ---")
        print(f"  Total rows: {max_row}, Total cols: {max_col}")

        # Scan for year-like values in first 5 rows
        print(f"  Year-like values found in header area (rows 1-5):")
        for row_idx in range(1, min(6, max_row + 1)):
            for col_idx in range(1, max_col + 1):
                v = ws.cell(row=row_idx, column=col_idx).value
                if v is not None:
                    s = str(v)
                    if any(yr in s for yr in ['2018','2019','2020','2021','2022','2023','2024','2025','2026','2027','2028','2029','2030']):
                        print(f"    Row {row_idx}, Col {col_idx}: '{v}'")

        # Check for units/magnitude info
        print(f"  Potential units/magnitude info (scanning all cells for keywords):")
        units_found = []
        for row_idx in range(1, min(10, max_row + 1)):
            for col_idx in range(1, max_col + 1):
                v = ws.cell(row=row_idx, column=col_idx).value
                if v is not None:
                    s = str(v).lower()
                    if any(kw in s for kw in ['million', 'billion', 'thousand', 'usd', '$', 'unit', 'magnitude', 'currency', 'in millions', 'in billions', 'per share', 'ratio', '%', 'percent']):
                        units_found.append(f"    Row {row_idx}, Col {col_idx}: '{v}'")
        if units_found:
            for u in units_found:
                print(u)
        else:
            print("    (none found in first 10 rows)")

    print(f"\n{'='*120}")
    print("ANALYSIS COMPLETE")
    print(f"{'='*120}")

if __name__ == "__main__":
    analyze()
