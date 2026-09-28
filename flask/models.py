"""
SQLAlchemy-Datenmodell für SmartFridge / KitchAI.

Die Tabellen bilden die bisherige JSON-Struktur ab (alles pro Benutzername),
sodass die Migration verlustfrei funktioniert:

  users.json     -> users      (Passwörter werden gehasht gespeichert)
  produkte.json  -> products
  rezepte.json   -> recipes
  ai_config.json -> settings   (Key/Value)
  config.json    -> settings   (external_api_key)
"""
from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(150), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    diet: Mapped[str] = mapped_column(Text, nullable=False, default="")

    products: Mapped[list["Product"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    recipes: Mapped[list["Recipe"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(
        String(150), ForeignKey("users.username", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    ablauf: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    user: Mapped["User"] = relationship(back_populates="products")


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(
        String(150), ForeignKey("users.username", ondelete="CASCADE"), index=True
    )
    # Fachliche ID des Rezepts (ISO-Zeitstempel), wird vom Frontend genutzt
    recipe_key: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    created_at: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Das eigentliche Rezept als JSON-String (dialektneutral)
    recipe_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    user: Mapped["User"] = relationship(back_populates="recipes")


class Setting(Base):
    __tablename__ = "settings"

    skey: Mapped[str] = mapped_column(String(100), primary_key=True)
    svalue: Mapped[str] = mapped_column(Text, nullable=False, default="")


def build_engine(url, connect_timeout=5):
    """Erzeugt eine SQLAlchemy-Engine mit sinnvollen Defaults je Dialekt."""
    if url.startswith("sqlite"):
        # SQLite (lokaler Test): Threads erlauben + FK-Constraints aktivieren,
        # damit ON DELETE CASCADE sich wie in MariaDB verhält.
        engine = create_engine(url, connect_args={"check_same_thread": False}, future=True)

        @event.listens_for(engine, "connect")
        def _enable_sqlite_fk(dbapi_conn, _rec):  # pragma: no cover - nur lokaler Test
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

        return engine
    # MariaDB/MySQL: Verbindungen vor Nutzung prüfen, recyceln, kurzes Timeout
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=1800,
        connect_args={"connect_timeout": connect_timeout},
        future=True,
    )


def make_session_factory(engine):
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def create_all(engine):
    Base.metadata.create_all(engine)
