"""CSV export helper."""

from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Any

from fastapi import Response

DEFAULT_CSV_LIMIT = 500


def csv_response(
    rows: list[dict[str, Any]],
    columns: list[tuple[str, str]],
    filename: str,
    *,
    limit: int = DEFAULT_CSV_LIMIT,
) -> Response:
    """Convert a list of dicts into a CSV download response.

    Args:
        rows: List of row dictionaries.
        columns: List of (csv_header, dict_key) tuples.
        filename: Suggested download filename.
        limit: Maximum number of rows to export.
    """
    rows = rows[:limit]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([header for header, _ in columns])

    for row in rows:
        cells = []
        for _, key in columns:
            v = row.get(key)
            if v is None:
                cells.append("")
            elif isinstance(v, bool):
                cells.append("true" if v else "false")
            elif isinstance(v, datetime):
                cells.append(v.isoformat())
            else:
                cells.append(str(v))
        writer.writerow(cells)

    body = buf.getvalue().encode("utf-8-sig")  # BOM for Excel compatibility
    safe_name = filename.replace(" ", "_")
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
        },
    )
