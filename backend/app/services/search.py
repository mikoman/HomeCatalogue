"""Search service for fuzzy text matching across items."""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, cast, case, Text
from app.models.item import Item
from app.models.room import Room
from app.models.house import House
from app.models.container import Container
from app.services.embeddings import embed_text, cosine

# Cosine floor for a semantic match to count. Sentence-embedding pairs for
# related concepts sit ~0.4–0.7, unrelated ~0.1. Tune if recall feels off.
SEMANTIC_THRESHOLD = 0.35


def _literal_pattern(query: str) -> str:
    return query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def item_search_filter(query: str, *, include_locations: bool = False):
    """Match each word against item fields. Treat SQL wildcard characters as text."""
    fields = [Item.name, Item.category, cast(Item.tags, Text), Item.notes]
    if include_locations:
        fields.extend([Room.name, House.name, Container.name])
    terms = query.split()
    if not terms:
        return Item.id.is_(None)
    return and_(
        *(or_(*(field.ilike(f"%{_literal_pattern(term)}%", escape="\\") for field in fields)) for term in terms)
    )


def _catalogue_query(db: Session):
    """Joined Item+context query used by the catalogue-wide search."""
    return (
        db.query(Item, Room, House, Container)
        .join(Room, Item.room_id == Room.id)
        .join(House, Room.house_id == House.id)
        .outerjoin(Container, Item.container_id == Container.id)
    )


def hybrid_search(db: Session, query: str, limit: int = 100, *, semantic: bool = False):
    """Keyword hits first (exact, fast), then semantic matches if embeddings exist.

    Returns (Item, Room, House, Container) tuples. Falls back to pure keyword
    search whenever embeddings are unavailable — semantic is never required.

    Semantic search requires an explicit request because the model can be slow.
    """
    query = query.strip()
    if not query:
        return []
    base = _catalogue_query(db)
    literal = _literal_pattern(query)
    keyword_rows = (
        base.filter(item_search_filter(query, include_locations=True))
        .order_by(
            case(
                (Item.name.ilike(literal, escape="\\"), 0),
                (Item.name.ilike(f"{literal}%", escape="\\"), 1),
                else_=2,
            ),
            House.name, Room.name, Container.name.nulls_last(), Item.name, Item.id,
        )
        .limit(limit)
        .all()
    )

    if not semantic or len(keyword_rows) >= limit:
        return keyword_rows
    qvec = embed_text(query)
    if not qvec:
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

    return sql_query.order_by(Item.name, Item.id).limit(limit).all()


def get_categories(db: Session, room_id: int | None = None) -> list[str]:
    """Get distinct categories, optionally filtered by room."""
    query = db.query(Item.category).distinct()
    if room_id:
        query = query.filter(Item.room_id == room_id)
    return [row[0] for row in query if row[0]]
