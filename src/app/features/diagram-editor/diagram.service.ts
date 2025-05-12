import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { Diagram, EntityNode, RelationLink } from '../../models';
import { HistoryService } from '../../core/history.service';

/**
 * Service for managing diagram data and operations
 */
@Injectable({
    providedIn: 'root'
})
export class DiagramService {
    private readonly diagramSubject = new BehaviorSubject<Diagram | null>(null);
    private readonly nodesSubject = new BehaviorSubject<EntityNode[]>([]);
    private readonly linksSubject = new BehaviorSubject<RelationLink[]>([]);

    /** Observable of the current diagram */
    readonly diagram$ = this.diagramSubject.asObservable();

    /** Observable of the current nodes */
    readonly nodes$ = this.nodesSubject.asObservable();

    /** Observable of the current links */
    readonly links$ = this.linksSubject.asObservable();

    /** API URL for diagram operations */
    private readonly apiUrl = '/api/diagrams';

    private readonly http = inject(HttpClient);
    private readonly historyService = inject(HistoryService);
    constructor() {
        // Initialize with data from localStorage if available
        this.loadFromLocalStorage();
    }

    /**
     * Loads a diagram from localStorage
     */
    private loadFromLocalStorage(): void {
        try {
            const savedDiagram = localStorage.getItem('currentDiagram');
            if (savedDiagram) {
                const diagram = JSON.parse(savedDiagram) as Diagram;
                this.setDiagram(diagram);
            }
        } catch (error) {
            console.error('Error loading diagram from localStorage', error);
        }
    }

    /**
     * Saves current diagram to localStorage
     */
    private saveToLocalStorage(): void {
        try {
            const currentDiagram = this.diagramSubject.getValue();
            if (currentDiagram) {
                // Create a clean copy of the diagram without circular references
                const cleanDiagram: Diagram = {
                    ...currentDiagram,
                    nodes: currentDiagram.nodes.map(node => ({
                        id: node.id,
                        name: node.name,
                        x: node.x,
                        y: node.y,
                        columns: node.columns,
                        metadata: node.metadata
                        // Intentionally omit 'data' and 'label' which can cause circular references
                    })),
                    links: currentDiagram.links.map(link => ({
                        id: link.id,
                        source: link.source,
                        target: link.target,
                        type: link.type,
                        label: link.label,
                        metadata: link.metadata
                        // Intentionally omit 'data' which can cause circular references
                    }))
                };

                localStorage.setItem('currentDiagram', JSON.stringify(cleanDiagram));
            }
        } catch (error) {
            console.error('Error saving diagram to localStorage', error);
        }
    }

    /**
     * Sets the current diagram and updates nodes and links
     * @param diagram The diagram to set
     * @param description Optional description of the change for history
     * @param trackInHistory Whether to track this change in history
     */
    setDiagram(diagram: Diagram, description?: string, trackInHistory = true): void {
        // Ensure diagram has defined nodes and links arrays
        const safeNodes = diagram?.nodes || [];
        const safeLinks = diagram?.links || [];

        // Prepare nodes with necessary properties
        const preparedNodes = safeNodes.map(node => ({
            ...node,
            id: node.id,
            label: node.name ?? node.label ?? 'Unnamed',
            x: node.x ?? Math.random() * 500,
            y: node.y ?? Math.random() * 500,
            dimension: node.dimension || {
                width: 200,
                height: 150
            },
            data: {
                ...node,
                columns: node.columns || []
            },
            columns: node.columns || []
        }));

        // Prepare links with necessary properties
        const preparedLinks = safeLinks.map(link => ({
            ...link,
            id: link.id || `link-${Math.random()}`,
            source: link.source,
            target: link.target,
            label: link.label ?? link.type ?? 'link',
            data: link
        }));

        const safeDiagram: Diagram = {
            ...(diagram || { name: 'New Diagram', lastModified: new Date() }),
            nodes: preparedNodes,
            links: preparedLinks
        };

        console.log('DiagramService.setDiagram: Updating with', safeDiagram);

        this.diagramSubject.next(safeDiagram);
        this.nodesSubject.next(preparedNodes);
        this.linksSubject.next(preparedLinks);

        this.saveToLocalStorage();        // Add to history if tracking is enabled
        if (trackInHistory && description) {
            this.historyService.addHistoryEntry(safeDiagram, description);
        }
    }

