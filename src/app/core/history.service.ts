import { Injectable } from '@angular/core';
import { Diagram } from '../models';

/**
 * Interface for diagram history entry
 */
export interface HistoryEntry {
    diagram: Diagram;
    timestamp: Date;
    description: string;
}

/**
 * Service to handle undo/redo functionality for diagram editing
 */
@Injectable({
    providedIn: 'root'
})
export class HistoryService {
    /** Maximum number of history entries to keep */
    private readonly MAX_HISTORY_SIZE = 50;

    /** Undo stack */
    private undoStack: HistoryEntry[] = [];

    /** Redo stack */
    private redoStack: HistoryEntry[] = [];    /** Flag to disable history tracking temporarily */
    private historyDisabled = false;

    /**
     * Adds a new entry to the history stack
     * @param diagram The current diagram state
     * @param description Description of the change
     */
    addHistoryEntry(diagram: Diagram, description: string): void {
        if (this.historyDisabled) return;

        try {
            // Create a clean copy of the diagram without circular references
            const cleanDiagram: Diagram = {
                ...diagram,
                nodes: diagram.nodes.map(node => ({
                    id: node.id,
                    name: node.name,
                    x: node.x,
                    y: node.y,
                    columns: node.columns,
                    metadata: node.metadata
                    // Intentionally omit 'data' and 'label' which can cause circular references
                })),
                links: diagram.links.map(link => ({
                    id: link.id,
                    source: link.source,
                    target: link.target,
                    type: link.type,
                    label: link.label,
                    metadata: link.metadata
                    // Intentionally omit 'data' which can cause circular references
                }))
            };

            // Add to undo stack
            this.undoStack.push({
                diagram: cleanDiagram,
                timestamp: new Date(),
                description
            });

            // Clear redo stack when new actions are performed
            this.redoStack = [];

            // Limit stack size
            if (this.undoStack.length > this.MAX_HISTORY_SIZE) {
                this.undoStack.shift();
            }
        } catch (error) {
            console.error('Error adding history entry:', error);
        }
    }

    /**
     * Gets the previous state from history
     * @returns The previous diagram state and action description, or null if none exists
     */
    undo(): { diagram: Diagram; description: string } | null {
        if (this.undoStack.length <= 1) return null;

        // The current state is at the top of the stack
        const currentState = this.undoStack.pop();
        if (!currentState) return null;

        // Add to redo stack
        this.redoStack.push(currentState);

        // Return the previous state (now at the top of the undo stack)
        const previousState = this.undoStack[this.undoStack.length - 1];
        return {
            diagram: previousState.diagram,
            description: `Undo: ${currentState.description}`
        };
    }

    /**
     * Gets the next state from the redo history
     * @returns The next diagram state and action description, or null if none exists
     */
    redo(): { diagram: Diagram; description: string } | null {
        if (this.redoStack.length === 0) return null;

        // Get the last redone state
        const redoState = this.redoStack.pop();
        if (!redoState) return null;

        // Add back to undo stack
        this.undoStack.push(redoState);

        return {
            diagram: redoState.diagram,
            description: `Redo: ${redoState.description}`
        };
    }

    /**
     * Checks if there are actions that can be undone
     * @returns True if undo is available
     */
    canUndo(): boolean {
        return this.undoStack.length > 1;
    }

    /**
     * Checks if there are actions that can be redone
     * @returns True if redo is available
     */
    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /**
     * Temporarily disables history tracking
     * Used when loading a diagram or performing an undo/redo
     */
    disableHistory(): void {
        this.historyDisabled = true;
    }

    /**
     * Re-enables history tracking
     */
    enableHistory(): void {
        this.historyDisabled = false;
    }

    /**
     * Clears the history stacks
     * Used when creating a new diagram
     */
    clearHistory(): void {
        this.undoStack = [];
        this.redoStack = [];
    }
}
