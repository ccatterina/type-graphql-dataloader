import type { ObjectType, SelectQueryBuilder } from "typeorm";
export interface TypeormLoaderOption {
    selfKey: boolean;
}
export declare type KeyFunc = (root: any) => any | any[] | undefined;
export declare type FilterQuery = <T>(qb: SelectQueryBuilder<T>, context?: any) => void;
export declare function TypeormLoader(): PropertyDecorator;
export declare function TypeormLoader(keyFunc: KeyFunc, option?: TypeormLoaderOption): PropertyDecorator;
export declare function TypeormLoader<V>(typeFunc: (type?: void) => ObjectType<V>, keyFunc: KeyFunc, option?: TypeormLoaderOption): PropertyDecorator;
export declare function FilteredTypeormLoader(filterQuery: FilterQuery): PropertyDecorator;
export declare function FilteredTypeormLoader(filterQuery: FilterQuery, keyFunc: KeyFunc, option?: TypeormLoaderOption): PropertyDecorator;
export declare function FilteredTypeormLoader<V>(filterQuery: FilterQuery, typeFunc: (type?: void) => ObjectType<V>, keyFunc: KeyFunc, option?: TypeormLoaderOption): PropertyDecorator;
