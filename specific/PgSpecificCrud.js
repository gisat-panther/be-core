const config = require(`../config`);

const PgCrud = require(`../common/PgCrud`);

const PgEsponFuoreIndicators = require(`./PgEsponFuoreIndicators`);

const PgAttributes = require(`../metadata/PgAttributes`);

const PgViews = require(`../view/PgViews`);
const PgTags = require(`../metadata/PgTags`);

class PgSpecificCrud extends PgCrud {
	constructor(pgPool, pgSchema) {
		super();

		this._pgEsponFuoreIndicators = new PgEsponFuoreIndicators(pgPool, pgSchema);

		this._pgAttributes = new PgAttributes(pgPool, config.pgSchema.metadata);
		this._pgTags = new PgTags(pgPool, config.pgSchema.metadata);

		this._pgViews = new PgViews(pgPool, config.pgSchema.views);

		this._pgEsponFuoreIndicators.setRelatedStores([this._pgAttributes, this._pgViews, this._pgTags]);

		this._pgTypes = {
			[PgEsponFuoreIndicators.groupName()]: {
				store: this._pgEsponFuoreIndicators,
				type: PgEsponFuoreIndicators.tableName()
			}
		};
	}
}

module.exports = PgSpecificCrud;