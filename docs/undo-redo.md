# Undo/Redo Functionality

## Overview

The db-diagram-editor features a comprehensive undo/redo system that allows users to revert changes and restore previous states of their diagrams. This document explains how the undo/redo system works and how it's implemented.

## User Experience

### Undo/Redo Actions

The following actions can be undone/redone:

- Creating tables
- Updating table properties
- Deleting tables
- Adding columns
- Updating columns
- Removing columns
- Creating relationships
- Updating relationships
- Deleting relationships
- Repositioning nodes

### How to Use

- Click the **Undo** button (↩️) in the toolbar to revert the last action
- Click the **Redo** button (↪️) in the toolbar to restore the last undone action
- Buttons are disabled when no actions are available to undo or redo

### Keyboard Shortcuts

The following keyboard shortcuts are available:

- `Ctrl+Z` (Windows/Linux) or `Cmd+Z` (Mac): Undo
- `Ctrl+Y` (Windows/Linux) or `Cmd+Shift+Z` (Mac): Redo

## Technical Implementation

### Architecture

The undo/redo system is implemented using a command pattern approach with history stacks:

1. **History Service**: Maintains undo and redo stacks of diagram states
2. **Diagram Service**: Records state changes and applies undo/redo operations
3. **Diagram Editor Component**: Provides the UI for undo/redo operations

### Key Components

#### History Service

The `HistoryService` (`src/app/core/history.service.ts`) manages:

- Undo stack: Array of previous diagram states
- Redo stack: Array of states that have been undone
- Stack size limits to prevent memory issues
- Ability to temporarily disable history tracking

#### History Entry Structure

Each history entry contains:

```typescript
interface HistoryEntry {
    diagram: Diagram;     // Complete diagram state snapshot
    timestamp: Date;      // When the change occurred
    description: string;  // Human-readable description of the change
}
```

### How It Works

#### Recording Changes

1. When a change is made to the diagram (e.g., adding a node), a snapshot of the entire diagram state is created
2. This snapshot, along with a description of the change, is pushed onto the undo stack
3. The redo stack is cleared whenever a new change is made

#### Undoing Changes

1. When the user initiates an undo, the current state is moved to the redo stack
2. The previous state from the undo stack is restored
3. History tracking is temporarily disabled to prevent the undo itself from being recorded as a new action

#### Redoing Changes

1. When the user initiates a redo, the most recent state from the redo stack is restored
2. This state is moved back to the undo stack
3. History tracking is temporarily disabled during this operation

### Performance Considerations

- Complete diagram states are serialized to create deep copies and prevent reference issues
- The maximum history size is limited to control memory usage
- Undo/redo operations maintain relationships between tables and their columns

## Future Enhancements

Potential improvements to the undo/redo system:

1. **Command Pattern Enhancement**: Record only the specific commands/actions rather than entire diagram states
2. **Granular Undo**: Allow undoing specific parts of compound actions
3. **History Visualization**: Provide a visual history timeline for direct navigation
4. **Persistent History**: Save undo/redo history across sessions

## Limitations

- History is cleared when creating a new diagram or loading an existing one
- Very large diagrams may experience slight performance impact when recording history
- Visual animations for undo/redo operations are not currently implemented
