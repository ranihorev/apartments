import { findNewApartments } from "./utils";

export const handler = async () => {
  await findNewApartments();
};
