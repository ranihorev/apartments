import { Api, Bucket, Cron, Function, StackContext } from "sst/constructs";

export function API({ stack }: StackContext) {
  const bucketName = stack.stage !== "prod" ? "stuy-data" : "stuy-data-prod";
  const bucket = new Bucket(stack, "Bucket", { name: bucketName });

  new Cron(stack, "cron", {
    schedule: "rate(15 minutes)",
    job: {
      function: {
        handler: "packages/functions/src/cron.handler",
        permissions: ["ses", "s3"],
        environment: {
          NODE_TLS_REJECT_UNAUTHORIZED: "0",
        },
      },
    },
  });

  new Function(stack, "lambda", {
    handler: "packages/functions/src/lambda.handler",
    permissions: ["ses"],
    bind: [bucket],
    environment: {
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
    },
  });

  const api = new Api(stack, "api", {
    routes: {
      "GET /": "packages/functions/src/lambda.handler",
    },
  });

  stack.addOutputs({
    ApiEndpoint: api.url,
  });
}
