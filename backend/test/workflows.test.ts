// Integration tests for the core workflows: store creation, price entry, price read.
// Needs the local Supabase stack running (docker start supabase_*_juicebox). Run: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import app from "../index.js";
import { prisma } from "../lib/prisma.js";
import { supabaseAdmin } from "../lib/supabase.js";

const server = app.listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
const email = `test-${Date.now()}@example.com`;
let token = "";
let userId = "";
let storeId = "";
let itemId = "";
let entryId = "";

const api = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};

before(async () => {
  const { status, json } = await api("POST", "/api/auth/register", { email, password: "Test12345!", name: "Test User" });
  assert.equal(status, 201);
  token = json.data.token;
  userId = json.data.user.id;
});

after(async () => {
  await prisma.priceEntry.deleteMany({ where: { entryByUserId: userId } });
  if (itemId) await prisma.item.delete({ where: { id: itemId } });
  if (storeId) await prisma.storeLocation.delete({ where: { id: storeId } });
  await prisma.user.delete({ where: { id: userId } });
  await supabaseAdmin.auth.admin.deleteUser(userId);
  await prisma.$disconnect();
  server.close();
});

test("create a store", async () => {
  const { status, json } = await api("POST", "/api/stores", {
    storeName: "Test No Frills", storeGroup: "Loblaws Group", address: "1 Test St", city: "Toronto", province: "ON", postalCode: "m1a 1a1",
  });
  assert.equal(status, 201);
  assert.equal(json.data.storeName, "Test No Frills");
  assert.equal(json.data.postalCode, "M1A 1A1");
  storeId = json.data.id;
});

test("create a price entry and compute price per kg", async () => {
  const item = await api("POST", "/api/items", { productName: "Test Ground Beef", brand: "Test", category: "MEAT_SEAFOOD" });
  assert.equal(item.status, 201);
  itemId = item.json.data.id;

  // $25 per 100 g → $250 / kg
  const { status, json } = await api("POST", "/api/prices", { itemId, locationId: storeId, price: 25, weight: 100, unit: "G" });
  assert.equal(status, 201);
  assert.equal(Number(json.data.pricePerKg), 250);
  entryId = json.data.id;
});

test("rejects a price entry with missing fields", async () => {
  const { status } = await api("POST", "/api/prices", { itemId, locationId: storeId, price: 25 });
  assert.equal(status, 400);
});

test("author can correct their own entry", async () => {
  const { status, json } = await api("PUT", `/api/prices/${entryId}`, { price: 30, weight: 100, unit: "G" });
  assert.equal(status, 200);
  assert.equal(Number(json.data.pricePerKg), 300);
  // put it back so the read test below still sees the original values
  await api("PUT", `/api/prices/${entryId}`, { price: 25 });
});

test("read the price entry back by id and via item compare", async () => {
  const byId = await api("GET", `/api/prices/${entryId}`);
  assert.equal(byId.status, 200);
  assert.equal(Number(byId.json.data.price), 25);
  assert.equal(byId.json.data.location.storeName, "Test No Frills");

  const compare = await api("GET", `/api/prices/item/${itemId}/compare`);
  assert.equal(compare.status, 200);
  assert.equal(compare.json.data.length, 1);
  assert.equal(compare.json.data[0].location.storeName, "Test No Frills");
  assert.equal(Number(compare.json.data[0].price_per_kg), 250);
});
