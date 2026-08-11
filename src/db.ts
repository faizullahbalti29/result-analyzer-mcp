import "dotenv/config";
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE;

if (!uri) {
  throw new Error("MONGODB_URI is not defined");
}

if (!databaseName) {
  throw new Error("MONGODB_DATABASE is not defined");
}

const client = new MongoClient(uri);

let database: Db | null = null;

export async function getDatabase(): Promise<Db> {
  if (database) {
    return database;
  }

  await client.connect();

  database = client.db(databaseName);

  return database;
}