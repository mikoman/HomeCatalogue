"""Search service for fuzzy text matching across items."""

from sqlalchemy.orm import Session
from sqlalchemy import or_, cast, Text
from app.models.item import Item
from app.models.room import Room
from app.models.house import House
from app.models.container import Container
from app.services.embeddings import embed_text, cosine

# Cosine floor for a semantic match to count. Sentence-embedding pairs for
# related concepts sit ~0.4–0.7, unrelated ~0.1. Tune if recall feels off.
SEMANTIC_THRESHOLD = 0.35


def item_search_filter(query: str):
    """Match query against item text fields (SQLite-safe JSON tag search)."""
    pattern = f"%{query}%"
    return or_(
        Item.name.ilike(pattern),
        Item.category.ilike(pattern),
        cast(Item.tags, Text).ilike(pattern),
        Item.notes.ilike(pattern),
    )


def _catalogue_query(db: Session):
    """Joined Item+context query used by the catalogue-wide search."""
    return (
        db.query(Item, Room, House, Container)
        .join(Room, Item.room_id == Room.id)
        .join(House, Room.house_id == House.id)
        .outerjoin(Container, Item.container_id == Container.id)
    )


def hybrid_search(db: Session, query: str, limit: int = 100):
    """Keyword hits first (exact, fast), then semantic matches if embeddings exist.

    Returns (Item, Room, House, Container) tuples. Falls back to pure keyword
    search whenever embeddings are unavailable — semantic is never required.

    ponytail: brute-force cosine over all embedded items in Python. Fine to
    ~10k items for a personal catalogue; reach for sqlite-vss/faiss only if slow.
    """
    base = _catalogue_query(db)
    keyword_rows = (
        base.filter(item_search_filter(query))
        .order_by(House.name, Room.name, Container.name.nulls_last(), Item.name)
        .limit(limit)
        .all()
    )

    qvec = embed_text(query)
    if not qvec or len(keyword_rows) >= limit:
        return keyword_rows

    seen = {row[0].id for row in keyword_rows}
    scored = []
    for row in base.filter(Item.embedding.isnot(None)).all():
        item = row[0]
        if item.id in seen:
            continue
        score = cosine(qvec, item.embedding)
        if score >= SEMANTIC_THRESHOLD:
            scored.append((score, row))
    scored.sort(key=lambda s: s[0], reverse=True)
    extra = [row for _, row in scored[: limit - len(keyword_rows)]]
    return keyword_rows + extra


def search_items(
    db: Session,
    query: str,
    room_id: int | None = None,
    container_id: int | None = None,
    limit: int = 50,
) -> list[Item]:
    """
    Search items with fuzzy matching across name, category, and tags.
    Supports filtering by room and container.
    """
    sql_query = db.query(Item)

    if room_id:
        sql_query = sql_query.filter(Item.room_id == room_id)
    if container_id:
        sql_query = sql_query.filter(Item.container_id == container_id)

    # Fuzzy search across multiple fields
    sql_query = sql_query.filter(item_search_filter(query))

    return sql_query.limit(limit).order_by(Item.name).all()


def get_categories(db: Session, room_id: int | None = None) -> list[str]:
    """Get distinct categories, optionally filtered by room."""
    query = db.query(Item.category).distinct()
    if room_id:
        query = query.filter(Item.room_id == room_id)
    return [row[0] for row in query if row[0]]
