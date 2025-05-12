import { ChangeDetectionStrategy, Component, OnInit, AfterViewInit, ViewChild, inject, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxGraphModule } from '@swimlane/ngx-graph';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Subject, combineLatest, asyncScheduler } from 'rxjs';
import { observeOn, tap } from 'rxjs/operators';

import { DiagramService } from './diagram.service';
import { UtilsService } from '../../core/utils.service';
import { ExportService } from '../../core/export.service';
import { Diagram, EntityNode, RelationLink, RelationType, Column } from '../../models';

@Component({
    selector: 'app-diagram-editor',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        NgxGraphModule,
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
export class DiagramEditorComponent implements OnInit, AfterViewInit {    // Services
    private readonly diagramService = inject(DiagramService);
    private readonly utilsService = inject(UtilsService);
    private readonly exportService = inject(ExportService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly cdr = inject(ChangeDetectorRef);

    // ViewChild references
    @ViewChild('fileInput') fileInput: any;
    @ViewChild('columnContextMenuTrigger') columnContextMenuTrigger: any;

    // Graph data
    nodes: any[] = []; // Use any[] to accommodate ngx-graph's node format
    links: any[] = []; // Use any[] to accommodate ngx-graph's link format

    // Selected element tracking
    selectedNode: EntityNode | null = null;
    selectedLink: RelationLink | null = null;
    selectedColumn: Column | null = null;
    selectedNodeId: string | null = null;
    selectedColumnIndex: number = -1;

    // Diagram settings
    // Define a proper color scheme for ngx-graph with a name property
    readonly colorScheme = {
        domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA', '#3F51B5', '#FF4081', '#FFC107'], // Example Material-like colors
        name: 'entity-colors' // Important: name property is required by ngx-graph
    };

    // Dimensions for nodes (needed for ngx-graph proper rendering)
    readonly defaultNodeDimensions = { width: 230, height: 150 };
    // Graph layout settings
    layoutSettings = {
        orientation: 'TB', // 'TB', 'LR', 'RL', 'BT'
        alignItems: true,
        animate: true
    };

    // Update when the graph should refresh
    update$ = new Subject<void>();

    // Track the current operation
    isCreatingLink = false;
    sourceNodeForLink: string | null = null;

    // Track drag & drop operation
    isDragging = false;

    // Edit mode flags
    isEditingNode = false;

    // Grid snap feature
    gridSnapEnabled = false;
    gridSize = 20; // Size of grid cells in pixels

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

    constructor() { } 
    
    ngOnInit(): void {
        console.log('DiagramEditorComponent ngOnInit: Initializing component');

        // First ensure an initial empty diagram exists
        if (!this.diagramService.getCurrentDiagram()) {
            console.log('No diagram exists, creating default diagram');
            this.diagramService.createNewDiagram('New Diagram');
        }

        // Listen to diagram changes - this will allow us to update title or other diagram properties
        this.diagramService.diagram$.subscribe(diagram => {
            console.log('Diagram updated:', diagram);
            // Force change detection to update the UI
            this.cdr.detectChanges();
        });

        // Subscribe to nodes and links separately for better control
        this.diagramService.nodes$.subscribe(nodes => {
            console.log('Nodes updated:', nodes?.length || 0);

            // Create properly formatted nodes for ngx-graph
            this.nodes = (nodes || []).map(node => {
                const headerHeight = 40; // Approximate height of .entity-header
                const columnHeight = 30; // Approximate height of .entity-column content
                const columnsContainerPadding = 16; // Padding for .entity-columns
                const numColumns = node.columns?.length || 0;

                const calculatedMinHeight = headerHeight + (numColumns * columnHeight) + columnsContainerPadding;
                const nodeDisplayHeight = Math.max(this.defaultNodeDimensions.height, calculatedMinHeight);

                const formattedNode = {
                    ...node,
                    id: node.id,
                    label: node.name || 'Unnamed Node',
                    // Add dimensions required by ngx-graph
                    dimension: {
                        width: this.defaultNodeDimensions.width,
                        height: nodeDisplayHeight
                    },
                    // Ensure position is defined
                    x: node.x ?? 100,
                    y: node.y ?? 100,
                    // Ensure necessary properties for ngx-graph v10
                    position: {
                        x: node.x ?? 100,
                        y: node.y ?? 100
                    }
                };
                console.log('Formatted node:', formattedNode);
                return formattedNode;
            });

            if (this.nodes.length > 0) {
                console.log('Formatted nodes for rendering:', this.nodes);
            }

            // Trigger update for ngx-graph and change detection
            this.update$.next();
            this.cdr.detectChanges();
        });

        this.diagramService.links$.subscribe(links => {
            console.log('Links updated:', links?.length || 0);

            // Create properly formatted links for ngx-graph
            this.links = (links || []).map(link => ({
                ...link,
                id: link.id,
                source: link.source,
                target: link.target,
                label: link.label ?? link.type?.toString() ?? ''
            }));

            if (this.links.length > 0) {
                console.log('Formatted links for rendering:', this.links);
            }

            // Trigger update for ngx-graph and change detection
            this.update$.next();
            this.cdr.detectChanges();
        });

        // Initial update to trigger rendering
        setTimeout(() => {
            this.update$.next();
            this.cdr.detectChanges();
        }, 0);
    }    /**
     * Creates a new empty table node
     */
    createNewNode(): void {
        console.log('Creating new table node');

        // Check if there's a current diagram
        const currentDiagram = this.diagramService.getCurrentDiagram();
        if (!currentDiagram) {
            console.log('No current diagram exists. Creating a new diagram first.');
            this.createNewDiagram();
            // Adding a small delay to ensure the diagram is created before adding the node
            setTimeout(() => {
                this.createNewNodeInternal();
            }, 500);
            return;
        }

        this.createNewNodeInternal();
    }    /**
     * Internal method to create a new node
     */    private createNewNodeInternal(): void {
        const randomColor = this.colorScheme.domain[Math.floor(Math.random() * this.colorScheme.domain.length)];

        // Get center position or add some randomness for multiple nodes
        const position = this.utilsService.calculateCenterPosition({
            x: Math.random() * 100 - 50,
            y: Math.random() * 100 - 50
        });

        // Create a node compatible with ngx-graph
        const newNode: any = {
            id: this.utilsService.generateUniqueId('node-'),
            name: 'New Table',
            label: 'New Table',
            x: position.x,
            y: position.y,
            // NGX-Graph v10 specific properties
            position: {
                x: position.x,
                y: position.y
            },
            // transform: `translate(${position.x}, ${position.y})`,
            columns: [
                {
                    name: 'id',
                    dataType: 'int',
                    isPrimaryKey: true,
                    isNullable: false
                }
            ],
            metadata: {
                expanded: true,
                style: {
                    backgroundColor: randomColor
                }
            },
            dimension: {
                width: this.defaultNodeDimensions.width,
                height: this.defaultNodeDimensions.height
            }
        };

        console.log('Adding new node with properties:', newNode);
        this.diagramService.addNode(newNode);
        this.update$.next(); // Force graph update
        this.cdr.detectChanges(); // Force UI update
        this.showNotification('Table created');
    }

    /**
     * Selects a node for editing or linking
     */
    onNodeSelect(node: EntityNode): void {
        // If creating a link, complete the link creation
        if (this.isCreatingLink && this.sourceNodeForLink) {
            this.createLink(this.sourceNodeForLink, node.id);
            this.isCreatingLink = false;
            this.sourceNodeForLink = null;
            return;
        }

        // Otherwise, select the node
        this.selectedNode = node;
        this.selectedLink = null;
    }

    /**
     * Starts the relationship creation mode
     * @param sourceNodeId ID of the source node
     */
    startLinkCreation(sourceNodeId: string): void {
        this.isCreatingLink = true;
        this.sourceNodeForLink = sourceNodeId;

        // Show helper message to user
        this.snackBar.open('Select a target table to create relationship', 'Cancel', {
            duration: 0, // Don't auto-dismiss
            panelClass: 'info-snackbar'
        }).onAction().subscribe(() => {
            // Cancel the link creation
            this.isCreatingLink = false;
            this.sourceNodeForLink = null;
        });
    }

    /**
     * Completes the relationship creation by connecting to a target node
     * @param targetNodeId ID of the target node
     */
    completeRelationship(targetNodeId: string): void {
        if (!this.isCreatingLink || !this.sourceNodeForLink) {
            return;
        }

        // Find source and target nodes
        const sourceNode = this.nodes.find(n => n.id === this.sourceNodeForLink);
        const targetNode = this.nodes.find(n => n.id === targetNodeId);

        if (!sourceNode || !targetNode) {
            this.snackBar.open('Invalid source or target node', 'OK', { duration: 3000 });
            return;
        }

        // If linking to the same node, ask for confirmation
        if (sourceNode.id === targetNode.id) {
            const confirmSelfRelation = confirm('Are you sure you want to create a self-relationship?');
            if (!confirmSelfRelation) {
                return;
            }
        }

        // Open a dialog to choose relationship type
        const relationTypes = Object.values(RelationType);
        const typeOptions = relationTypes.map(type => `${type}`).join(', ');
        const relationType = prompt(`Choose relationship type (${typeOptions}):`, RelationType.OneToMany) as RelationType;

        if (!relationType) {
            // Cancelled by user
            return;
        }

        // Create a new relationship
        const relationId = this.utilsService.generateId();
        const newRelation: RelationLink = {
            id: relationId,
            source: sourceNode.id,
            target: targetNode.id,
            type: relationType,
            label: relationType,
            // Add points for path rendering
            points: [
                { x: sourceNode.x ?? 0, y: sourceNode.y ?? 0 },
                { x: targetNode.x ?? 0, y: targetNode.y ?? 0 }
            ]
        };

        // Add the new relationship to the diagram
        this.diagramService.addLink(newRelation);

        // Exit link creation mode
        this.isCreatingLink = false;
        this.sourceNodeForLink = null;

        // Close the snackbar
        this.snackBar.dismiss();

        // Show success message
        this.snackBar.open(`Created ${relationType} relationship`, 'OK', { duration: 3000 });
    }

    /**
     * Selects a link for editing
     */
    onLinkSelect(link: RelationLink): void {
        this.selectedLink = link;
        this.selectedNode = null;
    }

    /**
     * Updates a node's properties
     */
    updateNode(nodeId: string, updates: Partial<EntityNode>): void {
        this.diagramService.updateNode(nodeId, updates);
        this.update$.next();
        this.cdr.detectChanges(); // Force UI update
        this.showNotification('Table updated');
    }

    /**
     * Updates a link's properties
     */
    updateLink(linkId: string, updates: Partial<RelationLink>): void {
        this.diagramService.updateLink(linkId, updates);
        this.update$.next();
        this.cdr.detectChanges(); // Force UI update
        this.showNotification('Relationship updated');
    }

    /**
     * Removes a node from the diagram
     */
    removeNode(nodeId: string): void {
        this.diagramService.removeNode(nodeId);
        this.selectedNode = null;
        this.update$.next();
        this.cdr.detectChanges(); // Force UI update
        this.showNotification('Table deleted');
    }

    /**
     * Removes a link from the diagram
     */
    removeLink(linkId: string): void {
        this.diagramService.removeLink(linkId);
        this.selectedLink = null;
        this.update$.next();
        this.cdr.detectChanges(); // Force UI update
        this.showNotification('Relationship deleted');
    }

    /**
     * Adds a column to a table
     */
    addColumn(nodeId: string): void {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            const newColumn: Column = {
                name: 'new_column',
                dataType: 'varchar',
                isNullable: true
            };

            const updatedColumns = [...node.columns, newColumn];
            this.updateNode(nodeId, { columns: updatedColumns });
            // updateNode already handles notification, update$, and detectChanges
        }
    }

    /**
     * Updates a column in a table
     */
    updateColumn(nodeId: string, columnIndex: number, updates: Partial<Column>): void {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node?.columns?.[columnIndex]) {
            const updatedColumns = [...node.columns];
            updatedColumns[columnIndex] = { ...updatedColumns[columnIndex], ...updates };
            this.updateNode(nodeId, { columns: updatedColumns });
            // updateNode already handles notification, update$, and detectChanges
        }
    }

    /**
     * Removes a column from a table
     */
    removeColumn(nodeId: string, columnIndex: number): void {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.columns.length > 1) { // Keep at least one column
            const updatedColumns = [...node.columns];
            updatedColumns.splice(columnIndex, 1);
            this.updateNode(nodeId, { columns: updatedColumns });
            // updateNode already handles notification, update$, and detectChanges
        } else {
            this.showNotification('Cannot remove the last column', true);
        }
    }

    /**
     * Saves the current diagram
     */
    saveDiagram(): void {
        this.diagramService.saveDiagram().subscribe(
            savedDiagram => {
                this.showNotification('Diagram saved successfully');
            }
        );
    }    /**
     * Exports the diagram as JSON
     */
    exportDiagram(): void {
        const jsonContent = this.diagramService.exportDiagramAsJson();
        const diagram = this.diagramService.getCurrentDiagram();
        const filename = `${diagram?.name ?? 'diagram'}.json`;

        this.utilsService.downloadAsFile(jsonContent, filename);
        this.showNotification('Diagram exported successfully');
    }    /**
     * Exports the diagram as SQL DDL
     */
    exportAsSqlDdl(): void {
        const diagram = this.diagramService.getCurrentDiagram();
        if (!diagram) {
            this.showNotification('No diagram to export', true);
            return;
        }

        const sqlContent = this.exportService.exportAsSqlDdl(diagram);
        const filename = `${diagram.name ?? 'diagram'}.sql`;

        this.utilsService.downloadAsFile(sqlContent, filename, 'text/plain');
        this.showNotification('SQL DDL exported successfully');
    }

    /**
     * Exports the diagram as GraphQL SDL
     */
    exportAsGraphQLSdl(): void {
        const diagram = this.diagramService.getCurrentDiagram();
        if (!diagram) {
            this.showNotification('No diagram to export', true);
            return;
        }

        const graphqlContent = this.exportService.exportAsGraphQLSdl(diagram);
        const filename = `${diagram.name ?? 'diagram'}.graphql`;

        this.utilsService.downloadAsFile(graphqlContent, filename, 'text/plain');
        this.showNotification('GraphQL SDL exported successfully');
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
        if (!input.files?.length) return;

        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = (e: any) => {
            const content = e.target.result;
            const success = this.diagramService.importDiagramFromJson(content);

            if (success) {
                this.showNotification('Diagram imported successfully');
            } else {
                this.showNotification('Failed to import diagram. Invalid format.', true);
            }

            // Reset the file input
            input.value = '';
        };

        reader.readAsText(file);
    }    /**
     * Handles node position changes from drag events
     */
    onNodePositionChange(node: EntityNode): void {
        if (node.x !== undefined && node.y !== undefined) {
            let x = node.x;
            let y = node.y;

            // Apply grid snapping if enabled
            if (this.gridSnapEnabled) {
                x = this.snapToGrid(x);
                y = this.snapToGrid(y);
            }

            this.diagramService.updateNode(node.id, {
                x,
                y
            });
        }
    }    /**
     * Creates a new empty diagram
     */
    createNewDiagram(): void {
        const name = this.prompt('Enter diagram name:', 'New Diagram');
        if (name) {
            console.log('Creating new diagram:', name);
            this.diagramService.createNewDiagram(name);
            this.update$.next(); // Force graph update
            this.cdr.detectChanges(); // Force UI update
            this.showNotification('New diagram created');
        }
    }

    /**
     * Undoes the last action
     */
    undo(): void {
        if (this.diagramService.undo()) {
            this.update$.next();
            this.cdr.detectChanges(); // Force UI update
            this.showNotification('Undo successful');
        }
    }

    /**
     * Redoes the last undone action
     */
    redo(): void {
        if (this.diagramService.redo()) {
            this.update$.next();
            this.cdr.detectChanges(); // Force UI update
            this.showNotification('Redo successful');
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
    }    /**
     * Handles keyboard shortcuts
     * @param event Keyboard event
     */
    @HostListener('window:keydown', ['$event'])
    handleKeyboardShortcuts(event: KeyboardEvent): void {
        // Check if Ctrl key is pressed (or Command key on Mac)
        const ctrlPressed = event.ctrlKey || event.metaKey;

        if (ctrlPressed) {
            switch (event.key.toLowerCase()) {
                case 'z':
                    // Ctrl+Z for Undo (Windows/Linux)
                    // Cmd+Z for Undo (Mac)
                    // Cmd+Shift+Z for Redo (Mac)
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
                // Add more keyboard shortcuts here as needed
            }
        }
    }

    /**
     * Snaps a coordinate to the nearest grid point
     * @param coord The coordinate to snap
     * @returns The snapped coordinate
     */
    private snapToGrid(coord: number): number {
        return Math.round(coord / this.gridSize) * this.gridSize;
    }

    /**
     * Toggles the grid snap feature
     */
    toggleGridSnap(): void {
        this.gridSnapEnabled = !this.gridSnapEnabled;
        this.showNotification(
            this.gridSnapEnabled
                ? 'Grid snap enabled'
                : 'Grid snap disabled'
        );
    }

    /**
     * Zooms in the diagram
     */
    zoomIn(): void {
        if (this.currentZoom < this.maxZoom) {
            this.currentZoom = Math.min(this.currentZoom + this.zoomStep, this.maxZoom);
            this.applyZoom();
        }
    }

    /**
     * Zooms out the diagram
     */
    zoomOut(): void {
        if (this.currentZoom > this.minZoom) {
            this.currentZoom = Math.max(this.currentZoom - this.zoomStep, this.minZoom);
            this.applyZoom();
        }
    }

    /**
     * Resets zoom to the default level
     */
    resetZoom(): void {
        this.currentZoom = 1;
        this.applyZoom();
    }

    /**
     * Applies the current zoom level to the graph container
     */
    private applyZoom(): void {
        const container = document.querySelector('.graph-container') as HTMLElement;
        if (container) {
            container.style.transform = `scale(${this.currentZoom})`;
            container.style.transformOrigin = 'center center';

            // Update the UI to show current zoom level
            this.showNotification(`Zoom: ${Math.round(this.currentZoom * 100)}%`);

            // Force graph update
            this.update$.next();
            this.cdr.detectChanges();
        }
    }

    /**
     * Displays a notification/toast message
     */
    private showNotification(message: string, isError = false): void {
        this.snackBar.open(message, 'Close', {
            duration: 3000,
            panelClass: isError ? ['error-notification'] : ['success-notification']
        });
    }    /**
     * Displays a prompt dialog and returns the user input
     * @param message The message to display
     * @param defaultValue Default value to show in the prompt
     * @returns The user input or the default value if canceled
     */
    prompt(message: string, defaultValue: string = ''): string {
        return window.prompt(message, defaultValue) ?? defaultValue;
    }

    /**
     * Starts dragging a node
     * @param event Mouse event
     * @param node The node to drag
     */
    startDragging(event: MouseEvent, node: EntityNode): void {
        if (this.isCreatingLink) {
            // If we're creating a link, don't start dragging
            return;
        }

        // Mark that we're dragging and store initial positions
        this.isDragging = true;
        const initialX = event.clientX;
        const initialY = event.clientY;
        const nodeInitialX = node.x || 0;
        const nodeInitialY = node.y || 0;

        // Select the node first
        this.onNodeSelect(node);

        // Create the mouse move handler
        const mouseMoveHandler = (moveEvent: MouseEvent) => {
            if (this.isDragging) {
                const dx = moveEvent.clientX - initialX;
                const dy = moveEvent.clientY - initialY;

                // Calculate new position
                let newX = nodeInitialX + dx;
                let newY = nodeInitialY + dy;

                // Apply grid snapping if enabled
                if (this.gridSnapEnabled) {
                    newX = this.snapToGrid(newX);
                    newY = this.snapToGrid(newY);
                }

                // Update the node position in UI only during drag
                const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`) as HTMLElement;
                if (nodeElement) {
                    nodeElement.style.left = `${newX}px`;
                    nodeElement.style.top = `${newY}px`;
                }
            }
        };

        // Create the mouse up handler
        const mouseUpHandler = () => {
            if (this.isDragging) {
                this.isDragging = false;

                // Remove the event listeners
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);

                // Calculate final position
                const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`) as HTMLElement;
                if (nodeElement) {
                    // Get the actual position after dragging
                    const rect = nodeElement.getBoundingClientRect();
                    const containerRect = document.querySelector('.graph-container')?.getBoundingClientRect();

                    if (containerRect) {
                        const finalX = rect.left - containerRect.left + window.scrollX;
                        const finalY = rect.top - containerRect.top + window.scrollY;

                        // Save the new position
                        this.updateNode(node.id, {
                            x: finalX,
                            y: finalY
                        });
                    }
                }
            }
        };

        // Add the event listeners
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);

        // Prevent default behavior
        event.preventDefault();
    }

    /**
     * Opens the context menu for a column
     * @param event Mouse event
     * @param nodeId ID of the node containing the column
     * @param columnIndex Index of the column
     * @param column Column data
     */
    openColumnMenu(event: MouseEvent, nodeId: string, columnIndex: number, column: Column): void {
        event.preventDefault();

        // Store the selected column information
        this.selectedColumn = column;
        this.selectedNodeId = nodeId;
        this.selectedColumnIndex = columnIndex;

        // Open the context menu at the cursor position
        this.columnContextMenuTrigger.openMenu();
        this.columnContextMenuTrigger.menuData = {
            nodeId,
            columnIndex,
            column
        };

        // Position the context menu
        const matMenuPanel = document.querySelector('.mat-mdc-menu-panel');
        if (matMenuPanel) {
            // Position adjustment happens after menu opens
            setTimeout(() => {
                const menu = document.querySelector('.mat-mdc-menu-panel') as HTMLElement;
                if (menu) {
                    menu.style.position = 'absolute';
                    menu.style.left = `${event.pageX}px`;
                    menu.style.top = `${event.pageY}px`;
                }
            }, 0);
        }
    }

    /**
     * Renames the selected column
     */
    renameColumn(): void {
        if (this.selectedNodeId !== null && this.selectedColumnIndex >= 0 && this.selectedColumn) {
            const newName = prompt('Column name:', this.selectedColumn.name);
            if (newName !== null) {
                this.updateColumn(this.selectedNodeId, this.selectedColumnIndex, { name: newName });
            }
        }
    }

    /**
     * Changes the data type of the selected column
     */
    changeColumnType(): void {
        if (this.selectedNodeId !== null && this.selectedColumnIndex >= 0 && this.selectedColumn) {
            const newType = prompt('Data type:', this.selectedColumn.dataType);
            if (newType !== null) {
                this.updateColumn(this.selectedNodeId, this.selectedColumnIndex, { dataType: newType });
            }
        }
    }

    /**
     * Toggles the primary key status of the selected column
     */
    togglePrimaryKey(): void {
        if (this.selectedNodeId !== null && this.selectedColumnIndex >= 0 && this.selectedColumn) {
            this.updateColumn(this.selectedNodeId, this.selectedColumnIndex, {
                isPrimaryKey: !this.selectedColumn.isPrimaryKey
            });
        }
    }

    /**
     * Toggles the foreign key status of the selected column
     */
    toggleForeignKey(): void {
        if (this.selectedNodeId !== null && this.selectedColumnIndex >= 0 && this.selectedColumn) {
            this.updateColumn(this.selectedNodeId, this.selectedColumnIndex, {
                isForeignKey: !this.selectedColumn.isForeignKey
            });

            // If setting as foreign key, prompt for reference
            if (!this.selectedColumn.isForeignKey) {
                // Get list of available tables (excluding this one)
                const availableTables = this.nodes
                    .filter(node => node.id !== this.selectedNodeId)
                    .map(node => ({ id: node.id, name: node.name || node.label }));

                if (availableTables.length === 0) {
                    this.snackBar.open('No other tables available to reference', 'OK', { duration: 3000 });
                    return;
                }

                // Simple implementation - would be better with a proper dialog
                const targetTable = prompt(
                    `Referenced table (${availableTables.map(t => t.name).join(', ')}):`,
                    availableTables[0]?.name
                );

                if (targetTable) {
                    const targetNode = availableTables.find(t => t.name === targetTable);
                    if (targetNode) {
                        // For now just set reference to the first column of target table
                        const targetTableNode = this.nodes.find(n => n.id === targetNode.id);
                        const targetColumn = targetTableNode?.columns?.[0]?.name || 'id';

                        this.updateColumn(this.selectedNodeId, this.selectedColumnIndex, {
                            references: {
                                table: targetNode.id,
                                column: targetColumn
                            }
                        });
                    }
                }
            }
        }
    }

    /**
     * Toggles the nullable status of the selected column
     */
    toggleNullable(): void {
        if (this.selectedNodeId !== null && this.selectedColumnIndex >= 0 && this.selectedColumn) {
            this.updateColumn(this.selectedNodeId, this.selectedColumnIndex, {
                isNullable: !this.selectedColumn.isNullable
            });
        }
    }

    /**
     * Deletes the selected column
     */
    deleteColumn(): void {
        if (this.selectedNodeId !== null && this.selectedColumnIndex >= 0) {
            this.removeColumn(this.selectedNodeId, this.selectedColumnIndex);
        }
    }

    /**
     * After the view is initialized
     */
    ngAfterViewInit(): void {
        // Set up the column context menu position
        if (this.columnContextMenuTrigger) {
            this.columnContextMenuTrigger._handleClick = (event: MouseEvent) => {
                if (this.columnContextMenuTrigger.menuOpen) {
                    this.columnContextMenuTrigger.closeMenu();
                } else {
                    this.columnContextMenuTrigger.openMenu();

                    // Position menu at click point
                    setTimeout(() => {
                        const menu = document.querySelector('.mat-mdc-menu-panel') as HTMLElement;
                        if (menu) {
                            menu.style.position = 'fixed';
                            menu.style.left = `${event.clientX}px`;
                            menu.style.top = `${event.clientY}px`;
                        }
                    });
                }
            };
        }

        // Trigger initial update
        this.update$.next();
        this.cdr.detectChanges();
    }

    /**
     * Creates a link/relationship between two nodes
     * @param sourceId Source node ID
     * @param targetId Target node ID
     */
    createLink(sourceId: string, targetId: string): void {
        if (sourceId === targetId) {
            this.snackBar.open('Cannot connect a node to itself', 'OK', { duration: 3000 });
            return;
        }

        // Open a dialog to choose relationship type
        const relationTypes = Object.values(RelationType);
        const typeOptions = relationTypes.map(type => `${type}`).join(', ');
        const relationType = prompt(`Choose relationship type (${typeOptions}):`, RelationType.OneToMany) as RelationType;

        if (!relationType) {
            // Cancelled by user
            return;
        }

        // Find source and target nodes
        const sourceNode = this.nodes.find(n => n.id === sourceId);
        const targetNode = this.nodes.find(n => n.id === targetId);

        if (!sourceNode || !targetNode) {
            this.snackBar.open('Invalid source or target node', 'OK', { duration: 3000 });
            return;
        }

        // Create a new relationship
        const newRelation: RelationLink = {
            id: `link-${this.utilsService.generateUniqueId()}`,
            source: sourceId,
            target: targetId,
            type: relationType,
            label: relationType,
            // Add points for path rendering
            points: [
                { x: sourceNode.x || 0, y: sourceNode.y || 0 },
                { x: targetNode.x || 0, y: targetNode.y || 0 }
            ]
        };

        // Add the relationship to the diagram
        this.diagramService.addLink(newRelation);
        this.update$.next();
        this.cdr.detectChanges();
        this.showNotification(`Created ${relationType} relationship`);
    }

    /**
     * Start dragging the properties panel
     * @param event Mouse event from the panel header
     */
    startPropertiesPanelDrag(event: MouseEvent): void {
        // Only handle left mouse button
        if (event.button !== 0) return;

        this.isPropertiesPanelDragging = true;
        const panel = event.currentTarget as HTMLElement;
        const panelRect = panel.getBoundingClientRect();

        // Calculate the offset of the mouse position from the panel's top-left corner
        const offsetX = event.clientX - panelRect.left;
        const offsetY = event.clientY - panelRect.top;

        const mouseMoveHandler = (moveEvent: MouseEvent) => {
            if (this.isPropertiesPanelDragging) {
                // Calculate new position
                const x = moveEvent.clientX - offsetX;
                const y = moveEvent.clientY - offsetY;

                // Update panel position
                const panelElement = panel.closest('.properties-panel') as HTMLElement;
                if (panelElement) {
                    panelElement.style.left = `${x}px`;
                    panelElement.style.top = `${y}px`;
                    // Store position for persistence
                    this.propertiesPanelPosition = { x, y };
                }
            }
        };

        const mouseUpHandler = () => {
            this.isPropertiesPanelDragging = false;
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);

        // Prevent text selection while dragging
        event.preventDefault();
    }
}
