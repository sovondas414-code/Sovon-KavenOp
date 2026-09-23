import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

console.log("MongoDB URI exists:", !!uri);
console.log(
  "MongoDB URI:",
  uri ? uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:XXXXX@") : "undefined"
);

if (!uri) {
  throw new Error("MONGODB_URI is not configured");
}


if (!uri) {
  throw new Error("MONGODB_URI is not configured");
}

declare global {
  // Prevents multiple connections during Next.js development reloads.
  var mongodbClientPromise: Promise<MongoClient> | undefined;
}

const client = new MongoClient(uri);

const clientPromise =
  global.mongodbClientPromise ?? client.connect();

if (process.env.NODE_ENV !== "production") {
  global.mongodbClientPromise = clientPromise;
}

export default clientPromise;