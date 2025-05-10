import { EntityNode } from './entity-node.model';
import { RelationLink } from './relation-link.model';

/**
 * Represents an entire database diagram
 */
export interface Diagram {
    /** Unique identifier for the diagram */
    id?: string;

    /** Name of the diagram */
    name: string;

    /** Description of the diagram */
    description?: string;

    /** Entities (tables) in the diagram */
    nodes: EntityNode[];

    /** Relationships between entities */
    links: RelationLink[];

    /** Last modified timestamp */
    lastModified?: Date;

    /** User who created this diagram */
    createdBy?: string;
}
