# Infinite Canvas for DB Diagram Editor

This document provides information about the infinite canvas feature implemented in the DB Diagram Editor application.

## Overview

The infinite canvas provides a virtually unlimited space for creating database diagrams, allowing users to pan across a large working area and zoom in/out while maintaining the center point of focus.

## Features

### Infinite Scrollable Area
- The canvas extends far beyond the visible viewport (10000x10000 pixels)
- Users can scroll in any direction to reach different areas of the workspace
- Grid background pattern maintains consistency across the entire canvas

### Navigation Controls

#### Mouse Controls
- **Scrolling**: Use the mouse wheel or trackpad gestures to scroll vertically
- **Horizontal Scrolling**: Use Shift+Mouse wheel or two-finger trackpad gestures
- **Dragging**: Click and drag on empty space to navigate (not implemented yet, future enhancement)

#### Keyboard Controls
- **Arrow Keys**: Press ↑ ↓ ← → to pan in corresponding directions
- **WASD Keys**: Alternative to arrow keys (W=up, A=left, S=down, D=right)

### Zoom Controls
- **Zoom In/Out Buttons**: Use the + and - buttons in the bottom right corner
- **Reset Zoom**: Return to the default zoom level (100%)
- **Zoom Behavior**: Maintains focus on the center point of the current viewport

## Technical Implementation

The infinite canvas is implemented through:

1. A large container element (10000x10000px) with overflow set to 'auto'
2. Grid background pattern applied to the entire canvas
3. Transform origin set to top-left (0,0) to ensure proper scaling behavior
4. Custom zoom handling that preserves the viewport center
5. Initial centering of the canvas in the viewport

## Best Practices

- Keep related tables grouped together within the viewport
- Use the zoom controls to get an overview of complex diagrams
- When searching for distant entities, use keyboard navigation to quickly move across the canvas

## Future Enhancements

- Middle-mouse button panning
- Canvas mini-map for navigation
- "Fit to view" option to show all entities
- Custom background colors or themes
