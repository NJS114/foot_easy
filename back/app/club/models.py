from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, IdMixin, TimestampMixin


class Club(IdMixin, TimestampMixin, Base):
    __tablename__ = "clubs"

    name: Mapped[str] = mapped_column(String(120), unique=True)
    city: Mapped[str | None] = mapped_column(String(120))
    primary_color: Mapped[str] = mapped_column(String(7), default="#16a34a")
