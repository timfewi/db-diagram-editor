import { Injectable } from '@angular/core';
import { Diagram, EntityNode, Column, RelationLink, RelationType } from '../models';

/**
 * Service responsible for exporting diagrams to various formats
 */
@Injectable({
    providedIn: 'root'
})
export class ExportService {
    /**
     * Exports the diagram as SQL DDL (Data Definition Language)
     * @param diagram The diagram to export
     * @returns SQL DDL script as a string
     */
    exportAsSqlDdl(diagram: Diagram): string {
        if (!diagram || !diagram.nodes || diagram.nodes.length === 0) {
            return '-- No tables defined in the diagram';
        }

        let sqlScript = `-- SQL DDL for diagram: ${diagram.name}\n`;
        sqlScript += `-- Generated on: ${new Date().toISOString()}\n\n`;

        // Add CREATE TABLE statements
        diagram.nodes.forEach(node => {
            sqlScript += this.generateCreateTableStatement(node);
            sqlScript += '\n\n';
        });

        // Add ALTER TABLE statements for foreign keys
        if (diagram.links && diagram.links.length > 0) {
            sqlScript += '-- Foreign Key Constraints\n\n';
            diagram.links.forEach(link => {
                sqlScript += this.generateForeignKeyStatement(link, diagram.nodes);
            });
        }

        return sqlScript;
    }

    /**
     * Exports the diagram as GraphQL SDL (Schema Definition Language)
     * @param diagram The diagram to export
     * @returns GraphQL SDL as a string
     */
    exportAsGraphQLSdl(diagram: Diagram): string {
        if (!diagram || !diagram.nodes || diagram.nodes.length === 0) {
            return '# No types defined in the diagram';
        }

        let sdl = `# GraphQL SDL for diagram: ${diagram.name}\n`;
        sdl += `# Generated on: ${new Date().toISOString()}\n\n`;

        // Add type definitions
        diagram.nodes.forEach(node => {
            sdl += this.generateGraphQLTypeDefinition(node, diagram.links);
            sdl += '\n\n';
        });

        return sdl;
    }

    /**
     * Generates a SQL CREATE TABLE statement for an entity node
     * @param node The entity node representing a table
     * @returns SQL CREATE TABLE statement
     */
    private generateCreateTableStatement(node: EntityNode): string {
        let sql = `CREATE TABLE ${this.formatTableName(node.name)} (\n`;

        // Add columns
        const columnDefinitions = node.columns.map(column => {
            return `    ${this.formatColumnName(column.name)} ${this.getSqlDataType(column.dataType)}${this.getPrimaryKeyConstraint(column)}${this.getNullableConstraint(column)}`;
        });

        sql += columnDefinitions.join(',\n');

        // Add primary key constraint if not inline
        const primaryKeys = node.columns.filter(col => col.isPrimaryKey);
        if (primaryKeys.length > 1) {
            sql += ',\n    PRIMARY KEY (';
            sql += primaryKeys.map(col => this.formatColumnName(col.name)).join(', ');
            sql += ')';
        }

        sql += '\n);';

        return sql;
    }

    /**
     * Generates a SQL ALTER TABLE statement for adding a foreign key
     * @param link The relation link representing a relationship
     * @param nodes All entity nodes in the diagram
     * @returns SQL ALTER TABLE statement for foreign key
     */
    private generateForeignKeyStatement(link: RelationLink, nodes: EntityNode[]): string {
        // Find source and target nodes
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);

        if (!sourceNode || !targetNode) {
            return '';
        }

        // Find or infer the primary key of the target table
        const targetPrimaryKey = targetNode.columns.find(c => c.isPrimaryKey);
        if (!targetPrimaryKey) {
            return '';
        }

        // Find or infer the foreign key in the source table
        // For simplicity, we'll use the first column marked as a foreign key
        // or we'll create a reference based on the target table's name + primary key
        const suggestedFkName = `${targetNode.name.toLowerCase()}_${targetPrimaryKey.name}`;
        const foreignKey = sourceNode.columns.find(c =>
            c.isForeignKey ||
            c.name === suggestedFkName ||
            c.references?.table === targetNode.name
        );

        if (!foreignKey) {
            return '';
        }

        let sql = `ALTER TABLE ${this.formatTableName(sourceNode.name)}\n`;
        sql += `    ADD CONSTRAINT fk_${sourceNode.name.toLowerCase()}_${targetNode.name.toLowerCase()}\n`;
        sql += `    FOREIGN KEY (${this.formatColumnName(foreignKey.name)})\n`;
        sql += `    REFERENCES ${this.formatTableName(targetNode.name)} (${this.formatColumnName(targetPrimaryKey.name)});\n\n`;

