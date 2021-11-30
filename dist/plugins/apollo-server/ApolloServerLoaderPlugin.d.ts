import type { Connection } from "typeorm";
interface ApolloServerLoaderPluginOption {
    typeormGetConnection?: () => Connection;
}
declare const ApolloServerLoaderPlugin: (option?: ApolloServerLoaderPluginOption | undefined) => {
    requestDidStart: () => {
        didResolveSource(requestContext: {
            context: Record<string, any>;
        }): void;
        willSendResponse(requestContext: {
            context: Record<string, any>;
        }): void;
    };
};
export { ApolloServerLoaderPlugin };
