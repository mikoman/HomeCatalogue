"""Shared validation for house, room, and container names."""

from pydantic import BaseModel, field_validator


class LocationFields(BaseModel):
    @field_validator("name", check_fields=False)
    @classmethod
    def validate_name(cls, value):
        if value is None or not value.strip():
            raise ValueError("Enter a name.")
        return value.strip()

    @field_validator("description", check_fields=False)
    @classmethod
    def validate_description(cls, value):
        if value is None:
            raise ValueError("The description must be text.")
        return value
