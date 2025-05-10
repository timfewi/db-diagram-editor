import { Injectable } from '@angular/core';

/**
 * Utility service for common operations
 */
@Injectable({
    providedIn: 'root'
})
export class UtilsService {

    /**
     * Generates a unique ID for nodes and links
     */
    generateUniqueId(prefix = ''): string {
        return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Alias for generateUniqueId for backwards compatibility
     */
    generateId(prefix = ''): string {
        return this.generateUniqueId(prefix);
    }

    /**
     * Calculates a position near the center of the view
     * @param offset Optional offset for positioning multiple elements
     */
    calculateCenterPosition(offset = { x: 0, y: 0 }): { x: number, y: number } {
        // This is a simple implementation
        // In a real app, we would calculate based on the viewport or canvas
        return {
            x: 300 + offset.x,
            y: 300 + offset.y
        };
    }

    /**
     * Clones an object with a deep copy
     */
    deepClone<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Downloads content as a file
     */
    downloadAsFile(content: string, filename: string, contentType = 'application/json'): void {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
    }
}
