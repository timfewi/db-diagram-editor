/**
 * Represents a relationship between two database tables in the diagram
 */
export interface RelationLink {
    /** Unique identifier for the link */
    id: string;

    /** ID of the source node (table) */
    source: string;

    /** ID of the target node (table) */
    target: string;

    /** Type of relationship (e.g., "1:N", "N:M") */
    type?: RelationType;    /** Label to display on the relationship */
    label?: string;

    /** Reference to original data (for ngx-graph) */
    data?: any;

    /** Additional rendering properties for ngx-graph */
    points?: Array<{ x: number, y: number }>;

    /** Additional metadata for rendering */
    metadata?: {
        /** Custom styling information */
        style?: any;
        /** Whether the link is currently selected */
        selected?: boolean;
    };
}

/**
 * Types of relationships between database entities
 */
export enum RelationType {
    /** One-to-One relationship */
    OneToOne = '1:1',

    /** One-to-Many relationship */
    OneToMany = '1:N',

    /** Many-to-One relationship */
    ManyToOne = 'N:1',

    /** Many-to-Many relationship */
    ManyToMany = 'N:M'
}
