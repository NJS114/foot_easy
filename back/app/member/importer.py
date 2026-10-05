"""Turn a CSV or Excel roster file into member payloads, accepting French headers and labels."""

import csv
import io
import unicodedata
import zipfile
from datetime import date, datetime

from openpyxl import load_workbook

from app.core.exceptions import BusinessRuleError

MAX_ROWS = 1000

HEADER_ALIASES = {
    "first_name": {"prenom", "first_name", "firstname"},
    "last_name": {"nom", "last_name", "lastname", "nom de famille"},
    "email": {"email", "e-mail", "mail", "courriel"},
    "phone": {"telephone", "tel", "phone", "portable", "mobile"},
    "birth_date": {"date de naissance", "naissance", "birth_date", "date_naissance"},
    "license_number": {"licence", "numero de licence", "license", "license_number"},
    "jersey_size": {"taille", "taille maillot", "jersey_size"},
    "role": {"role", "fonction"},
    "position": {"poste", "position"},
    "shirt_number": {"numero", "n°", "numero de maillot", "shirt_number", "dossard"},
}

VALUE_ALIASES = {
    "role": {
        "joueur": "player",
        "joueuse": "player",
        "coach": "coach",
        "entraineur": "coach",
        "entraineure": "coach",
        "staff": "staff",
        "president": "president",
        "presidente": "president",
        "secretaire": "secretary",  # pragma: allowlist secret
        "tresorier": "treasurer",
        "tresoriere": "treasurer",
        "directeur technique": "technical_director",
        "benevole": "volunteer",
        "arbitre": "referee",
    },
    "position": {
        "gardien": "goalkeeper",
        "defenseur": "defender",
        "milieu": "midfielder",
        "attaquant": "forward",
    },
}


def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.strip().lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def read_xlsx(content: bytes) -> list[dict[str, object]]:
    sheet = load_workbook(io.BytesIO(content), read_only=True, data_only=True).active
    values = [list(row) for row in sheet.iter_rows(values_only=True)]
    if not values:
        return []
    headers = [str(cell or "") for cell in values[0]]
    return [dict(zip(headers, row, strict=False)) for row in values[1:]]


def read_csv(content: bytes) -> list[dict[str, object]]:
    text = content.decode("utf-8-sig")
    if not text.strip():
        return []
    delimiter = ";" if text.splitlines()[0].count(";") >= text.splitlines()[0].count(",") else ","
    return list(csv.DictReader(io.StringIO(text), delimiter=delimiter))


def read_rows(filename: str, content: bytes) -> list[dict[str, object]]:
    """Read the first sheet (xlsx) or the CSV (`;` or `,`) as dicts keyed by raw headers."""
    readers = {".xlsx": read_xlsx, ".csv": read_csv}
    reader = next((fn for ext, fn in readers.items() if filename.lower().endswith(ext)), None)
    if reader is None:
        raise BusinessRuleError("unsupported_file", "Only .csv and .xlsx files are supported")
    try:
        rows = reader(content)
    except (zipfile.BadZipFile, UnicodeDecodeError, csv.Error, KeyError, ValueError) as error:
        raise BusinessRuleError("unreadable_file", "The file could not be read") from error
    if len(rows) > MAX_ROWS:
        raise BusinessRuleError("too_many_rows", f"At most {MAX_ROWS} rows can be imported")
    return [row for row in rows if any(value not in (None, "") for value in row.values())]


def to_payload(row: dict[str, object]) -> dict[str, object]:
    """Map a raw row to MemberCreate fields; unknown columns are ignored."""
    by_header = {normalize(str(header)): value for header, value in row.items() if header}
    payload: dict[str, object] = {}
    for field, aliases in HEADER_ALIASES.items():
        value = next((by_header[alias] for alias in aliases if alias in by_header), None)
        if value in (None, ""):
            continue
        if isinstance(value, datetime):
            value = value.date()
        if isinstance(value, str) and field in VALUE_ALIASES:
            value = VALUE_ALIASES[field].get(normalize(value), normalize(value))
        elif isinstance(value, str) and field == "jersey_size":
            value = normalize(value)
        elif isinstance(value, str) and field == "birth_date":
            value = parse_date(value)
        payload[field] = value
    return payload


def parse_date(value: str) -> date | str:
    for date_format in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(value.strip(), date_format).date()
        except ValueError:
            continue
    return value
