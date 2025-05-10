# DbDiagramEditor

An interactive browser-based database diagram editor built with Angular. Create, edit, and export database schemas with ease.

## Features

- **Interactive Diagram Editing**:
  - Create tables with columns
  - Define relationships between tables
  - Drag and drop positioning
  - Grid snap for precise alignment
  - Pan and zoom navigation

- **Rich Column Properties**:
  - Primary keys
  - Foreign keys
  - Data types
  - Nullable constraints

- **Relationship Types**:
  - One-to-One (1:1)
  - One-to-Many (1:N)
  - Many-to-One (N:1)
  - Many-to-Many (N:M)

- **Export Options**:
  - SQL DDL scripts
  - GraphQL SDL (Schema Definition Language)
  - JSON (for sharing/loading diagrams)

- **History & Editing**:
  - Undo/Redo functionality
  - Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
  - Autosave to localStorage
  - Server-side storage (via API)

## Development

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.7.

### Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

### Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

### Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

### Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Documentation

Additional documentation:

- [Export Features](./docs/export-features.md)
- [Undo/Redo Functionality](./docs/undo-redo.md)
- [Keyboard Shortcuts & Grid Snap](./docs/keyboard-shortcuts-grid-snap.md)

## Roadmap

- ✅ SQL DDL export 
- ✅ GraphQL SDL export
- ✅ Undo/Redo functionality
- ✅ Grid snap for precise alignment
- ✅ Keyboard shortcuts for editing
- Import from existing database
- Themes and styling options
- Collaborative editing

## Technologies

- Angular 19+
- TypeScript
- RxJS
- @swimlane/ngx-graph (based on D3.js)
- Angular Material

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
