# JuiceBox - Complete Technical Brief

---

## 1. Overview

**App Name:** JuiceBox

**Problem Statement:**
Grocery prices are inconsistent across stores and change frequently. Consumers have no easy way to track, compare or monitor these changes over time. JuiceBox solves this by giving users a fast, simple tool to log and compare grocery prices across Canadian stores.

**Value Proposition:**

> *Help users find the best price for their groceries by comparing prices across multiple stores and tracking how those prices change over time*
> 

**Key Insight:**
JuiceBox is a **community driven** price tracking app. Every price entry made by any user enriches the global database making the app more valuable for everyone.

---

## 2. Platform

| Property | Decision |
| --- | --- |
| **Type** | Web Application |
| **Design Priority** | Mobile First |
| **Primary Use Case** | In store, standing, on cellular data |
| **Initial Market** | Canada |
| **Future Market** | North America |

---

## 3. Tech Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| **Frontend** | React + Vite | Lightweight, fast, no vendor lock in |
| **Styling** | Tailwind CSS | Utility first, mobile friendly |
| **Components** | DaisyUI | Pre-built components on Tailwind |
| **Backend** | Express.js | Simple, flexible API server |
| **Database** | PostgreSQL via Supabase | Open source, portable |
| **ORM** | Prisma | Database agnostic, type safe |
| **Auth** | Supabase Auth | Email + password, SSO ready |
| **Hosting** | Render or Railway | Low cost, no vendor lock in |

---

## 4. Architecture

### 4.1 Project Structure

```
juicebox/
├── client/                     # React + Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── BottomNav.tsx
│   │   │   │   ├── StoreCard.tsx
│   │   │   │   ├── ItemCard.tsx
│   │   │   │   └── PriceCard.tsx
│   │   │   └── forms/
│   │   │       ├── PriceEntryForm.tsx
│   │   │       └── LoginForm.tsx
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   └── Register.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── stores/
│   │   │   │   ├── MyStores.tsx
│   │   │   │   ├── ExploreStores.tsx
│   │   │   │   └── StoreDetail.tsx
│   │   │   ├── items/
│   │   │   │   ├── BrowseItems.tsx
│   │   │   │   └── ItemDetail.tsx
│   │   │   ├── PriceEntry.tsx
│   │   │   └── Profile.tsx
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   └── utils.ts
│   │   └── types/
│   │       └── index.ts
│
├── server/                     # Express.js Backend
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── stores.ts
│   │   ├── items.ts
│   │   ├── prices.ts
│   │   └── users.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── errorHandler.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── utils.ts
│   └── index.ts
│
└── prisma/
    └── schema.prisma           # Database schema
```

---

### **4.2 Database Architecture**

**Strategy:** 3 table split to manage scale and performance

**Performance Rules:**

- Indexed fields on item_id, location_id and datetime
- All queries paginated
- Most recent price entry is the current price
- Prices cached to reduce database hits
- Old entries archived over time

### **Table 1: Items (Static - rarely changes)**

| **Field** | **Type** | **Description** | **Example** |
| --- | --- | --- | --- |
| **item_id** | UUID | Unique identifier | item_123 |
| **product_name** | String | Product name | Partly Skimmed Milk |
| **brand** | String | Product brand | Natrel |
| **barcode_sku** | String | For future OCR | 056732123456 |
| **category** | Enum | Product category | DAIRY |
| **created_at** | DateTime | Record created | 2024-01-15 |

### **Table 2: Store Locations (Static - rarely changes)**

| **Field** | **Type** | **Description** | **Example** |
| --- | --- | --- | --- |
| **location_id** | UUID | Unique identifier | loc_123 |
| **store_name** | String | Store banner name | No Frills |
| **store_group** | String | Parent company | Loblaws Group |
| **address** | String | Street address | 123 Main St |
| **city** | String | City | Toronto |
| **province** | String | Province | ON |
| **postal_code** | String | Postal code | M1A 1A1 |
| **created_at** | DateTime | Record created | 2024-01-15 |

### **Table 3: Price Entries (Dynamic - grows constantly)**

