// filepath: d:\Projects\db-diagram-editor\src\app\features\diagram-editor\diagram-editor.component.ts
import { Component, OnInit, AfterViewInit, ViewChild, ChangeDetectorRef, HostListener, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { Subject } from 'rxjs';

import { DiagramService } from './diagram.service';
import { UtilsService } from '../../core/utils.service';
import { ExportService } from '../../core/export.service';
import { EntityNode, Column } from '../../models/entity-node.model';
import { RelationLink, RelationType } from '../../models/relation-link.model';
import { Diagram } from '../../models/diagram.model';

@Component({
    selector: 'app-diagram-editor',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        MatSnackBarModule,
        MatCheckboxModule
    ],
    templateUrl: './diagram-editor.component.html',
    styleUrls: ['./diagram-editor.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiagramEditorComponent implements OnInit, AfterViewInit {
    // Services
    private readonly diagramService = inject(DiagramService);
    private readonly utilsService = inject(UtilsService);
    private readonly exportService = inject(ExportService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly cdr = inject(ChangeDetectorRef);

    // ViewChild references
    @ViewChild('fileInput') fileInput: any;
    @ViewChild('columnContextMenuTrigger') columnContextMenuTrigger: any;
    @ViewChild('linkContextMenuTrigger') linkContextMenuTrigger: any;

    // Graph data
    nodes: EntityNode[] = [];
    links: RelationLink[] = [];

    // Selected element tracking
    selectedNode: EntityNode | null = null;
    selectedLink: RelationLink | null = null;
    selectedColumn: Column | null = null;
    selectedNodeId: string | null = null;
    selectedColumnIndex: number = -1;

    // Update when the graph should refresh
    update$ = new Subject<void>();

    // Track the current operation
    isCreatingLink = false;
    sourceNodeForLink: string | null = null;

    // Track drag & drop operation
    isDragging = false;
    dragStartX = 0;
    dragStartY = 0;
    currentNodeX = 0;
    currentNodeY = 0;
    currentDragNode: EntityNode | null = null;

    // Grid snap feature
    gridSnapEnabled = false;
    gridSize = 20;

    // Zoom tracking
    currentZoom = 1;
    readonly zoomStep = 0.1;
    readonly minZoom = 0.5;
    readonly maxZoom = 2.0;

    // Make RelationType available in template
    RelationType = RelationType;

    // Properties panel position
    propertiesPanelPosition = { x: 20, y: 60 };
    isPropertiesPanelDragging = false;

    constructor() { } ngOnInit(): void {
        // Subscribe to data from the diagram service
        this.diagramService.nodes$.subscribe(nodes => {
            console.log('Received updated nodes:', nodes);
            this.nodes = nodes;

            // When nodes update, we need to make sure links are properly rendered
            // This ensures link endpoints stay attached to node edges
            this.update$.next();
            this.cdr.markForCheck();
        });

        this.diagramService.links$.subscribe(links => {
            console.log('Received updated links:', links);
            this.links = links;
            this.cdr.markForCheck();
        });

        // Load initial diagram or create new one
        const currentDiagram = this.diagramService.getCurrentDiagram();
        if (!currentDiagram) {
            this.createNewDiagram();
        }
    }

    /**
     * Creates a new entity node
     */
    createNewNode(): void {
        const id = 'node-' + this.utilsService.generateId();
        const name = 'Table' + (this.nodes.length + 1);
        const x = Math.random() * 500 + 50;
        const y = Math.random() * 300 + 50;

        const node: EntityNode = {
            id,
            name,
            x,
            y,
            columns: [],
            dimension: {
                width: 200,
                height: 150
            },
            metadata: {
                selected: false,
                expanded: true
            }
        };

        this.diagramService.addNode(node);
        this.selectedNode = node;

        // Add a default primary key column
        this.addColumn(id);
    }

    /**
     * Selects a node for editing or linking
     */
    onNodeSelect(node: EntityNode): void {
        console.log('Node selected:', node.id);

        // If we're in link creation mode, complete the relationship
        if (this.isCreatingLink && this.sourceNodeForLink) {
            if (this.sourceNodeForLink !== node.id) {
                this.completeRelationship(node.id);
            }
            return;
        }

        this.selectedNode = node;
        this.selectedLink = null;
        this.cdr.markForCheck();
    }

    /**
     * Starts the relationship creation mode
     * @param sourceNodeId ID of the source node
     */
    startLinkCreation(sourceNodeId?: string): void {
        this.isCreatingLink = true;
        this.sourceNodeForLink = sourceNodeId || (this.selectedNode ? this.selectedNode.id : null);

        if (!this.sourceNodeForLink) {
            this.snackBar.open('Please select a source table first', 'OK', { duration: 3000 });
            this.isCreatingLink = false;
            return;
        }

        this.snackBar.open('Select a target table to create a relationship', 'OK', { duration: 3000 });
    }

    /**
     * Completes the relationship creation by connecting to a target node
     * @param targetNodeId ID of the target node
     */
    completeRelationship(targetNodeId: string): void {
        if (!this.sourceNodeForLink) return;

        this.createLink(this.sourceNodeForLink, targetNodeId);

        // Reset link creation state
        this.isCreatingLink = false;
        this.sourceNodeForLink = null;
        this.cdr.markForCheck();
    }

    /**
     * Selects a link for editing
     */
    onLinkSelect(link: RelationLink, { forceSelect }: { forceSelect?: boolean } = {}): void {
        console.log('Link selected:', link.id);

        if (forceSelect || !this.selectedLink || this.selectedLink.id !== link.id) {
            this.selectedLink = link;
            this.selectedNode = null;
            this.snackBar.open(`Editing ${link.type} relationship`, 'OK', {
                duration: 2000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom'
            });
        }

        this.cdr.markForCheck();
    }

    /**
     * Updates a node's properties
     */
    updateNode(nodeId: string, updates: Partial<EntityNode>): void {
        this.diagramService.updateNode(nodeId, updates);

        // If updates affect node dimensions, refresh connected links
        if (updates.columns || updates.name ||
            updates.dimension?.width !== undefined ||
            updates.dimension?.height !== undefined) {
            this.refreshLinksForNode(nodeId);
        }
    }

    /**
     * Updates a link's properties
     */
    updateLink(linkId: string, updates: Partial<RelationLink>): void {
        this.diagramService.updateLink(linkId, updates);
    }

    /**
     * Removes a node from the diagram
     */
    removeNode(nodeId: string): void {
        if (confirm('Are you sure you want to delete this table and all its relationships?')) {
            this.diagramService.removeNode(nodeId);

            if (this.selectedNode && this.selectedNode.id === nodeId) {
                this.selectedNode = null;
            }
        }
    }

    /**
     * Removes a link from the diagram
     */
    removeLink(linkId: string): void {
        if (confirm('Are you sure you want to delete this relationship?')) {
            this.diagramService.removeLink(linkId);

            if (this.selectedLink && this.selectedLink.id === linkId) {
                this.selectedLink = null;
            }
        }
    }

    /**
     * Adds a column to a table
     */
    addColumn(nodeId: string): void {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const columnName = prompt('Column name:', 'column' + (node.columns.length + 1));
        if (!columnName) return;

        const columnType = prompt('Data type:', 'VARCHAR(255)');
        if (!columnType) return;

        const newColumn: Column = {
            name: columnName,
            dataType: columnType,
            isPrimaryKey: node.columns.length === 0, // First column is primary key by default
            isForeignKey: false,
            isNullable: false
        }; const updatedColumns = [...(node.columns || []), newColumn];
        this.diagramService.updateNode(nodeId, { columns: updatedColumns });

        // Refresh any links connected to this node to update their connection points
        this.refreshLinksForNode(nodeId);
    }

    /**
     * Updates a column in a table
     */
    updateColumn(nodeId: string, columnIndex: number, updates: Partial<Column>): void {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node || !node.columns || columnIndex >= node.columns.length) return; const updatedColumns = [...node.columns];
        updatedColumns[columnIndex] = { ...updatedColumns[columnIndex], ...updates };

        this.diagramService.updateNode(nodeId, { columns: updatedColumns });

        // Refresh any links connected to this node if update might affect node dimensions
        if (updates.name || updates.dataType) {
            this.refreshLinksForNode(nodeId);
        }
    }

    /**
     * Removes a column from a table
     */
    removeColumn(nodeId: string, columnIndex: number): void {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node || !node.columns || columnIndex >= node.columns.length) return;

        const isPrimaryKey = node.columns[columnIndex].isPrimaryKey;
        if (isPrimaryKey && !confirm('This is a primary key column. Are you sure you want to delete it?')) {
            return;
        } const updatedColumns = [...node.columns];
        updatedColumns.splice(columnIndex, 1);

        this.diagramService.updateNode(nodeId, { columns: updatedColumns });

        // Refresh any links connected to this node to update their connection points
        this.refreshLinksForNode(nodeId);
    }

    /**
     * Saves the current diagram
     */
    saveDiagram(): void {
        this.diagramService.saveDiagram().subscribe(
            () => {
                this.snackBar.open('Diagram saved successfully', 'Close', { duration: 3000, panelClass: 'success-notification' });
            },
            error => {
                console.error('Error saving diagram:', error);
                this.snackBar.open('Error saving diagram', 'Close', { duration: 3000, panelClass: 'error-notification' });
            }
        );
    }    /**
     * Exports the diagram as JSON
     */
    exportDiagram(): void {
        const json = this.diagramService.exportDiagramAsJson();
        if (json === '{}') {
            this.snackBar.open('No diagram to export', 'Close', { duration: 3000 });
            return;
        }

        this.exportService.downloadAsJson(json, 'diagram.json');
        this.snackBar.open('Diagram exported as JSON', 'Close', { duration: 3000 });
    }

    /**
     * Exports the diagram as SQL DDL
     */
    exportAsSqlDdl(): void {
        const currentDiagram = this.diagramService.getCurrentDiagram();
        if (!currentDiagram) {
            this.snackBar.open('No diagram to export', 'Close', { duration: 3000 });
            return;
        }

        // Create a diagram object with the current nodes and links
        const diagram: Diagram = {
            ...currentDiagram,
            nodes: this.nodes,
            links: this.links
        };

        const sql = this.exportService.exportAsSqlDdl(diagram);
        this.exportService.downloadAsText(sql, 'diagram.sql');
        this.snackBar.open('Diagram exported as SQL DDL', 'Close', { duration: 3000 });
    }

    /**
     * Exports the diagram as GraphQL SDL
     */
    exportAsGraphQLSdl(): void {
        const currentDiagram = this.diagramService.getCurrentDiagram();
        if (!currentDiagram) {
            this.snackBar.open('No diagram to export', 'Close', { duration: 3000 });
            return;
        }

        // Create a diagram object with the current nodes and links
        const diagram: Diagram = {
            ...currentDiagram,
            nodes: this.nodes,
            links: this.links
        };

        const graphql = this.exportService.exportAsGraphQLSdl(diagram);
        this.exportService.downloadAsText(graphql, 'schema.graphql');
        this.snackBar.open('Diagram exported as GraphQL SDL', 'Close', { duration: 3000 });
    }

    /**
     * Opens the file input dialog for importing
     */
    openImportDialog(): void {
        this.fileInput.nativeElement.click();
    }

    /**
     * Imports a diagram from a file
     */
    importDiagram(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = () => {
            const json = reader.result as string;
            try {
                if (this.diagramService.importDiagramFromJson(json)) {
                    this.snackBar.open('Diagram imported successfully', 'Close', { duration: 3000, panelClass: 'success-notification' });
                } else {
                    this.snackBar.open('Error importing diagram: Invalid format', 'Close', { duration: 3000, panelClass: 'error-notification' });
                }
            } catch (error) {
                console.error('Import error:', error);
                this.snackBar.open('Error importing diagram', 'Close', { duration: 3000, panelClass: 'error-notification' });
            }
        };

        reader.readAsText(file);
        input.value = ''; // Reset input
    }    /**
     * Handles node position changes from dragging
     */
    onNodePositionChange(node: EntityNode): void {
        if (this.gridSnapEnabled) {
            // Snap to grid
            const snappedX = Math.round(node.x! / this.gridSize) * this.gridSize;
            const snappedY = Math.round(node.y! / this.gridSize) * this.gridSize;
            this.updateNode(node.id, { x: snappedX, y: snappedY });
        } else {
            this.updateNode(node.id, { x: node.x, y: node.y });
        }

        // Explicitly refresh links for this node to ensure they remain attached to edges
        this.refreshLinksForNode(node.id);
    }

    /**
     * Creates a new empty diagram
     */
    createNewDiagram(): void {
        const name = prompt('Diagram name:', 'New Diagram');
        if (name) {
            this.diagramService.createNewDiagram(name);
            this.selectedNode = null;
            this.selectedLink = null;
        }
    }

    /**
     * Undoes the last action
     */
    undo(): void {
        if (this.diagramService.undo()) {
            this.snackBar.open('Undo successful', 'Close', { duration: 2000 });
        } else {
            this.snackBar.open('Nothing to undo', 'Close', { duration: 2000 });
        }
    }

    /**
     * Redoes the last undone action
     */
    redo(): void {
        if (this.diagramService.redo()) {
            this.snackBar.open('Redo successful', 'Close', { duration: 2000 });
        } else {
            this.snackBar.open('Nothing to redo', 'Close', { duration: 2000 });
        }
    }

    /**
     * Checks if undo is available
     */
    canUndo(): boolean {
        return this.diagramService.canUndo();
    }

    /**
     * Checks if redo is available
     */
    canRedo(): boolean {
        return this.diagramService.canRedo();
    }

    /**
     * Global keyboard shortcuts
     */
    @HostListener('window:keydown', ['$event'])
    handleKeyboardShortcuts(event: KeyboardEvent): void {
        // Ctrl+Z = Undo
        if (event.ctrlKey && event.key === 'z') {
            this.undo();
            event.preventDefault();
        }

        // Ctrl+Y = Redo
        if (event.ctrlKey && event.key === 'y') {
            this.redo();
            event.preventDefault();
        }

        // Delete = Remove selected element
        if (event.key === 'Delete') {
            if (this.selectedNode) {
                this.removeNode(this.selectedNode.id);
                event.preventDefault();
            } else if (this.selectedLink) {
                this.removeLink(this.selectedLink.id);
                event.preventDefault();
            }
        }

        // Escape = Cancel link creation
        if (event.key === 'Escape' && this.isCreatingLink) {
            this.isCreatingLink = false;
            this.sourceNodeForLink = null;
            event.preventDefault();
        }

        // WASD or Arrow keys = Pan the canvas
        if ((!event.ctrlKey && !event.altKey && !event.metaKey) &&
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(event.key)) {
            const container = document.querySelector('.graph-container') as HTMLElement;
            if (container) {
                const panAmount = 50; // Pixels to pan per key press

                switch (event.key) {
                    case 'ArrowUp':
                    case 'w':
                        container.scrollTop -= panAmount;
                        break;
                    case 'ArrowDown':
                    case 's':
                        container.scrollTop += panAmount;
                        break;
                    case 'ArrowLeft':
                    case 'a':
                        container.scrollLeft -= panAmount;
                        break;
                    case 'ArrowRight':
                    case 'd':
                        container.scrollLeft += panAmount;
                        break;
                }
                event.preventDefault();
            }
        }
    }

    /**
     * Snaps a coordinate to the nearest grid point
     */
    snapToGrid(coord: number): number {
        return Math.round(coord / this.gridSize) * this.gridSize;
    }

    /**
     * Toggles the grid snap feature
     */
    toggleGridSnap(): void {
        this.gridSnapEnabled = !this.gridSnapEnabled;

        if (this.gridSnapEnabled) {
            // Snap all nodes to grid
            this.nodes.forEach(node => {
                if (node.x !== undefined && node.y !== undefined) {
                    const snappedX = this.snapToGrid(node.x);
                    const snappedY = this.snapToGrid(node.y);
                    this.updateNode(node.id, { x: snappedX, y: snappedY });
                }
            });
        }
    }

    /**
     * Zooms in the diagram
     */
    zoomIn(): void {
        if (this.currentZoom < this.maxZoom) {
            this.currentZoom += this.zoomStep;
            this.applyZoom();
        }
    }

    /**
     * Zooms out the diagram
     */
    zoomOut(): void {
        if (this.currentZoom > this.minZoom) {
            this.currentZoom -= this.zoomStep;
            this.applyZoom();
        }
    }

    /**
     * Resets zoom to the default level
     */
    resetZoom(): void {
        this.currentZoom = 1;
        this.applyZoom();
    }    /**
     * Applies the current zoom level
     */
    private applyZoom(): void {
        // Now zoom level is applied to the entity-graph element through Angular binding

        // Center the graph in the viewport after zooming
        const container = document.querySelector('.graph-container') as HTMLElement;
        if (container) {
            // Adjust scroll position to maintain the center point
            const centerX = (container.scrollLeft + container.clientWidth / 2) / this.currentZoom;
            const centerY = (container.scrollTop + container.clientHeight / 2) / this.currentZoom;

            // Apply new zoom (happens via template binding)
            this.cdr.detectChanges();

            // Re-center at the same logical position
            container.scrollLeft = centerX * this.currentZoom - container.clientWidth / 2;
            container.scrollTop = centerY * this.currentZoom - container.clientHeight / 2;
        }

        this.cdr.markForCheck();
    }

    /**
     * Shows a prompt dialog for input
     */
    prompt(message: string, defaultValue: string = ''): string | null {
        return window.prompt(message, defaultValue);
    }

    /**
     * Starts dragging a node
     */
    startDragging(event: MouseEvent, node: EntityNode): void {
        // Skip if we're in link creation mode
        if (this.isCreatingLink) return;

        // Prevent event propagation and default behavior
        event.stopPropagation();
        event.preventDefault();

        // Store initial positions
        this.isDragging = true;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
        this.currentNodeX = node.x || 0;
        this.currentNodeY = node.y || 0;
        this.currentDragNode = node;

        // Add mouse move and mouse up event listeners to the document
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
    }

    /**
     * Handle mouse move during drag
     */
    private readonly onMouseMove = (event: MouseEvent): void => {
        if (!this.isDragging || !this.currentDragNode) return;

        // Calculate the new position
        const dx = event.clientX - this.dragStartX;
        const dy = event.clientY - this.dragStartY;

        let newX = this.currentNodeX + dx;
        let newY = this.currentNodeY + dy;

        // Snap to grid if enabled
        if (this.gridSnapEnabled) {
            newX = this.snapToGrid(newX);
            newY = this.snapToGrid(newY);
        }

        // Update the node position in both the component state and local data
        this.currentDragNode.x = newX;
        this.currentDragNode.y = newY;

        // Update the node position (this triggers a UI update)
        this.updateNode(this.currentDragNode.id, { x: newX, y: newY });

        // Force change detection to ensure UI reflects the changes immediately
        this.cdr.detectChanges();
    };    /**
     * Handle mouse up after dragging
     */    private readonly onMouseUp = (): void => {
        if (this.isDragging && this.currentDragNode) {
            // Make sure to finalize with the most current position
            const finalX = this.currentDragNode.x || 0;
            const finalY = this.currentDragNode.y || 0;

            console.log('Finalizing drag:', this.currentDragNode.id, 'to position:', finalX, finalY);

            // Apply any grid snapping if enabled
            let snappedX = finalX;
            let snappedY = finalY;

            if (this.gridSnapEnabled) {
                snappedX = this.snapToGrid(finalX);
                snappedY = this.snapToGrid(finalY);
            }            // Call updateNode one final time with the final position
            this.diagramService.updateNode(this.currentDragNode.id, {
                x: snappedX,
                y: snappedY
            });

            // Refresh links for this node to ensure they connect properly
            this.refreshLinksForNode(this.currentDragNode.id);
        }

        // Reset the drag state
        this.isDragging = false;
        this.currentDragNode = null;

        // Remove the event listeners
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    };

    /**
     * Opens the context menu for a column
     */
    openColumnMenu(event: MouseEvent, nodeId: string, columnIndex: number, column: Column): void {
        event.preventDefault();
        event.stopPropagation();

        this.selectedNodeId = nodeId;
        this.selectedColumnIndex = columnIndex;
        this.selectedColumn = column;

        // Position and open the context menu
        this.columnContextMenuTrigger.menuData = { column };
        this.columnContextMenuTrigger.openMenu();

        // Set the position of the menu trigger at the mouse position
        const trigger = this.columnContextMenuTrigger._element.nativeElement;
        trigger.style.position = 'absolute';
        trigger.style.left = `${event.clientX}px`;
        trigger.style.top = `${event.clientY}px`;
    }

    /**
     * Opens the context menu for a link
     */
    openLinkMenu(event: MouseEvent, link: RelationLink): void {
        event.preventDefault();
        event.stopPropagation();

        // Select the link first
        this.onLinkSelect(link);

        // Position and open the context menu
        this.linkContextMenuTrigger.menuData = { link };
        this.linkContextMenuTrigger.openMenu();

        // Set the position of the menu trigger at the mouse position
        const trigger = this.linkContextMenuTrigger._element.nativeElement;
        trigger.style.position = 'absolute';
        trigger.style.left = `${event.clientX}px`;
        trigger.style.top = `${event.clientY}px`;
    }

    /**
     * Renames the selected column
     */
    renameColumn(): void {
        if (!this.selectedNodeId || this.selectedColumnIndex < 0 || !this.selectedColumn) return;

        const newName = prompt('Column name:', this.selectedColumn.name);
        if (newName) {
            this.updateColumn(this.selectedNodeId, this.selectedColumnIndex, { name: newName });
        }
    }

    /**
     * Changes the data type of the selected column
     */
    changeColumnType(): void {
        if (!this.selectedNodeId || this.selectedColumnIndex < 0 || !this.selectedColumn) return;

        const newType = prompt('Data type:', this.selectedColumn.dataType);
        if (newType) {
            this.updateColumn(this.selectedNodeId, this.selectedColumnIndex, { dataType: newType });
        }
    }

    /**
     * Toggles the primary key status of the selected column
     */
    togglePrimaryKey(): void {
        if (!this.selectedNodeId || this.selectedColumnIndex < 0 || !this.selectedColumn) return;

        this.updateColumn(this.selectedNodeId, this.selectedColumnIndex, {
            isPrimaryKey: !this.selectedColumn.isPrimaryKey
        });
    }

    /**
     * Toggles the foreign key status of the selected column
     */
    toggleForeignKey(): void {
        if (!this.selectedNodeId || this.selectedColumnIndex < 0 || !this.selectedColumn) return;

        this.updateColumn(this.selectedNodeId, this.selectedColumnIndex, {
            isForeignKey: !this.selectedColumn.isForeignKey
        });
    }

    /**
     * Toggles the nullable status of the selected column
     */
    toggleNullable(): void {
        if (!this.selectedNodeId || this.selectedColumnIndex < 0 || !this.selectedColumn) return;

        this.updateColumn(this.selectedNodeId, this.selectedColumnIndex, {
            isNullable: !this.selectedColumn.isNullable
        });
    }

    /**
     * Deletes the selected column
     */
    deleteColumn(): void {
        if (!this.selectedNodeId || this.selectedColumnIndex < 0) return;

        this.removeColumn(this.selectedNodeId, this.selectedColumnIndex);
    }

    /**
     * After the view is initialized
     */
    ngAfterViewInit(): void {
        // Initialize the infinite canvas
        this.initializeInfiniteCanvas();
    }

    /**
     * Initialize the infinite canvas with a centered viewport 
     */
    initializeInfiniteCanvas(): void {
        // Position the infinite canvas so it starts in the center
        const container = document.querySelector('.graph-container') as HTMLElement;
        if (container) {
            // Center the viewport in the middle of our large canvas
            container.scrollLeft = 0;
            container.scrollTop = 0;
        }
    }

    /**
     * Creates a link/relationship between two nodes
     */
    createLink(sourceId: string, targetId: string): void {
        if (sourceId === targetId) {
            this.snackBar.open('Cannot create a relationship to the same table', 'Close', { duration: 3000 });
            return;
        }

        const linkId = 'link-' + this.utilsService.generateId();
        const link: RelationLink = {
            id: linkId,
            source: sourceId,
            target: targetId,
            type: RelationType.OneToMany, // Default type
            label: '1:N'
        };

        this.diagramService.addLink(link);
        this.selectedLink = link;
        this.snackBar.open('Relationship created', 'Close', { duration: 2000 });
    }

    /**
     * Calculates the SVG path for a link
     */
    calculateLinkPath(link: RelationLink): string {
        // Always get fresh connection points to ensure they reflect current node dimensions
        const connection = this.diagramService.getConnectionPoints(link.source, link.target);

        if (!connection) {
            return ''; // No valid connection points
        }

        const { source, target } = connection;

        // Draw a curved line between nodes
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Determine appropriate curve based on source and target positions
        let curveX = 0;
        let curveY = 0;

        // Horizontal alignment - add vertical curve
        if (Math.abs(dy) < 20) {
            curveY = distance / 4;
        }
        // Vertical alignment - add horizontal curve
        else if (Math.abs(dx) < 20) {
            curveX = distance / 4;
        }
        // Diagonal relationships
        else {
            // Add a slight curve for diagonal lines too, for visual appeal
            const normalizeX = dx / distance;
            const normalizeY = dy / distance;
            // Create curve perpendicular to the line
            curveX = -normalizeY * (distance / 8);
            curveY = normalizeX * (distance / 8);
        }

        // Create a smooth bezier curve
        const controlX = midX + curveX;
        const controlY = midY + curveY;
        return `M${source.x},${source.y} Q${controlX},${controlY} ${target.x},${target.y}`;
    }

    /**
     * Calculates the position for link labels
     */
    calculateLinkLabelPosition(link: RelationLink): { x: number, y: number } {
        const connection = this.diagramService.getConnectionPoints(link.source, link.target);

        if (!connection) {
            return { x: 0, y: 0 };
        }

        const { source, target } = connection;

        // Position the label at the middle of the link with a slight offset
        return {
            x: source.x + (target.x - source.x) / 2,
            y: source.y + (target.y - source.y) / 2 - 10
        };
    }

    /**
     * Starts dragging the properties panel
     */
    startPropertiesPanelDrag(event: MouseEvent): void {
        this.isPropertiesPanelDragging = true;
        const startX = event.clientX;
        const startY = event.clientY;
        const initialX = this.propertiesPanelPosition.x;
        const initialY = this.propertiesPanelPosition.y;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            this.propertiesPanelPosition = {
                x: initialX - dx, // Right position decreases as the mouse moves right
                y: initialY + dy
            };

            this.cdr.markForCheck();
        };

        const onMouseUp = () => {
            this.isPropertiesPanelDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.cdr.markForCheck();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        event.preventDefault();
    }    /**
     * Toggles through relationship types for the selected link
     */
    toggleLinkType(): void {
        if (!this.selectedLink) return;

        // Create a cycle of relationship types
        const types = [
            RelationType.OneToOne,
            RelationType.OneToMany,
            RelationType.ManyToOne,
            RelationType.ManyToMany
        ];

        // Find the current type and get the next one
        const currentType = this.selectedLink.type ?? RelationType.OneToOne;
        const currentIndex = types.indexOf(currentType);
        const nextIndex = (currentIndex + 1) % types.length;
        const nextType = types[nextIndex];

        // Update the link with the new type
        this.updateLink(this.selectedLink.id, {
            type: nextType,
            label: this.getLabelForType(nextType)
        });

        this.snackBar.open(`Changed to ${this.getLabelForType(nextType)} relationship`, 'OK', {
            duration: 2000
        });
    }

    /**
     * Gets a display label for a relationship type
     */
    getLabelForType(type: RelationType): string {
        switch (type) {
            case RelationType.OneToOne: return '1:1';
            case RelationType.OneToMany: return '1:N';
            case RelationType.ManyToOne: return 'N:1';
            case RelationType.ManyToMany: return 'N:M';
            default: return String(type);
        }
    }

    /**
     * Shows a dialog to rename the link label
     */
    renameLinkLabel(): void {
        if (!this.selectedLink) return;

        const newLabel = prompt('Enter relationship label:', this.selectedLink.label ?? '');
        if (newLabel !== null) {
            this.updateLink(this.selectedLink.id, { label: newLabel });
        }
    }

    /**
     * Flips the direction of the selected link
     */
    flipLinkDirection(): void {
        if (!this.selectedLink) return;

        // Swap the source and target nodes
        const newSource = this.selectedLink.target;
        const newTarget = this.selectedLink.source;

        // Also swap the relationship type if it's directional
        let newType = this.selectedLink.type ?? RelationType.OneToOne;
        if (newType === RelationType.OneToMany) {
            newType = RelationType.ManyToOne;
        } else if (newType === RelationType.ManyToOne) {
            newType = RelationType.OneToMany;
        }

        this.updateLink(this.selectedLink.id, {
            source: newSource,
            target: newTarget,
            type: newType,
            label: this.getLabelForType(newType)
        });

        this.snackBar.open('Relationship direction flipped', 'OK', { duration: 2000 });
    }

    /**
     * Removes the selected link
     */
    removeSelectedLink(): void {
        if (!this.selectedLink) return;

        this.removeLink(this.selectedLink.id);
    }    /**
     * Calculates the display height of a node based on its content
     * @param node The entity node to calculate height for
     * @returns The calculated height for display
     */
    calculateNodeDisplayHeight(node: EntityNode): number {
        if (!node.columns || node.columns.length === 0) {
            return 100; // Base height for nodes without columns
        }

        // Use the same calculation method as in DiagramService.calculateNodeHeight
        // for consistency in calculations
        const headerHeight = 40;
        const footerHeight = 0;
        const columnHeight = 30;
        const numberOfColumns = node.columns.length;

        // Apply a similar calculation as in the DiagramService
        const maxColumnDisplayCount = 10;
        const effectiveColumnCount = Math.min(numberOfColumns, maxColumnDisplayCount);
        const calculatedHeight = headerHeight + (effectiveColumnCount * columnHeight) + footerHeight;

        // Use the greater of calculated height or base height (100px)
        return Math.max(calculatedHeight, 100);
    }

    /**
     * Determines the cursor style when hovering over entity nodes during link creation
     * @param node The entity node to check
     * @returns The appropriate cursor style
     */
    getLinkCreationCursor(node: EntityNode): string {
        if (!this.isCreatingLink) {
            return 'pointer'; // Default cursor
        }

        if (this.sourceNodeForLink === node.id) {
            return 'not-allowed'; // Can't link to self
        }

        return 'crosshair'; // Cursor indicates target selection
    }

    /**
     * Refreshes all links connected to a specific node
     * @param nodeId ID of the node whose links need to be refreshed
     */
    refreshLinksForNode(nodeId: string): void {
        // Find all links that connect to this node
        const connectedLinks = this.links.filter(link =>
            link.source === nodeId || link.target === nodeId
        );

        // If no links are connected to this node, return early
        if (connectedLinks.length === 0) return;

        // Force a refresh of the UI
        this.update$.next();
        this.cdr.detectChanges();
    }

    /**
     * Handle mouse wheel events for zooming
     */
    @HostListener('wheel', ['$event'])
    onMouseWheel(event: WheelEvent): void {
        // Check if Ctrl key is pressed for zooming (standard browser behavior)
        if (event.ctrlKey) {
            event.preventDefault();

            if (event.deltaY < 0) {
                // Zoom in - wheel up
                this.zoomIn();
            } else {
                // Zoom out - wheel down
                this.zoomOut();
            }
        }
    }
}