    /**
     * Creates a new empty diagram
     */
    createNewDiagram(name: string): void {
        console.log('DiagramService.createNewDiagram: Creating new diagram', name);
        // Clear history when creating a new diagram
        this.historyService.clearHistory();

        const newDiagram: Diagram = {
            name,
            nodes: [],
            links: [],
            lastModified: new Date()
        };

        console.log('DiagramService.createNewDiagram: Setting new diagram', newDiagram);
        this.setDiagram(newDiagram, 'Create new diagram');
    }

    /**
     * Loads a diagram from the server by ID
     */
    loadDiagram(id: string): Observable<Diagram> {
        return this.http.get<Diagram>(`${this.apiUrl}/${id}`).pipe(
            tap(diagram => this.setDiagram(diagram)),
            catchError(error => {
                console.error('Error loading diagram', error);
                return of({
                    name: 'Error Loading Diagram',
                    nodes: [],
                    links: []
                });
            })
        );
    }

    /**
     * Saves the current diagram to the server
     */
    saveDiagram(): Observable<Diagram> {
        const currentDiagram = this.diagramSubject.getValue();
        if (!currentDiagram) {
            return of({
                name: 'No Diagram',
                nodes: [],
                links: []
            });
        }

        // Update lastModified timestamp
        const diagramToSave: Diagram = {
            ...currentDiagram,
            lastModified: new Date()
        };

        // Update the current diagram with the new timestamp
        this.diagramSubject.next(diagramToSave);
        this.saveToLocalStorage();

        if (diagramToSave.id) {
            // Update existing diagram
            return this.http.put<Diagram>(`${this.apiUrl}/${diagramToSave.id}`, diagramToSave).pipe(
                catchError(error => {
                    console.error('Error saving diagram', error);
                    return of(diagramToSave);
                })
            );
        } else {
            // Create new diagram
            return this.http.post<Diagram>(this.apiUrl, diagramToSave).pipe(
                tap(savedDiagram => {
                    // Update with the ID from the server
                    this.diagramSubject.next(savedDiagram);
                    this.saveToLocalStorage();
                }),
                catchError(error => {
                    console.error('Error creating diagram', error);
                    return of(diagramToSave);
                })
            );
        }
    }

    /**
    * Adds a new node to the diagram
    */      
    addNode(node: EntityNode): void {
        console.log('DiagramService.addNode: Adding node', node);

        // Create a node object without circular references
        const safeNode: EntityNode = {
            id: node.id,
            name: node.name,
            x: node.x,
            y: node.y,
            columns: node.columns || [],
            label: node.name, // For display purposes
            dimension: node.dimension || { width: 200, height: 150 },
            metadata: node.metadata || {
                selected: false,
                expanded: true
            }
        };

        const currentNodes = this.nodesSubject.getValue();
        const newNodes = [...currentNodes, safeNode];
        this.nodesSubject.next(newNodes);

        // Update the diagram
        const currentDiagram = this.diagramSubject.getValue();
        if (!currentDiagram) {
            console.error('DiagramService.addNode: No current diagram to add node to');
            return;
        }

        const updatedDiagram: Diagram = {
            ...currentDiagram,
            nodes: newNodes,
            lastModified: new Date()
        };
        console.log('DiagramService.addNode: Updating diagram with new node', updatedDiagram);
        this.diagramSubject.next(updatedDiagram);
        this.saveToLocalStorage();

        // Add to history
        this.historyService.addHistoryEntry(updatedDiagram, `Add table "${node.name}"`);
    }    
    
    /**
     * Updates an existing node
     */
    updateNode(nodeId: string, updates: Partial<EntityNode>): void {
        console.log('DiagramService.updateNode: Updating node', nodeId, updates);

        const currentNodes = this.nodesSubject.getValue();
        const nodeIndex = currentNodes.findIndex(n => n.id === nodeId);

        if (nodeIndex !== -1) {
            const updatedNodes = [...currentNodes];
            const oldNode = updatedNodes[nodeIndex];
            updatedNodes[nodeIndex] = { ...oldNode, ...updates };            // Emit the updated nodes immediately
            this.nodesSubject.next(updatedNodes);

            // Update the diagram
            const currentDiagram = this.diagramSubject.getValue();
            if (currentDiagram) {
                const updatedDiagram: Diagram = {
                    ...currentDiagram,
                    nodes: updatedNodes,
                    lastModified: new Date()
                };
                this.diagramSubject.next(updatedDiagram);
                this.saveToLocalStorage();// Add to history with appropriate description
                let description = `Update table "${oldNode.name}"`;
                if (updates.name && updates.name !== oldNode.name) {
                    description = `Rename table "${oldNode.name}" to "${updates.name}"`;
                }

                // Skip adding position updates to history to avoid cluttering the history
                const isPositionUpdate = updates.x !== undefined || updates.y !== undefined;
                if (!isPositionUpdate) {
                    this.historyService.addHistoryEntry(updatedDiagram, description);
                }
            }
        } else {
            console.warn(`DiagramService.updateNode: Node with id ${nodeId} not found`);
        }
    }