| **Field** | **Type** | **Description** | **Example** |
| --- | --- | --- | --- |
| **entry_id** | UUID | Unique identifier | entry_123 |
| **item_id** | UUID | Links to Items | item_123 |
| **location_id** | UUID | Links to Store Locations | loc_123 |
| **price** | Decimal | Shelf price CAD | 5.99 |
| **weight** | Decimal | Product size | 2 |
| **unit** | Enum | Unit of measurement | L |
| **price_per_kg** | Decimal | Auto calculated CAD/kg | 2.99 |
| **datetime** | DateTime | When logged | 2024-01-15 14:32 |
| **notes** | String | User observations | On sale |
| **entry_by_user_id** | UUID | Who logged it | usr_123 |
| **created_at** | DateTime | Record created | 2024-01-15 |

### **Table 4: Users**

| **Field** | **Type** | **Description** | **Example** |
| --- | --- | --- | --- |
| **user_id** | UUID | Unique identifier | usr_123 |
| **name** | String | Display name | John |
| **email** | String | Login email | [john@email.com](mailto:john@email.com) |
| **role** | Enum | User role | ADMIN, USER |
| **household_id** | UUID | Family group | hh_123 |
| **location** | String | General area | Toronto ON |
| **my_stores** | Array | Personal store list | [loc_123, loc_456] |
| **created_at** | DateTime | Account created | 2024-01-15 |

### **Table 5: Households**

| **Field** | **Type** | **Description** | **Example** |
| --- | --- | --- | --- |
| **household_id** | UUID | Unique identifier | hh_123 |
| **household_name** | String | Family name | The Smiths |
| **members** | Array | List of user IDs | [usr_123, usr_456] |
| **created_by** | UUID | Creator user ID | usr_123 |
| **created_at** | DateTime | Record created | 2024-01-15 |

---

### 4.3 Prisma Schema

```json
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =============================
// ENUMS
// =============================

enum Role {
  ADMIN
  USER
}

enum Category {
  DAIRY
  MEAT_SEAFOOD
  PRODUCE
  PANTRY
  FROZEN
  BEVERAGES
  HEALTH_BEAUTY
  HOUSEHOLD
}

enum Unit {
  KG
  G
  L
  ML
  LBS
  OZ
  UNIT
}

// =============================
// ITEMS TABLE
// Static - rarely changes
// =============================

model Item {
  id          String       @id @default(uuid())
  productName String       @map("product_name")
  brand       String
  barcodeSku  String?      @map("barcode_sku")  // Optional for now, required for OCR later
  category    Category
  createdAt   DateTime     @default(now()) @map("created_at")

  // Relations
  priceEntries PriceEntry[]

  @@index([productName])  // Index for fast search
  @@index([brand])        // Index for fast search
  @@index([barcodeSku])   // Index for future OCR matching
  @@map("items")
}

// =============================
// STORE LOCATIONS TABLE
// Static - rarely changes
// =============================

model StoreLocation {
  id          String       @id @default(uuid())
  storeName   String       @map("store_name")
  storeGroup  String       @map("store_group")
  address     String
  city        String
  province    String
  postalCode  String       @map("postal_code")
  createdAt   DateTime     @default(now()) @map("created_at")

  // Relations
  priceEntries PriceEntry[]
  userStores   UserStore[]

  @@index([storeName])    // Index for fast search
  @@index([city])         // Index for filtering by city
  @@index([province])     // Index for filtering by province
  @@map("store_locations")
}

// =============================
// PRICE ENTRIES TABLE
// Dynamic - grows constantly
// =============================

model PriceEntry {
  id            String        @id @default(uuid())
  itemId        String        @map("item_id")
  locationId    String        @map("location_id")
  price         Decimal       @db.Decimal(10, 2)
  weight        Decimal       @db.Decimal(10, 3)
  unit          Unit
  pricePerKg    Decimal       @map("price_per_kg") @db.Decimal(10, 2)
  datetime      DateTime      @default(now())
  notes         String?
  entryByUserId String        @map("entry_by_user_id")
  createdAt     DateTime      @default(now()) @map("created_at")

  // Relations
  item          Item          @relation(fields: [itemId], references: [id])
  location      StoreLocation @relation(fields: [locationId], references: [id])
  user          User          @relation(fields: [entryByUserId], references: [id])

  @@index([itemId])       // Critical for price comparison queries
  @@index([locationId])   // Critical for store queries
  @@index([datetime])     // Critical for price history queries
  @@index([itemId, locationId, datetime]) // Compound index for most common query
  @@map("price_entries")
}

// =============================
// USERS TABLE
// =============================

model User {
  id          String      @id @default(uuid())
  name        String
  email       String      @unique
  role        Role        @default(USER)
  householdId String?     @map("household_id")
  location    String?
  createdAt   DateTime    @default(now()) @map("created_at")

  // Relations
  household    Household?   @relation(fields: [householdId], references: [id])
  priceEntries PriceEntry[]
  userStores   UserStore[]

  @@index([email])        // Index for auth lookups
  @@index([householdId])  // Index for household queries
  @@map("users")
}

// =============================
// HOUSEHOLDS TABLE
// =============================

model Household {
  id            String    @id @default(uuid())
  householdName String    @map("household_name")
  createdBy     String    @map("created_by")
  createdAt     DateTime  @default(now()) @map("created_at")

  // Relations
  members       User[]

  @@map("households")
}

// =============================
// USER STORES TABLE
// Junction table for My Stores
// =============================

model UserStore {
  id         String        @id @default(uuid())
  userId     String        @map("user_id")
  locationId String        @map("location_id")
  createdAt  DateTime      @default(now()) @map("created_at")

  // Relations
  user       User          @relation(fields: [userId], references: [id])
  location   StoreLocation @relation(fields: [locationId], references: [id])

  @@unique([userId, locationId])  // Prevent duplicate store entries
  @@index([userId])               // Index for My Stores queries
  @@map("user_stores")
}
```

