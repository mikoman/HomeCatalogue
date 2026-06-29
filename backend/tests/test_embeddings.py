"""Cosine similarity for semantic search ranking."""

from app.services.embeddings import cosine


def test_identical_is_one():
    assert cosine([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) == 1.0


def test_orthogonal_is_zero():
    assert cosine([1.0, 0.0], [0.0, 1.0]) == 0.0


def test_opposite_is_minus_one():
    assert cosine([1.0, 0.0], [-1.0, 0.0]) == -1.0


def test_mismatched_length_is_zero():
    # Guards against ranking against vectors from a different embedding model.
    assert cosine([1.0, 2.0, 3.0], [1.0, 2.0]) == 0.0


def test_empty_is_zero():
    assert cosine([], [1.0]) == 0.0
    assert cosine([0.0, 0.0], [0.0, 0.0]) == 0.0