    /**
     * Removes a node and its connected links
     */
    removeNode(nodeId: string): void {
        const currentNodes = this.nodesSubject.getValue();
        const nodeToRemove = currentNodes.find(node => node.id === nodeId);
        if (!nodeToRemove) return;

        const newNodes = currentNodes.filter(node => node.id !== nodeId);
        this.nodesSubject.next(newNodes);

        // Also remove any links connected to this node
        const currentLinks = this.linksSubject.getValue();
        const newLinks = currentLinks.filter(
            link => link.source !== nodeId && link.target !== nodeId
        );
        this.linksSubject.next(newLinks);

        // Update the diagram
        const currentDiagram = this.diagramSubject.getValue();
        if (currentDiagram) {
            const updatedDiagram: Diagram = {
                ...currentDiagram,
                nodes: newNodes,
                links: newLinks,
                lastModified: new Date()
            };
            this.diagramSubject.next(updatedDiagram);
            this.saveToLocalStorage();

            // Add to history
            this.historyService.addHistoryEntry(updatedDiagram, `Delete table "${nodeToRemove.name}"`);
        }
    }

    /**
     * Adds a new link to the diagram
     */
    addLink(link: RelationLink): void {
        console.log('DiagramService.addLink: Adding link', link);

        // Create a link object without circular references
        const safeLink: RelationLink = {
            id: link.id,
            source: link.source,
            target: link.target,
            type: link.type,
            label: link.label ?? link.type?.toString(),
            metadata: link.metadata
        };

        const currentLinks = this.linksSubject.getValue();
        const newLinks = [...currentLinks, safeLink];
        this.linksSubject.next(newLinks);

        // Update the diagram
        const currentDiagram = this.diagramSubject.getValue();
        if (!currentDiagram) {
            console.error('DiagramService.addLink: No current diagram to add link to');
            return;
        }

        const updatedDiagram: Diagram = {
            ...currentDiagram,
            links: newLinks,
            lastModified: new Date()
        };
        console.log('DiagramService.addLink: Updating diagram with new link', updatedDiagram);
        this.diagramSubject.next(updatedDiagram);
        this.saveToLocalStorage();

        // Add to history
        this.historyService.addHistoryEntry(updatedDiagram, `Add relationship between tables`);
    }
    
    /**
     * Updates an existing link
     */
    updateLink(linkId: string, updates: Partial<RelationLink>): void {
        const currentLinks = this.linksSubject.getValue();
        const linkIndex = currentLinks.findIndex(l => l.id === linkId);

        if (linkIndex !== -1) {
            const updatedLinks = [...currentLinks];
            const oldLink = updatedLinks[linkIndex];
            updatedLinks[linkIndex] = { ...oldLink, ...updates };
            this.linksSubject.next(updatedLinks);

            // Update the diagram
            const currentDiagram = this.diagramSubject.getValue();
            if (currentDiagram) {
                const updatedDiagram: Diagram = {
                    ...currentDiagram,
                    links: updatedLinks,
                    lastModified: new Date()
                };
                this.diagramSubject.next(updatedDiagram);
                this.saveToLocalStorage();

                // Add to history
                this.historyService.addHistoryEntry(updatedDiagram, `Update relationship`);
            }
        }
    }    
    
    
    /**
     * Removes a link from the diagram
     */
    removeLink(linkId: string): void {
        const currentLinks = this.linksSubject.getValue();
        const linkToRemove = currentLinks.find(link => link.id === linkId);
        if (!linkToRemove) return;

        const newLinks = currentLinks.filter(link => link.id !== linkId);
        this.linksSubject.next(newLinks);

        // Update the diagram
        const currentDiagram = this.diagramSubject.getValue();
        if (currentDiagram) {
            const updatedDiagram: Diagram = {
                ...currentDiagram,
                links: newLinks,
                lastModified: new Date()
            };
            this.diagramSubject.next(updatedDiagram);
            this.saveToLocalStorage();

            // Add to history
            this.historyService.addHistoryEntry(updatedDiagram, `Delete relationship`);
        }
    }