---

# **Key Design Decisions Explained**

### **Why These Indexes?**

| **Index** | **Table** | **Reason** |
| --- | --- | --- |
| **productName, brand** | Items | Fast item search as user types |
| **barcodeSku** | Items | Future OCR barcode matching |
| **storeName, city, province** | Store Locations | Fast store search and filtering |
| **itemId** | Price Entries | Fast price comparison queries |
| **locationId** | Price Entries | Fast store price queries |
| **datetime** | Price Entries | Fast price history queries |
| **itemId + locationId + datetime** | Price Entries | Most common combined query |
| **email** | Users | Fast auth lookups |
| **householdId** | Users | Fast household member queries |
| **userId** | User Stores | Fast My Stores queries |

---

### **Why A Junction Table For User Stores?**

Instead of storing My Stores as an array on the User table we use a **dedicated UserStore junction table** because:

| **Reason** | **Explanation** |
| --- | --- |
| **Queryable** | Can query and filter store relationships |
| **Scalable** | No array size limitations |
| **Relational** | Proper foreign key relationships |
| **Flexible** | Easy to add extra fields later like last visited |

# Additional Development Context

---

## 1. Environment Variables

```bash
# .env

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Database
DATABASE_URL=your_supabase_postgresql_connection_string

# Server
PORT=3000
NODE_ENV=development

# Client
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3000
```

---

## 2. API Endpoints

### Auth Routes

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| POST | /api/auth/register | Register new user | ❌ |
| POST | /api/auth/login | Login user | ❌ |
| POST | /api/auth/logout | Logout user | ✅ |
| GET | /api/auth/me | Get current user | ✅ |

### Store Routes

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| GET | /api/stores | Get all stores | ✅ |
| GET | /api/stores/:id | Get store by ID | ✅ |
| GET | /api/stores/search | Search stores | ✅ |
| GET | /api/stores/province/:province | Get stores by province | ✅ |
| POST | /api/stores | Create store | 🔴 ADMIN |
| PUT | /api/stores/:id | Update store | 🔴 ADMIN |
| DELETE | /api/stores/:id | Delete store | 🔴 ADMIN |

### User Store Routes (My Stores)

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| GET | /api/users/stores | Get my stores | ✅ |
| POST | /api/users/stores | Add to my stores | ✅ |
| DELETE | /api/users/stores/:id | Remove from my stores | ✅ |

### Item Routes

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| GET | /api/items | Get all items | ✅ |
| GET | /api/items/:id | Get item by ID | ✅ |
| GET | /api/items/search | Search items | ✅ |
| GET | /api/items/category/:category | Get items by category | ✅ |
| POST | /api/items | Create item | ✅ |
| PUT | /api/items/:id | Update item | 🔴 ADMIN |
| DELETE | /api/items/:id | Delete item | 🔴 ADMIN |

