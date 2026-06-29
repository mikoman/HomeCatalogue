"""Search service for fuzzy text matching across items."""

from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.item import Item


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
    search_pattern = f"%{query}%"
    sql_query = db.query(Item)

    if room_id:
        sql_query = sql_query.filter(Item.room_id == room_id)
    if container_id:
        sql_query = sql_query.filter(Item.container_id == container_id)

    # Fuzzy search across multiple fields
    sql_query = sql_query.filter(
        or_(
            Item.name.ilike(search_pattern),
            Item.category.ilike(search_pattern),
            Item.tags.astext.contains(query),  # JSON array search
            Item.notes.ilike(search_pattern),
        )
    )

    return sql_query.limit(limit).order_by(Item.name).all()


def get_categories(db: Session, room_id: int | None = None) -> list[str]:
    """Get distinct categories, optionally filtered by room."""
    query = db.query(Item.category).distinct()
    if room_id:
        query = query.filter(Item.room_id == room_id)
    return [row[0] for row in query if row[0]]