        return sql;
    }

    /**
     * Generates a GraphQL type definition for an entity node
     * @param node The entity node representing a table
     * @param links All relation links in the diagram
     * @returns GraphQL type definition
     */
    private generateGraphQLTypeDefinition(node: EntityNode, links: RelationLink[]): string {
        let typeDef = `type ${this.formatGraphQLTypeName(node.name)} {`;

        // Add fields
        const fieldDefinitions = node.columns.map(column => {
            return `  ${this.formatGraphQLFieldName(column.name)}: ${this.getGraphQLDataType(column)}${column.isNullable ? '' : '!'}`;
        });

        typeDef += '\n' + fieldDefinitions.join('\n');

        // Add relationships
        if (links && links.length > 0) {
            const relationsFrom = links.filter(link => link.source === node.id);
            const relationsTo = links.filter(link => link.target === node.id);

            if (relationsFrom.length > 0 || relationsTo.length > 0) {
                typeDef += '\n\n  # Relationships';

                // Outgoing relationships (this entity references others)
                relationsFrom.forEach(link => {
                    const targetNode = node.id === link.source ?
                        { id: link.target } : { id: link.source };

                    if (link.type === RelationType.OneToMany || link.type === RelationType.ManyToMany) {
                        typeDef += `\n  ${this.formatGraphQLFieldName(targetNode.id)}: [${this.formatGraphQLTypeName(targetNode.id)}!]`;
                    } else {
                        typeDef += `\n  ${this.formatGraphQLFieldName(targetNode.id)}: ${this.formatGraphQLTypeName(targetNode.id)}`;
                    }
                });

                // Incoming relationships (other entities reference this one)
                relationsTo.forEach(link => {
                    const sourceNode = node.id === link.target ?
                        { id: link.source } : { id: link.target };

                    if (link.type === RelationType.OneToMany || link.type === RelationType.ManyToMany) {
                        typeDef += `\n  ${this.formatGraphQLFieldName(sourceNode.id)}s: [${this.formatGraphQLTypeName(sourceNode.id)}!]`;
                    }
                });
            }
        }

        typeDef += '\n}';
        return typeDef;
    }

    /**
     * Gets the SQL data type based on the column's data type
     * @param dataType Column data type
     * @returns SQL data type
     */
    private getSqlDataType(dataType: string): string {
        const lowerType = dataType.toLowerCase();

        // Map common data types to SQL standard types
        if (lowerType.includes('int')) return 'INTEGER';
        if (lowerType.includes('varchar') || lowerType.includes('string')) return 'VARCHAR(255)';
        if (lowerType.includes('text')) return 'TEXT';
        if (lowerType.includes('date')) return 'DATE';
        if (lowerType.includes('datetime')) return 'DATETIME';
        if (lowerType.includes('bool')) return 'BOOLEAN';
        if (lowerType.includes('float') || lowerType.includes('double')) return 'FLOAT';
        if (lowerType.includes('decimal')) return 'DECIMAL(10, 2)';

        // Default to VARCHAR if unknown
        return 'VARCHAR(255)';
    }

    /**
     * Gets the GraphQL data type based on the column
     * @param column Column object
     * @returns GraphQL data type
     */
    private getGraphQLDataType(column: Column): string {
        const lowerType = column.dataType.toLowerCase();

        // Map SQL types to GraphQL scalar types
        if (lowerType.includes('int')) return 'Int';
        if (lowerType.includes('float') || lowerType.includes('double') || lowerType.includes('decimal')) return 'Float';
        if (lowerType.includes('bool')) return 'Boolean';
        if (lowerType.includes('date') || lowerType.includes('time')) return 'DateTime';

        // Default to String for text types
        return 'String';
    }

    /**
     * Gets the PRIMARY KEY constraint for a column
     * @param column Column object
     * @returns SQL PRIMARY KEY constraint if column is a primary key
     */
    private getPrimaryKeyConstraint(column: Column): string {
        return column.isPrimaryKey && !column.isForeignKey ? ' PRIMARY KEY' : '';
    }

    /**
     * Gets the NOT NULL constraint for a column
     * @param column Column object
     * @returns SQL NOT NULL constraint if column is not nullable
     */
    private getNullableConstraint(column: Column): string {
        return column.isNullable ? '' : ' NOT NULL';
    }

    /**
     * Formats a table name for SQL (handles spaces, reserved words, etc.)
     * @param name Raw table name
     * @returns Formatted SQL table name
     */
    private formatTableName(name: string): string {
        const sanitized = name.replace(/\s+/g, '_').replace(/[^\w_]/g, '');
        return `"${sanitized}"`;
    }

    /**
     * Formats a column name for SQL (handles spaces, reserved words, etc.)
     * @param name Raw column name
     * @returns Formatted SQL column name
     */
    private formatColumnName(name: string): string {
        const sanitized = name.replace(/\s+/g, '_').replace(/[^\w_]/g, '');
        return `"${sanitized}"`;
    }

    /**
     * Formats a type name for GraphQL (PascalCase)
     * @param name Raw entity name
     * @returns Formatted GraphQL type name
     */
    private formatGraphQLTypeName(name: string): string {
        return name
            .replace(/[^\w\s]/g, '')
            .split(/[\s_]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }

    /**
     * Formats a field name for GraphQL (camelCase)
     * @param name Raw field name
     * @returns Formatted GraphQL field name
     */
    private formatGraphQLFieldName(name: string): string {
        const pascal = this.formatGraphQLTypeName(name);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }
}
