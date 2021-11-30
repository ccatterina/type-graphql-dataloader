"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImplicitLoaderImpl = void 0;
const dataloader_1 = __importDefault(require("dataloader"));
const type_graphql_1 = require("type-graphql");
const typedi_1 = __importDefault(require("typedi"));
function ImplicitLoaderImpl(filterQuery) {
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
            if (relation.inverseRelation == null) {
                throw Error(`inverseRelation is required: ${String(propertyKey)}`);
            }
            const dataloaderCls = relation.isOneToOneOwner || relation.isManyToOne
                ? ToOneOwnerDataloader
                : relation.isOneToOneNotOwner
                    ? ToOneNotOwnerDataloader
                    : relation.isOneToMany
                        ? OneToManyDataloader
                        : relation.isManyToMany
                            ? ManyToManyDataloader
                            : null;
            if (dataloaderCls == null) {
                return await next();
            }
            return await handler(root, tgdContext, relation, dataloaderCls, filterQueryWithContext);
        })(target, propertyKey);
    };
}
exports.ImplicitLoaderImpl = ImplicitLoaderImpl;
async function handler(root, { requestId, typeormGetConnection }, relation, dataloaderCls, filterQuery) {
    if (typeormGetConnection == null) {
        throw Error("Connection is not available");
    }
    const serviceId = `tgd-typeorm#${relation.entityMetadata.tableName}#${relation.propertyName}`;
    const container = typedi_1.default.of(requestId);
    if (!container.has(serviceId)) {
        container.set(serviceId, new dataloaderCls(relation, typeormGetConnection(), filterQuery));
    }
    const dataloader = container.get(serviceId);
    const columns = relation.entityMetadata.primaryColumns;
    const pk = columns.map((c) => c.getEntityValue(root));
    return await dataloader.load(JSON.stringify(pk));
}
class ToOneOwnerDataloader extends dataloader_1.default {
    constructor(relation, connection, filterQuery) {
        super(async (pks) => {
            const relationName = relation.inverseRelation.propertyName;
            const columns = relation.entityMetadata.primaryColumns;
            const entities = await findEntities(relation, connection, pks, relationName, columns, filterQuery);
            const referencedColumnNames = columns.map((c) => c.propertyPath);
            const entitiesByRelationKey = await getEntitiesByRelationKey(entities, relationName, referencedColumnNames);
            return pks.map((pk) => { var _a, _b; return (_b = (_a = entitiesByRelationKey[pk]) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : null; });
        });
    }
}
class ToOneNotOwnerDataloader extends dataloader_1.default {
    constructor(relation, connection, filterQuery) {
        super(async (pks) => {
            const inverseRelation = relation.inverseRelation;
            const relationName = relation.propertyName;
            const columns = inverseRelation.joinColumns;
            const entities = await findEntities(relation, connection, pks, relationName, columns, filterQuery);
            const referencedColumnNames = columns.map((c) => c.referencedColumn.propertyPath);
            const entitiesByRelationKey = await getEntitiesByRelationKey(entities, inverseRelation.propertyName, referencedColumnNames);
            return pks.map((pk) => { var _a, _b; return (_b = (_a = entitiesByRelationKey[pk]) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : null; });
        });
    }
}
class OneToManyDataloader extends dataloader_1.default {
    constructor(relation, connection, filterQuery) {
        super(async (pks) => {
            const inverseRelation = relation.inverseRelation;
            const columns = inverseRelation.joinColumns;
            const entities = await findEntities(relation, connection, pks, relation.propertyName, columns, filterQuery);
            const referencedColumnNames = columns.map((c) => c.referencedColumn.propertyPath);
            const entitiesByRelationKey = await getEntitiesByRelationKey(entities, inverseRelation.propertyName, referencedColumnNames);
            return pks.map((pk) => { var _a; return (_a = entitiesByRelationKey[pk]) !== null && _a !== void 0 ? _a : []; });
        });
    }
}
class ManyToManyDataloader extends dataloader_1.default {
    constructor(relation, connection, filterQuery) {
        super(async (pks) => {
            const inversePropName = relation.inverseRelation.propertyName;
            const { ownerColumns, inverseColumns } = relation.junctionEntityMetadata;
            const [relationName, columns] = relation.isManyToManyOwner
                ? [`${inversePropName}_${relation.propertyPath}`, ownerColumns]
                : [`${relation.propertyName}_${inversePropName}`, inverseColumns];
            const entities = await findEntities(relation, connection, pks, relationName, columns, filterQuery);
            const referencedColumnNames = columns.map((c) => c.referencedColumn.propertyPath);
            const entitiesByRelationKey = await getEntitiesByRelationKey(entities, inversePropName, referencedColumnNames);
            return pks.map((pk) => { var _a; return (_a = entitiesByRelationKey[pk]) !== null && _a !== void 0 ? _a : []; });
        });
    }
}
const findEntities = async function (relation, connection, stringifiedPrimaryKeys, relationName, columnMetas, filterQuery) {
    const { Brackets } = await Promise.resolve().then(() => __importStar(require("typeorm")));
    const qb = connection.createQueryBuilder(relation.type, relation.propertyName);
    if (relation.isOneToOneOwner || relation.isManyToOne) {
        qb.innerJoinAndSelect(`${relation.propertyName}.${relationName}`, relationName);
    }
    else if (relation.isOneToOneNotOwner ||
        relation.isOneToMany ||
        relation.isManyToMany) {
        const inversePropName = relation.inverseRelation.propertyName;
        qb.innerJoinAndSelect(`${relation.propertyName}.${inversePropName}`, inversePropName);
    }
    else {
        throw Error("never");
    }
    const primaryKeys = stringifiedPrimaryKeys.map((pk) => JSON.parse(pk));
    const columns = columnMetas.map((c) => `${relationName}.${c.propertyPath}`);
    const keys = columnMetas.map((c) => `${relationName}_${c.propertyAliasName}`);
    if (columnMetas.length === 1) {
        qb.where(`${columns[0]} IN (:...${keys[0]})`, {
            [keys[0]]: primaryKeys.map((pk) => pk[0]),
        });
    }
    else {
        // handle composite keys
        primaryKeys.forEach((pk, i) => {
            qb.orWhere(new Brackets((exp) => {
                columns.forEach((column, j) => {
                    const key = `${i}_${keys[j]}`;
                    exp.andWhere(`${column} = :${key}`, { [key]: pk[j] });
                });
            }));
        });
    }
    if (filterQuery) {
        filterQuery(qb);
    }
    return qb.getMany();
};
async function getEntitiesByRelationKey(entities, inversePropName, referencedColumnNames) {
    const entitiesByRelationKey = {};
    for (const entity of entities) {
        const referencedEntities = [await entity[inversePropName]].flat();
        referencedEntities.forEach((re) => {
            var _a;
            const key = JSON.stringify(referencedColumnNames.map((c) => re[c]));
            (_a = entitiesByRelationKey[key]) !== null && _a !== void 0 ? _a : (entitiesByRelationKey[key] = []);
            entitiesByRelationKey[key].push(entity);
        });
    }
    return entitiesByRelationKey;
}
