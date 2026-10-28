# 2. PostgreSQL with EF Core, one schema per module

Status: accepted · 2026-10-28

## Context
Modules must not read each other's tables, but we want one database to run and back up.

## Decision
PostgreSQL with EF Core. Each module has its own `DbContext` and its own schema (`content`, `publishing`). Rendering has no database. Integration tests run against PostgreSQL in a container; SQLite is allowed only for fast unit-level tests.

## Consequences
- Cross-module joins are impossible by design; modules ask each other through contracts.
- Published releases are files (a local folder now, blob storage later), not database rows.
