# Home Catalogue

This document describes the existing application, its main workflows, and its backend setup.
The repository code supplies the product facts.

## Purpose

Home Catalogue helps a person record household items and find their storage locations.
A user can enter items manually or review suggestions from photo scans.

## Main workflows

Phone scanning and desktop browsing are the confirmed priorities.
The catalogue follows the hierarchy house, room, container, and item.
Room galleries show object photos, names, and storage locations.
Grouped items retain their location context.

Users can take a photo, choose existing photos, or enter an item manually.
Scan results are suggestions. Users review names, categories, and destinations before saving selected results.
Uncertain results, possible duplicates, and missing destinations remain visible during review.
Users can manage nested containers and move items between locations.

Source photos are user data. Generated concept photos and test fixtures are not shipped catalogue records.

## Theme preference

The user selected Folio and requested a dark mode switch.
The theme follows the operating system until the user chooses light or dark mode.
The choice persists locally when browser storage is available and synchronizes across tabs.
The same choice applies to the application shell, Settings, and scan review.

## Backend setup

The Settings page serves a person who operates their own backend and model servers.
The page uses the shared Folio design and supports both light and dark themes.

The user selects one of six providers: Ollama, LM Studio, oMLX, OpenRouter, OpenAI, or Anthropic.
Each provider retains its own model, endpoint, and optional credential.
Local providers also retain an optional embedding model.

Selecting a provider for editing does not change the active provider.
**Save and use provider** saves its fields and selects it for new scans.
**Save provider only** saves its fields without selecting another provider.
Both actions update new scans when the edited provider is already active.

The page supports model discovery, model search, direct model IDs, and connection tests.
Connection tests do not perform image inference.
The user installs models and starts local servers outside this application.

## Credentials

The backend accepts a saved key or an environment key.
A blank key field preserves the existing key.
The user can replace a key, remove it, or restore the environment key.
A local endpoint change does not transfer the previous key to another server.

The backend saves runtime settings and optional keys in an owner-only file.
The file contains unencrypted keys. API responses contain key status only.
The page does not persist keys in browser storage.
The application has no sign-in and requires a trusted deployment boundary.

## Scan controls

The user selects no boxes, boxes from the vision model, or boxes from a separate detector server.
Settings controls the detector endpoint and tests its health.
The detector process controls its own model and device.

The user can change the maximum image edge, output limit, and Ollama context size.
The model server controls context for LM Studio and oMLX.
The user must review generated items and estimated boxes.

## Catalogue controls

The user can reindex saved items with the active local embedding model.
Keyword search remains available without embeddings.
Catalogue reset requires an explicit confirmation and preserves provider settings.

## Interface constraints

The interface must work on desktop and phone viewports.
It must distinguish the active provider from the provider under edit.
It must identify unsaved changes and provide readable status and error messages.
It must preserve the existing catalogue, capture, search, and reset workflows.
