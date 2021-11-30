"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExplicitLoaderImpl = void 0;
const dataloader_1 = __importDefault(require("dataloader"));
const lodash_1 = require("lodash");
const type_graphql_1 = require("type-graphql");
const typedi_1 = __importDefault(require("typedi"));
function ExplicitLoaderImpl(keyFunc, option, filterQuery) {
    return (target, propertyKey) => {
        (0, type_graphql_1.UseMiddleware)(async ({ root, context }, next) => {
            let filterQueryWithContext;
            if (filterQuery) {
                filterQueryWithContext = (query) => filterQuery(query, context);
            }
            const tgdContext = context._tgdContext;
            if (tgdContext.typeormGetConnection == null) {
                throw Error("typeormGetConnection is not set");
            }
            const relation = tgdContext
                .typeormGetConnection()
                .getMetadata(target.constructor)
                .findRelationWithPropertyPath(propertyKey.toString());
            if (relation == null) {
                return await next();
            }
            if ((option === null || option === void 0 ? void 0 : option.selfKey) &&
                !(relation.isOneToMany || relation.isOneToOneNotOwner)) {
                throw Error("selfKey option is available only for OneToMany or OneToOneNotOwner");
            }
            // prettier-ignore
            const handle = relation.isManyToOne || relation.isOneToOneOwner ?
                handleToOne :
                relation.isOneToMany ?
                    (option === null || option === void 0 ? void 0 : option.selfKey) ?
                        handleOneToManyWithSelfKey :
                        handleToMany :
                    relation.isOneToOneNotOwner ?
                        (option === null || option === void 0 ? void 0 : option.selfKey) ?
                            handleOneToOneNotOwnerWithSelfKey :
                            handleToOne :
                        relation.isManyToMany ?
                            handleToMany :
                            () => next();
            return await handle(keyFunc, root, tgdContext, relation, filterQueryWithContext);
        })(target, propertyKey);
    };
}
exports.ExplicitLoaderImpl = ExplicitLoaderImpl;
async function handler({ requestId, typeormGetConnection }, relation, columns, newDataloader, callback) {
    if (typeormGetConnection == null) {
        throw Error("Connection is not available");
    }
    if (columns.length !== 1) {
        throw Error("Loading by multiple columns as foreign key is not supported.");
    }
    const serviceId = `tgd-typeorm#${relation.entityMetadata.tableName}#${relation.propertyName}`;
    const container = typedi_1.default.of(requestId);
    if (!container.has(serviceId)) {
        container.set(serviceId, newDataloader(typeormGetConnection()));
    }
    return callback(container.get(serviceId), columns);
}
async function handleToMany(foreignKeyFunc, root, tgdContext, relation, filterQuery) {
    return handler(tgdContext, relation, relation.inverseEntityMetadata.primaryColumns, (connection) => new ToManyDataloader(relation, connection, filterQuery), async (dataloader) => {
        const fks = foreignKeyFunc(root);
        return await dataloader.loadMany(fks);
    });
}
async function handleToOne(foreignKeyFunc, root, tgdContext, relation, filterQuery) {
    return handler(tgdContext, relation, relation.inverseEntityMetadata.primaryColumns, (connection) => new ToOneDataloader(relation, connection, filterQuery), async (dataloader) => {
        const fk = foreignKeyFunc(root);
        return fk != null ? await dataloader.load(fk) : null;
    });
}
async function handleOneToManyWithSelfKey(selfKeyFunc, root, tgdContext, relation, filterQuery) {
    return handler(tgdContext, relation, relation.entityMetadata.primaryColumns, (connection) => new SelfKeyDataloader(relation, connection, selfKeyFunc, filterQuery), async (dataloader, columns) => {
        const pk = columns[0].getEntityValue(root);
        return await dataloader.load(pk);
    });
}
async function handleOneToOneNotOwnerWithSelfKey(selfKeyFunc, root, tgdContext, relation, filterQuery) {
    return handler(tgdContext, relation, relation.entityMetadata.primaryColumns, (connection) => new SelfKeyDataloader(relation, connection, selfKeyFunc, filterQuery), async (dataloader, columns) => {
        var _a;
        const pk = columns[0].getEntityValue(root);
        return (_a = (await dataloader.load(pk))[0]) !== null && _a !== void 0 ? _a : null;
    });
}
function directLoader(relation, connection, grouper, filterQuery) {
    return async (ids) => {
        const query = connection
            .createQueryBuilder(relation.type, relation.propertyName)
            .whereInIds(ids);
        if (filterQuery) {
            filterQuery(query);
        }
        const entities = (0, lodash_1.keyBy)(await query.getMany(), grouper);
        return ids.map((id) => entities[id]);
    };
}
class ToManyDataloader extends dataloader_1.default {
    constructor(relation, connection, filterQuery) {
        super(directLoader(relation, connection, (entity) => relation.inverseEntityMetadata.primaryColumns[0].getEntityValue(entity), filterQuery));
    }
}
class ToOneDataloader extends dataloader_1.default {
    constructor(relation, connection, filterQuery) {
        super(directLoader(relation, connection, relation.inverseEntityMetadata.primaryColumns[0].propertyName, filterQuery));
    }
}
class SelfKeyDataloader extends dataloader_1.default {
    constructor(relation, connection, selfKeyFunc, filterQuery) {
        super(async (ids) => {
            const columns = relation.inverseRelation.joinColumns;
            const k = `${relation.propertyName}_${columns[0].propertyName}`;
            const query = connection
                .createQueryBuilder(relation.type, relation.propertyName)
                .where(`${relation.propertyName}.${columns[0].propertyPath} IN (:...${k})`)
                .setParameter(k, ids);
            if (filterQuery) {
                filterQuery(query);
            }
            const entities = (0, lodash_1.groupBy)(await query.getMany(), selfKeyFunc);
            return ids.map((id) => { var _a; return (_a = entities[id]) !== null && _a !== void 0 ? _a : []; });
        });
    }
}
