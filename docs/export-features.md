# Export Features Documentation

## Overview

The db-diagram-editor includes export functionality for converting diagram models into:
1. SQL DDL (Data Definition Language) scripts
2. GraphQL SDL (Schema Definition Language)
3. JSON format (for diagram persistence)

This document explains how these export features work and how they can be extended.

## SQL DDL Export

The SQL DDL export generates standard SQL CREATE TABLE and ALTER TABLE statements from your diagram, allowing you to directly create the database schema in your SQL database system.

### Features

- **CREATE TABLE statements** for each entity in your diagram
- **Column definitions** with appropriate data types
- **Primary key constraints**
- **Foreign key constraints** based on relationships
- **Nullable/NOT NULL constraints**

### Example Output

```sql
-- SQL DDL for diagram: My Database Schema
-- Generated on: 2025-05-10T14:30:00.000Z

CREATE TABLE "Users" (
    "id" INTEGER PRIMARY KEY NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "created_at" DATETIME
);

CREATE TABLE "Posts" (
    "id" INTEGER PRIMARY KEY NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "user_id" INTEGER NOT NULL,
    "published" BOOLEAN DEFAULT FALSE
);

-- Foreign Key Constraints

ALTER TABLE "Posts"
    ADD CONSTRAINT fk_posts_users
    FOREIGN KEY ("user_id")
    REFERENCES "Users" ("id");
```

## GraphQL SDL Export

The GraphQL SDL export generates GraphQL type definitions that can be used with GraphQL API servers, allowing you to create a GraphQL schema that matches your data model.

### Features

- **Type definitions** for each entity in your diagram
- **Field definitions** with appropriate GraphQL scalar types
- **Non-nullable fields** (with ! suffix) for required fields
- **Relationship fields** including one-to-many and many-to-many

### Example Output

```graphql
# GraphQL SDL for diagram: My Database Schema
# Generated on: 2025-05-10T14:30:00.000Z

type User {
  id: Int!
  username: String!
  email: String!
  createdAt: DateTime

  # Relationships
  posts: [Post!]
}

type Post {
  id: Int!
  title: String!
  content: String
  userId: Int!
  published: Boolean

  # Relationships
  user: User!
}
```

## JSON Export

The JSON export saves the complete diagram state, including:
- All tables and their properties
- All columns and their properties
- All relationships between tables
- Visual layout information (positions, styling)

This format is primarily used for saving and loading diagrams within the application.

## Extending Export Functionality

To add a new export format:

1. Add a new method to the `ExportService` class
2. Create format-specific helper methods for formatting
3. Add a new export button to the diagram editor component
4. Add a new export method to the component that calls your service

## Technical Implementation

The export functionality is implemented in:
- `ExportService` (`src/app/core/export.service.ts`) - Core logic for generating export formats
- `DiagramEditorComponent` (`src/app/features/diagram-editor/diagram-editor.component.ts`) - UI integration
- `UtilsService` (`src/app/core/utils.service.ts`) - File download utilities

The export process follows these steps:
1. The user clicks an export button in the UI
2. The component retrieves the current diagram model 
3. The component calls the appropriate export service method
4. The export service transforms the diagram into the target format
5. The utility service creates a downloadable file for the user
