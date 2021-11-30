"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Loader = void 0;
const type_graphql_1 = require("type-graphql");
const dataloader_1 = __importDefault(require("dataloader"));
const typedi_1 = __importDefault(require("typedi"));
function Loader(batchLoadFn, options) {
    return (target, propertyKey, descriptor) => {
        (0, type_graphql_1.UseMiddleware)(async ({ context }, next) => {
            const serviceId = `tgd#${target.constructor.name}#${propertyKey.toString()}`;
            const { requestId } = context._tgdContext;
            const container = typedi_1.default.of(requestId);
            if (!container.has(serviceId)) {
                container.set(serviceId, new dataloader_1.default((keys) => batchLoadFn(keys, { context }), options));
            }
            const dataloader = container.get(serviceId);
            return await (await next())(dataloader);
        })(target, propertyKey);
    };
}
exports.Loader = Loader;
