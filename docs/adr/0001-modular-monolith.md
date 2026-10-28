# 1. A modular monolith with three modules

Status: accepted · 2026-10-28

## Context
Hivesite is built mostly by agents, one team per area. We want hard boundaries that a build can check, without the cost of running several services.

## Decision
One ASP.NET Core host (.NET 10) with three modules: Content, Rendering and Publishing. Each module has a `.Contracts` project with the interfaces and events other modules may use. Nothing else is shared except `Hivesite.Shared`. Architecture tests fail the build when a module references another module's internals.

## Consequences
- One deployable and one database server.
- Module boundaries double as agent boundaries: each dev agent writes only in its module.
- Splitting a module into a service later means replacing in-process contracts with HTTP or messages.
