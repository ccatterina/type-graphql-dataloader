"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApolloServerLoaderPlugin = void 0;
const typedi_1 = require("typedi");
const uuid_1 = require("uuid");
const ApolloServerLoaderPlugin = (option) => ({
    requestDidStart: () => ({
        didResolveSource(requestContext) {
            Object.assign(requestContext.context, {
                _tgdContext: {
                    requestId: (0, uuid_1.v4)(),
                    typeormGetConnection: option === null || option === void 0 ? void 0 : option.typeormGetConnection,
                },
            });
        },
        willSendResponse(requestContext) {
            typedi_1.Container.reset(requestContext.context._tgdContext.requestId);
        },
    }),
});
exports.ApolloServerLoaderPlugin = ApolloServerLoaderPlugin;
