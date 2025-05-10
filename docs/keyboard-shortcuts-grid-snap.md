# Keyboard Shortcuts and Grid Snap

## Keyboard Shortcuts

The db-diagram-editor supports keyboard shortcuts to improve user productivity and make common operations more efficient.

### Current Keyboard Shortcuts

| Shortcut                                | Action       | Description                        |
|----------------------------------------|--------------|-----------------------------------|
| <kbd>Ctrl</kbd>+<kbd>Z</kbd>           | Undo         | Reverts the last action           |
| <kbd>Ctrl</kbd>+<kbd>Y</kbd>           | Redo         | Restores the last undone action   |
| <kbd>Cmd</kbd>+<kbd>Z</kbd>            | Undo         | Undo on macOS                     |
| <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Redo   | Redo on macOS                     |

### Technical Implementation

The keyboard shortcuts are implemented using Angular's `@HostListener` decorator to listen for keydown events on the window:

```typescript
@HostListener('window:keydown', ['$event'])
handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Check if Ctrl key is pressed (or Command key on Mac)
    const ctrlPressed = event.ctrlKey || event.metaKey;
    
    if (ctrlPressed) {
        switch (event.key.toLowerCase()) {
            case 'z':
                // Handle Undo/Redo for Z key
                if (event.shiftKey && event.metaKey) {
                    event.preventDefault();
                    this.redo();
                } else {
                    event.preventDefault();
                    this.undo();
                }
                break;
            case 'y':
                // Ctrl+Y for Redo (Windows/Linux)
                event.preventDefault();
                this.redo();
                break;
        }
    }
}
```

## Grid Snap Feature

The grid snap feature allows for precise alignment of diagram elements by snapping tables to a grid when moved.

### How to Use Grid Snap

1. Click the grid toggle button (![Grid Icon](https://fonts.gstatic.com/s/i/materialicons/grid_on/v12/24px.svg)) in the toolbar to enable or disable grid snapping.
2. When enabled, tables will automatically snap to the nearest grid point when dragged or moved.
3. The grid size is set to 20 pixels by default.

### Technical Implementation

The grid snap functionality works by rounding the node position coordinates to the nearest grid point:

```typescript
/**
 * Snaps a coordinate to the nearest grid point
 * @param coord The coordinate to snap
 * @returns The snapped coordinate
 */
private snapToGrid(coord: number): number {
    return Math.round(coord / this.gridSize) * this.gridSize;
}
```

When a node is moved, its position is processed through the grid snapping function if the feature is enabled:

```typescript
onNodePositionChange(node: EntityNode): void {
    if (node.x !== undefined && node.y !== undefined) {
        let x = node.x;
        let y = node.y;
        
        // Apply grid snapping if enabled
        if (this.gridSnapEnabled) {
            x = this.snapToGrid(x);
            y = this.snapToGrid(y);
        }
        
        this.diagramService.updateNode(node.id, { x, y });
    }
}
```

## Future Enhancements

### Planned Keyboard Shortcuts

- <kbd>Ctrl</kbd>+<kbd>S</kbd> for saving the diagram
- <kbd>Ctrl</kbd>+<kbd>N</kbd> for creating a new diagram
- <kbd>Del</kbd> or <kbd>Backspace</kbd> for deleting selected elements
- <kbd>Ctrl</kbd>+<kbd>A</kbd> for selecting all tables
- <kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd> for copy/paste operations

### Planned Grid Features

- Customizable grid size through settings
- Visual grid overlay option
- Alignment guides for multiple selections
- Snap to elements option (snap to other table edges)

## Accessibility Considerations

Keyboard shortcuts improve accessibility for users who have difficulty using pointing devices. However, they should always be supplementary to mouse/touch interactions and clearly documented in the UI.
