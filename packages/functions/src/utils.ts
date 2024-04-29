import { NoSuchKey, S3 } from "@aws-sdk/client-s3";
import { SES } from "@aws-sdk/client-ses";

const FILE_NAME = "data.json";

type Unit = Record<string, any>;
type Units = Array<Unit>;
interface UnitsData {
  count: number;
  unitModels: Units;
}

const BUCKET = process.env.IS_LOCAL ? "stuy-data" : "stuy-data-prod";

export async function findNewApartments() {
  console.log("finding new units");
  const url =
    "https://pd-di.beamliving.com/api/units?Bedrooms=2-3&Flex=false&page=0&itemsOnPage=21&PropertyName=Stuyvesant+Town_Peter+Cooper+Village";
  const result = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
      residentproperty: "ResidentProperty",
      "sec-ch-ua": '"Chromium";v="121", "Not A(Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      Referer: "https://www.stuytown.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
    body: null,
    method: "GET",
  });
  const newData = (await result.json()) as UnitsData;
  const previousData = (await readDataFromS3(FILE_NAME)) as UnitsData | undefined;
  const newUnits = findNewUnits(previousData?.unitModels || [], newData.unitModels);

  const numNewUnits = newUnits.length;
  if (numNewUnits > 0) {
    const email = newUnits.map(getUnitDataForEmail).join("\n----\n");
    await sendEmail(`New units found: ${numNewUnits}`, email);
    await storeDataToS3(newData);
    return { status: `New units found: ${numNewUnits}`, data: email };
  } else {
    console.log("No new units were found");
  }
  return { status: "Nothing new found", data: newData };
}

async function sendEmail(subject: string, data: string) {
  const client = new SES();
  const params = {
    Destination: {
      ToAddresses: ["found@ranihorev.com"],
    },
    Message: {
      Body: {
        Text: { Data: data },
      },
      Subject: { Data: subject },
    },
    Source: "stuy@ranihorev.com",
  };

  await client.sendEmail(params);
}

async function storeDataToS3(data: any) {
  const s3 = new S3();
  const params = {
    Bucket: BUCKET,
    Key: FILE_NAME,
    Body: JSON.stringify(data),
  };

  await s3.putObject(params);
}

function findNewUnits(previousData: Units, newData: Units): Units {
  const newUnits = newData.filter((unit) => {
    return !previousData.some((prevUnit) => prevUnit.unitSpk === unit.unitSpk);
  });
  return newUnits;
}

async function readDataFromS3(key: string) {
  const s3 = new S3();
  const params = {
    Bucket: BUCKET,
    Key: key,
  };
  try {
    const res = await s3.getObject(params);
    if (!res.Body) return undefined;
    const data = await res.Body.transformToString();
    return JSON.parse(data);
  } catch (e) {
    if (e instanceof NoSuchKey) {
      console.log(`Key ${key} not found in S3`);
    } else {
      console.error(e);
    }
    return undefined;
  }
}

function getUnitDataForEmail(unit: Unit) {
  // const url = unit.absoluteUrl;
  const price = unit.unitRates["12"];
  const size = unit.sqft;
  const address = unit.building.address;
  const bedrooms = unit.bedrooms;
  const bathrooms = unit.bathrooms;
  const neighborhood = unit.property.name;
  const finish = unit.finish.name;
  const details = unit.amenities.map((amenity: any) => amenity.friendlyDescription).join(", ");
  const availableAt = ((unit.availableDate as string) || "").slice(0, 10);
  // const encodedAddress = encodeURIComponent(`${address}, New York`);

  return `
  ${neighborhood} - ${address}
  bedrooms: ${bedrooms}
  bathrooms: ${bathrooms}
  price: ${price}
  finish: ${finish}
  size: ${size} sqft
  availableAt: ${availableAt}
  description: ${details}
  `;
}
