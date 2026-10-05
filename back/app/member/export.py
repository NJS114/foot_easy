import csv
import io

from app.member.models import Member

COLUMNS = (
    ("Équipe", None),
    ("Nom", "last_name"),
    ("Prénom", "first_name"),
    ("Rôle", "role"),
    ("Poste", "position"),
    ("Numéro", "shirt_number"),
    ("E-mail", "email"),
    ("Téléphone", "phone"),
    ("Date de naissance", "birth_date"),
    ("Licence", "license_number"),
    ("Taille", "jersey_size"),
)


def to_csv(rows: list[tuple[Member, str]]) -> str:
    """Semicolon CSV with a BOM so Excel (French locale) opens it with the right columns."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow([header for header, _ in COLUMNS])
    for member, team_name in rows:
        values = [getattr(member, field) if field else team_name for _, field in COLUMNS]
        writer.writerow(["" if value is None else str(value) for value in values])
    return "﻿" + buffer.getvalue()