### Price Entry Routes

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| GET | /api/prices | Get all price entries | ✅ |
| GET | /api/prices/:id | Get entry by ID | ✅ |
| GET | /api/prices/item/:itemId | Get prices for item | ✅ |
| GET | /api/prices/item/:itemId/history | Get price history | ✅ |
| GET | /api/prices/item/:itemId/compare | Compare prices across stores | ✅ |
| GET | /api/prices/location/:locationId | Get prices at location | ✅ |
| POST | /api/prices | Create price entry | ✅ |
| PUT | /api/prices/:id | Update price entry | 🔴 ADMIN |
| DELETE | /api/prices/:id | Delete price entry | 🔴 ADMIN |

### User Routes

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| GET | /api/users/me | Get current user | ✅ |
| PUT | /api/users/me | Update current user | ✅ |
| GET | /api/users/household | Get household members | ✅ |
| POST | /api/users/household | Create household | ✅ |
| POST | /api/users/household/join | Join household | ✅ |
| GET | /api/users | Get all users | 🔴 ADMIN |
| DELETE | /api/users/:id | Delete user | 🔴 ADMIN |

---

## 3. Query Patterns

### Most Common Queries

These are the most frequent database queries JuiceBox will run:

```sql
-- 1. Get most recent price for an item across all stores
-- Used for: Price comparison view
SELECT DISTINCT ON (location_id)
  pe.*,
  i.product_name,
  i.brand,
  sl.store_name,
  sl.city
FROM price_entries pe
JOIN items i ON pe.item_id = i.id
JOIN store_locations sl ON pe.location_id = sl.id
WHERE pe.item_id = $1
ORDER BY pe.location_id, pe.datetime DESC;

-- 2. Get price history for an item at a specific store
-- Used for: Price history line chart
SELECT
  price,
  price_per_kg,
  datetime
FROM price_entries
WHERE item_id = $1
AND location_id = $2
ORDER BY datetime ASC;

-- 3. Search items by name or brand
-- Used for: Inline search on price entry form
SELECT *
FROM items
WHERE product_name ILIKE $1
OR brand ILIKE $1
LIMIT 5;

-- 4. Get all stores in a province
-- Used for: Explore stores filtered by province
SELECT *
FROM store_locations
WHERE province = $1
ORDER BY store_name ASC;

-- 5. Get recent price entries by household
-- Used for: Dashboard feed
SELECT
  pe.*,
  i.product_name,
  i.brand,
  sl.store_name,
  u.name as entered_by
FROM price_entries pe
JOIN items i ON pe.item_id = i.id
JOIN store_locations sl ON pe.location_id = sl.id
JOIN users u ON pe.entry_by_user_id = u.id
WHERE u.household_id = $1
ORDER BY pe.datetime DESC
LIMIT 20;
```

---

## 4. Pagination Standard

All list endpoints will follow this standard pagination pattern:

```tsx
// Standard pagination query params
// GET /api/prices?page=1&limit=20

// Standard pagination response
{
  data: [...],
  pagination: {
    page: 1,
    limit: 20,
    total: 100,
    totalPages: 5,
    hasNextPage: true,
    hasPrevPage: false
  }
}
```

---

## 5. Error Handling Standard

All API endpoints will follow this standard error response format:

```tsx
// Standard error response
{
  error: {
    code: 'NOT_FOUND',
    message: 'Item not found',
    status: 404
  }
}

// Standard success response
{
  data: {...},
  message: 'Success'
}

// Error codes used across the app
enum ErrorCode {
  BAD_REQUEST     = 400,
  UNAUTHORIZED    = 401,
  FORBIDDEN       = 403,
  NOT_FOUND       = 404,
  CONFLICT        = 409,
  SERVER_ERROR    = 500
}
```

---

## 6. Authentication Flow

```
Register:
User submits email + password
→ Supabase Auth creates auth user
→ Our Users table creates profile
→ JWT token returned to client
→ Token stored in localStorage
→ User redirected to Dashboard

Login:
User submits email + password
→ Supabase Auth validates credentials
→ JWT token returned to client
→ Token stored in localStorage
→ User redirected to Dashboard

Protected Routes:
Client sends request with JWT in header
→ Authorization: Bearer <token>
→ Server middleware validates token
→ User context attached to request
→ Route handler executes
```

---