    /**
     * Exports the current diagram as JSON
     * @returns JSON string of the diagram
     */
    exportDiagramAsJson(): string {
        const currentDiagram = this.getCurrentDiagram();
        if (!currentDiagram) {
            return '{}';
        }

        // Create a complete diagram object with the current nodes and links
        const diagram: Diagram = {
            ...currentDiagram,
            nodes: this.nodesSubject.getValue(),
            links: this.linksSubject.getValue()
        };

        return JSON.stringify(diagram, null, 2);
    }

    /**
     * Imports a diagram from JSON
     */
    importDiagramFromJson(json: string): boolean {
        try {
            console.log('DiagramService.importDiagramFromJson: Parsing JSON', json.substring(0, 100) + '...');
            const diagram = JSON.parse(json) as Diagram;

            if (diagram?.nodes && diagram?.links) {
                console.log('DiagramService.importDiagramFromJson: Valid diagram found, setting diagram');
                this.setDiagram(diagram);
                return true;
            }

            console.error('DiagramService.importDiagramFromJson: Invalid diagram format');
            return false;
        } catch (error) {
            console.error('Error importing diagram from JSON', error);
            return false;
        }
    }

    /**
     * Gets the current diagram value
     * @returns The current diagram or null if none exists
     */
    getCurrentDiagram(): Diagram | null {
        return this.diagramSubject.getValue();
    }

    /**
     * Performs an undo operation, restoring the previous state
     * @returns True if the undo was successful
     */
    undo(): boolean {
        const previousState = this.historyService.undo();
        if (!previousState) return false;

        // Disable history tracking temporarily to avoid adding the undo as a new action
        this.historyService.disableHistory();

        // Set the previous state
        this.setDiagram(previousState.diagram, undefined, false);

        // Re-enable history tracking
        this.historyService.enableHistory();

        return true;
    }

    /**
     * Performs a redo operation, restoring the next state
     * @returns True if the redo was successful
     */
    redo(): boolean {
        const nextState = this.historyService.redo();
        if (!nextState) return false;

        // Disable history tracking temporarily
        this.historyService.disableHistory();

        // Set the next state
        this.setDiagram(nextState.diagram, undefined, false);

        // Re-enable history tracking
        this.historyService.enableHistory();

        return true;
    }

    /**
     * Checks if undo is available
     * @returns True if undo is available
     */
    canUndo(): boolean {
        return this.historyService.canUndo();
    }

    /**
     * Checks if redo is available
     * @returns True if redo is available
     */
    canRedo(): boolean {
        return this.historyService.canRedo();
    }    
    
    /**
     * Calculates the connection points for a link between two nodes
     * @param sourceId source node ID
     * @param targetId target node ID
     * @returns Connection points for the link
     */
    getConnectionPoints(sourceId: string, targetId: string): {
        source: { x: number, y: number },
        target: { x: number, y: number }
    } | null {
        const nodes = this.nodesSubject.getValue();
        const sourceNode = nodes.find(n => n.id === sourceId);
        const targetNode = nodes.find(n => n.id === targetId);

        if (!sourceNode || !targetNode) return null;

        // Get node dimensions and positions
        const sourceWidth = sourceNode.dimension?.width ?? 200;
        // Adjust height based on the number of columns if available
        const sourceHeight = this.calculateNodeHeight(sourceNode);
        const targetWidth = targetNode.dimension?.width ?? 200;
        // Adjust height based on the number of columns if available
        const targetHeight = this.calculateNodeHeight(targetNode);

        // Get center points of each node
        const sourceX = sourceNode.x! + sourceWidth / 2;
        const sourceY = sourceNode.y! + sourceHeight / 2;
        const targetX = targetNode.x! + targetWidth / 2;
        const targetY = targetNode.y! + targetHeight / 2;

        // Direction vector between centers
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;

        // Calculate intersection points with node boundaries using accurate method
        const sourcePoint = this.findIntersectionPoint(
            sourceX, sourceY, sourceWidth, sourceHeight, dx, dy
        );

        const targetPoint = this.findIntersectionPoint(
            targetX, targetY, targetWidth, targetHeight, -dx, -dy
        );

        return {
            source: sourcePoint,
            target: targetPoint
        };
    }

