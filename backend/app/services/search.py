"""Search service for fuzzy text matching across items."""

from sqlalchemy.orm import Session
from sqlalchemy import or_, cast, Text
from app.models.item import Item


def item_search_filter(query: str):
    """Match query against item text fields (SQLite-safe JSON tag search)."""
    pattern = f"%{query}%"
    return or_(
        Item.name.ilike(pattern),
        Item.category.ilike(pattern),
        cast(Item.tags, Text).ilike(pattern),
        Item.notes.ilike(pattern),
    )


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
