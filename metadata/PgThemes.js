const PgCollection = require('../common/PgCollection');

class PgThemes extends PgCollection {
	constructor(pool, schema, mongo) {
		super(pool, schema, mongo, `PgThemes`);

		this._legacy = true;
		this._collectionName = this.constructor.collectionName();
		this._groupName = this.constructor.groupName();
		this._tableName = this.constructor.tableName();
	}

	static collectionName() {
		return 'theme';
	}

	static groupName() {
		return 'themess';
	}

	static tableName() {
		return 'theme';
	}
}

module.exports = PgThemes;