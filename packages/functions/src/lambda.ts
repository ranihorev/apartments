import { ApiHandler } from "sst/node/api";
import { findNewApartments } from "./utils";

export const handler = ApiHandler(async (_evt) => {
  const res = await findNewApartments();
  return {
    statusCode: 200,
    body: JSON.stringify(res),
  };
});
