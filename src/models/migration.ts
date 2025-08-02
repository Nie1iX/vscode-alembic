export interface Migration {
	id: string;
	shortId: string;
	message: string;
	isCurrent: boolean;
	isApplied: boolean;
	filePath?: string;
	downRevision?: string;
	branchLabels?: string[];
	depends?: string[];
	createdAt?: Date;
}

export interface MigrationHistory {
	migrations: Migration[];
	currentMigration?: string;
}

export enum MigrationStatus {
	Applied = 'applied',
	Pending = 'pending',
	Current = 'current'
}
