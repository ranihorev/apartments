import { StackContext, Api, EventBus, Bucket, Function } from "sst/constructs";

export function API({ stack }: StackContext) {
  const bucket = new Bucket(stack, "Bucket", { name: "stuy-data" });

  const api = new Api(stack, "api", {
    defaults: {
      function: {
        bind: [bucket],
        permissions: ["ses"],
        environment: {
          NODE_TLS_REJECT_UNAUTHORIZED: "0",
        },
      },
    },
    routes: {
      "GET /": "packages/functions/src/lambda.handler",
    },
  });

  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