    /**
     * Calculates the actual height of a node based on its content
     * @param node The entity node to calculate height for
     * @returns The calculated height of the node
     */
    private calculateNodeHeight(node: EntityNode): number {
        const baseHeight = node.dimension?.height ?? 100;

        // If there are no columns, return the base height
        if (!node.columns || node.columns.length === 0) {
            return baseHeight;
        }

        // Calculate height based on columns
        // 1. Fixed header height (approximately)
        const headerHeight = 40;
        // 2. Fixed footer height (if any)
        const footerHeight = 0;
        // 3. Height per column (approximately)
        const columnHeight = 30;
        // 4. Number of visible columns
        const numberOfColumns = node.columns.length;

        // Calculate total height
        // Limit maximum height to avoid overly tall nodes
        const maxColumnDisplayCount = 10;
        const effectiveColumnCount = Math.min(numberOfColumns, maxColumnDisplayCount);
        const calculatedHeight = headerHeight + footerHeight + (effectiveColumnCount * columnHeight);

        // Use the larger of calculated or specified height to avoid undersized nodes
        return Math.max(calculatedHeight, baseHeight);
    }
    
    /**
     * Finds the intersection point of a line from the center of a node
     * with the boundary of that node using the Cohen-Sutherland algorithm approach
     */
    private findIntersectionPoint(
        centerX: number, centerY: number,
        width: number, height: number,
        dirX: number, dirY: number
    ): { x: number, y: number } {
        // Normalize direction vector
        const length = Math.sqrt(dirX * dirX + dirY * dirY);
        if (length === 0) return { x: centerX, y: centerY };

        dirX = dirX / length;
        dirY = dirY / length;

        // Calculate half dimensions
        const halfWidth = width / 2;
        const halfHeight = height / 2;

        // Calculate rectangle boundaries
        const left = centerX - halfWidth;
        const right = centerX + halfWidth;
        const top = centerY - halfHeight;
        const bottom = centerY + halfHeight;

        // Calculate the intersection with each edge and find the one on the rectangle
        const intersectTop = this.calculateTopIntersection(centerX, centerY, top, dirX, dirY, left, right);
        if (intersectTop) return intersectTop;

        const intersectBottom = this.calculateBottomIntersection(centerX, centerY, bottom, dirX, dirY, left, right);
        if (intersectBottom) return intersectBottom;

        const intersectLeft = this.calculateLeftIntersection(centerX, centerY, left, dirX, dirY, top, bottom);
        if (intersectLeft) return intersectLeft;

        const intersectRight = this.calculateRightIntersection(centerX, centerY, right, dirX, dirY, top, bottom);
        if (intersectRight) return intersectRight;

        // Fallback to the old method in case we missed anything
        let t: number;

        // Check horizontal boundaries
        if (Math.abs(dirX) > 0.0001) {
            const tx = halfWidth / Math.abs(dirX);
            t = tx;
        } else {
            t = Number.MAX_VALUE;
        }

        // Check vertical boundaries
        if (Math.abs(dirY) > 0.0001) {
            const ty = halfHeight / Math.abs(dirY);
            if (ty < t) t = ty;
        }

        return {
            x: centerX + dirX * t,
            y: centerY + dirY * t
        };
    }

    private calculateTopIntersection(
        centerX: number, centerY: number, top: number,
        dirX: number, dirY: number, left: number, right: number
    ): { x: number, y: number } | null {
        if (dirY < 0) {
            const t = (top - centerY) / dirY;
            const x = centerX + dirX * t;
            if (x >= left && x <= right) {
                return { x, y: top };
            }
        }
        return null;
    }

    private calculateBottomIntersection(
        centerX: number, centerY: number, bottom: number,
        dirX: number, dirY: number, left: number, right: number
    ): { x: number, y: number } | null {
        if (dirY > 0) {
            const t = (bottom - centerY) / dirY;
            const x = centerX + dirX * t;
            if (x >= left && x <= right) {
                return { x, y: bottom };
            }
        }
        return null;
    }

    private calculateLeftIntersection(
        centerX: number, centerY: number, left: number,
        dirX: number, dirY: number, top: number, bottom: number
    ): { x: number, y: number } | null {
        if (dirX < 0) {
            const t = (left - centerX) / dirX;
            const y = centerY + dirY * t;
            if (y >= top && y <= bottom) {
                return { x: left, y };
            }
        }
        return null;
    }

    private calculateRightIntersection(
        centerX: number, centerY: number, right: number,
        dirX: number, dirY: number, top: number, bottom: number
    ): { x: number, y: number } | null {
        if (dirX > 0) {
            const t = (right - centerX) / dirX;
            const y = centerY + dirY * t;
            if (y >= top && y <= bottom) {
                return { x: right, y };
            }
        }
        return null;
    }
}

