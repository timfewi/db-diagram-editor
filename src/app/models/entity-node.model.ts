/**
 * Represents a database table entity in the diagram
 */
export interface EntityNode {
    /** Unique identifier for the node */
    id: string;

    /** Display name of the table */
    name: string;

    /** X position in the diagram */
    x?: number;

    /** Y position in the diagram */
    y?: number;

    /** Columns in the database table */
    columns: Column[];    /** Label for ngx-graph rendering (typically same as name) */
    label?: string;

    /** Reference to original data (for ngx-graph) */
    data?: any;

    /** Dimensions for ngx-graph rendering */
    dimension?: {
        width: number;
        height: number;
    };

    /** Additional metadata for rendering */
    metadata?: {
        /** Custom styling information */
        style?: any;
        /** Whether the node is currently selected */
        selected?: boolean;
        /** Whether the node is expanded (showing columns) */
        expanded?: boolean;
    };
}

/**
 * Represents a column in a database table
 */
export interface Column {
    /** Column name */
    name: string;

    /** Data type of the column */
    dataType: string;

    /** Whether this column is a primary key */
    isPrimaryKey?: boolean;

    /** Whether this column is a foreign key */
    isForeignKey?: boolean;

    /** Whether this column can be null */
    isNullable?: boolean;

    /** Foreign key reference (if applicable) */
    references?: {
        /** Table that is referenced */
        table: string;
        /** Column that is referenced */
        column: string;
    };
}
