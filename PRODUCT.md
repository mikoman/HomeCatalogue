# Home Catalogue

This document describes the existing application and its backend setup workflow.
The repository code supplies the product facts.

## Purpose

Home Catalogue helps a person record household items and find their storage locations.
A user can enter items manually or review suggestions from photo scans.

## Backend setup

The Settings page serves a person who operates their own backend and model servers.
The page retains the application's existing visual design.

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
