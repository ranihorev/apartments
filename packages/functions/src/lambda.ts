import { S3 } from "@aws-sdk/client-s3";
import { SES } from "@aws-sdk/client-ses";
import { ApiHandler } from "sst/node/api";

const FILE_NAME = "data.json";

type Unit = Record<string, any>;
type Units = Array<Unit>;
interface UnitsData {
  count: number;
  unitModel: Units;
}

export const handler = ApiHandler(async (_evt) => {
  const url =
    "https://pd-stuytown-cd.stuytown.com/pux-api/units-filter/details?sc_apikey=5DE671A5-4DA5-437B-B9EE-81640ADFDA74&Bedrooms=2-3&Flex=false&page=1&Order=low-price&itemsOnPage=21&datasourceId=%7BF4A776F6-75AA-4D0A-8DE7-28A30B710E8A%7D&PropertyName=Stuyvesant+Town_Peter+Cooper+Village";
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
  const newUnits = findNewUnits(previousData?.unitModel || [], newData.unitModel);

  if (newUnits.length) {
    const email = newUnits.map(getUnitDataForEmail).join("\n----\n");
    await sendEmail(`New units found: ${newData.count}`, email);
    await storeDataToS3(newData);
    return {
      statusCode: 200,
      body: JSON.stringify({ status: `New units found: ${newData.count}`, data: email }),
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ status: "Nothing new found", data: newData }),
  };
});

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
    Bucket: "stuy-data",
    Key: FILE_NAME,
    Body: JSON.stringify(data),
  };

  await s3.putObject(params);
}

function findNewUnits(previousData: Units, newData: Units): Units {
  const newUnits = newData.filter((unit) => {
    return !previousData.some((prevUnit) => prevUnit.unitId === unit.unitId);
  });
  return newUnits;
}

async function readDataFromS3(key: string) {
  const s3 = new S3();
  const params = {
    Bucket: "stuy-data",
    Key: key,
  };
  const res = await s3.getObject(params);
  if (!res.Body) return undefined;
  const data = await res.Body.transformToString();
  return JSON.parse(data);
}

function getUnitDataForEmail(unit: Unit) {
  const url = unit.absoluteUrl;
  const price = unit.price;
  const size = unit.sqft;
  const address = unit.address;
  const bedrooms = unit.bedrooms;
  const neighborhood = unit.neighborhood;
  const finish = unit.finishName;
  const details = unit.amenitiesFriendlyDescription;
  const encodedAddress = encodeURIComponent(`${address}, New York`);

  return `
  ${neighborhood} - ${address}
  address: https://maps.google.com/?q=${encodedAddress}
  bedrooms: ${bedrooms}
  price: ${price}
  finish: ${finish}
  size: ${size} sqft
  link: ${url}
  description: ${details.join(", ")}
  `;
}
