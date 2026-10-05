from dataclasses import dataclass


@dataclass(frozen=True)
class Formation:
    code: str
    players: int
    lines: tuple[int, ...]


FORMATIONS: dict[str, Formation] = {
    formation.code: formation
    for formation in (
        Formation("4-4-2", 11, (4, 4, 2)),
        Formation("4-3-3", 11, (4, 3, 3)),
        Formation("4-2-3-1", 11, (4, 2, 3, 1)),
        Formation("3-5-2", 11, (3, 5, 2)),
        Formation("5-3-2", 11, (5, 3, 2)),
        Formation("3-3-1", 8, (3, 3, 1)),
        Formation("2-3-2", 8, (2, 3, 2)),
        Formation("2-2", 5, (2, 2)),
    )
}
