# Noteora - Educational Notes Marketplace



**Learn. Share. Earn.**



Noteora is a full-stack MERN educational notes marketplace. Students browse and purchase approved PDFs, sellers manage materials and earnings, and administrators moderate users, content, orders and reports. The repository also contains PostgreSQL/Prisma infrastructure, Redis/BullMQ foundations, migration tooling, backup procedures, and a separate custom gateway foundation.



> MongoDB remains the current marketplace source of truth. PostgreSQL production cutover and live payment processing are not enabled.



## Technology Stack



| Area | Technology |

| --- | --- |

| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Framer Motion |

| Marketplace API | Node.js, Express 5, TypeScript |

| Marketplace data | MongoDB, Mongoose |

| Infrastructure data | PostgreSQL 16, Prisma ORM |

| Cache and workers | Redis 7, BullMQ |

| Authentication | JWT bearer tokens and bcrypt password hashing |

| Files | Multer, private PDF storage, PDF validation |

| Gateway foundation | Separate gateway API, PostgreSQL, Prisma and merchant services |

| Deployment | Docker Compose with persistent volumes and health checks |



## Local URLs



- Marketplace: `http://localhost:5173`

- Marketplace API: `http://localhost:5000/api/v1`

- API health: `http://localhost:5000/api/health`

- Admin panel: `http://localhost:5173/admin`

- Seller workspace: `http://localhost:5173/dashboard`

- Gateway admin: `http://localhost:5173/gateway/admin`

- Gateway merchant: `http://localhost:5173/gateway/merchant`



## Quick Start



### Requirements



- Node.js 20 or newer

- npm

- MongoDB or MongoDB Atlas

- Docker Desktop for optional infrastructure services



```powershell

npm install

npm run install:all

copy .env.example .env

copy server\.env.example server\.env

npm run dev

```



Start services separately when needed:



```powershell

npm --prefix server run dev

npm --prefix client run dev

```



Do not commit `.env`, database passwords, JWT secrets, API keys or webhook secrets.



## Implemented Product Areas



### Public Marketplace



- Brand landing page and responsive navigation

- Role-aware login/logout behavior

- Registration and JWT authentication

- Material browsing, search, subjects and category views

- Material detail and cart workflows

- Purchase history and verified paid download access

- Verified-purchase reviews

- Admin, seller and buyer route separation



### Seller Workspace



A fixed desktop sidebar and mobile bottom navigation provide consistent access to:



- Dashboard and moderation summary

- PDF and thumbnail upload

- Title, description, subject, academic level, tags and price fields

- Material status views: pending, approved and rejected

- Material editing and deletion for non-approved records

- Paid order and sold-material records

- Gross sales, commission, net earnings and settlement records

- Revenue and popular-material analytics views

- Buyer reviews and ratings

- Discount promotion creation, update and deletion

- Free, Pro and Ultra plan selection

- Seller profile editing

- Password change and notification preferences

- Support-ticket submission and history



Seller routes:



| Route | Page |

| --- | --- |

| `/dashboard` | Seller dashboard |

| `/seller/upload` | Upload notes |

| `/seller/materials` | Material management |

| `/seller/sales` | My sales |

| `/seller/earnings` | Earnings and payouts |

| `/seller/analytics` | Analytics |

| `/seller/reviews` | Reviews and ratings |

| `/seller/promotions` | Promotions |

| `/seller/subscription` | Subscription and plans |

| `/seller/profile` | Seller profile |

| `/seller/settings` | Security settings |

| `/seller/support` | Help and support |



### Admin Workspace



The fixed administration sidebar is present across all admin pages:



- Overview metrics and moderation summary

- User CRUD, activation and plan management

- Seller records and verification management

- Material moderation with feedback

- Category and subject CRUD

- Orders and payment statuses

- Refund requests and statuses

- Subscription-plan CRUD

- Financial reports

- User activity and login audit history



Admin routes:



| Route | Page |

| --- | --- |

| `/admin` | Overview |

| `/admin/users` | Users |

| `/admin/sellers` | Sellers |

| `/admin/materials` | Materials |

| `/admin/categories` | Categories |

| `/admin/orders` | Orders |

| `/admin/payments` | Payments |

| `/admin/refunds` | Refunds |

| `/admin/subscriptions` | Subscriptions |

| `/admin/reports` | Reports |

| `/admin/activity` | Activity |



### Infrastructure and Gateway



- PostgreSQL 16 and Prisma schema setup

- Separate marketplace and gateway database boundaries

- Redis and BullMQ queue infrastructure

- Least-privilege PostgreSQL role scripts

- MongoDB export and dry-run migration tooling

- Migration reconciliation and verification documentation

- Backup and restore procedures

- Gateway merchant onboarding, keys, RBAC, webhook configuration and audit foundations

- Docker Compose development definitions



## Marketplace API Families



- `/api/v1/auth`

- `/api/v1/users`

- `/api/v1/materials`

- `/api/v1/categories`

- `/api/v1/cart`

- `/api/v1/orders`

- `/api/v1/payments`

- `/api/v1/reviews`

- `/api/v1/subscriptions`

- `/api/v1/seller`

- `/api/v1/notifications`

- `/api/v1/support`

- `/api/v1/admin`



## Payment and Download Safety



- Material price limit is ₹150 per base note configuration.

- Only a verified payment state of `PAID` unlocks protected purchases.

- Browser success pages and checkout responses are never payment authority.

- Payment webhooks require signatures, event IDs, ordered sequences and amount validation.

- Seller ledger entries are created only after verified paid processing.

- Production refunds, settlements and payout execution remain unimplemented or provider-dependent.



The protected download flow starts with:



```text

GET /api/v1/orders/:orderId/download-token/:materialId

```



The signed URL expires after 15 minutes and binds the user, order, material and expiry.



## Build Commands



```powershell

# Full build

npm run build



# Frontend build

npm --prefix client run build



# Backend build

npm --prefix server run build



# Backend tests

npm --prefix server test



# PostgreSQL integration tests

npm run test:postgres



# Prisma validation

npm run prisma:validate



# Generate Prisma client

npm run prisma:generate

```



## Docker Commands



```powershell

docker compose config

docker compose up -d postgres redis mongodb

docker compose ps

docker compose down

```



Review service environment variables before startup. Never place real credentials in Compose files or committed environment files.



## Estimated Completion



| Area | Estimate | Current status |

| --- | ---: | --- |

| Public marketplace UI | 82% | Core pages, cart, auth, browse and responsive layout implemented |

| Seller workspace | 78% | Major routes and CRUD workflows implemented; live payout and complete analytics remain |

| Admin workspace | 80% | Overview, moderation and CRUD-oriented routes implemented |

| Marketplace API | 75% | Core data operations exist; advanced workflows require integration hardening |

| Authentication and authorization | 85% | JWT and role checks implemented; recovery and production sessions need hardening |

| MongoDB application | 85% | Operational development application remains authoritative |

| PostgreSQL and Prisma | 90% | Schema, migrations, tests and security scripts implemented |

| Redis and BullMQ | 85% | Queue and worker foundation implemented |

| Migration controls | 85% | Export, dry-run, reconciliation and reports available; no production cutover |

| Gateway foundation | 90% | Merchant, keys, permission, webhook and dashboard foundations implemented |

| Payment verification | 55% | Webhook-safe foundations exist; external sandbox/live validation remains |

| Live reporting | 55% | UI summaries exist; some charts need complete live database aggregation |

| Production operations | 65% | Backup and security controls exist; managed secrets, storage and monitoring remain |



### Overall estimate: approximately 78–82% of a production-ready MVP



This estimate describes implementation depth, not production readiness. The payment gateway, MongoDB/PostgreSQL cutover, privacy controls and operational monitoring are not yet complete enough for live public use.



## Remaining Work Before Production



1. Replace chart placeholders with complete database-derived aggregation.

2. Implement the seller draft and archive workflow fully.

3. Add live payout-provider integration with explicit settlement approval.

4. Complete real-time notification delivery.

5. Add seller profile images, contact data and verification documents.

6. Complete email verification and account recovery workflows.

7. Add automated end-to-end tests for buyer, seller and administrator journeys.

8. Move PDFs and thumbnails to private object storage with lifecycle rules.

9. Complete external payment sandbox testing and independent reconciliation.

10. Finish refund status and provider-refund automation.

11. Add managed logging, monitoring, alerting and dependency scanning.

12. Complete disaster-recovery and restore evidence.

13. Perform accessibility and security testing.

14. Review GST, marketplace settlement, privacy, terms and Indian regulatory requirements.

15. Execute a separately approved PostgreSQL cutover only after acceptance criteria pass.



## Important Production Restrictions



- Do not delete or replace existing MongoDB marketplace data.

- Do not make PostgreSQL authoritative without an explicit migration approval.

- Do not enable live payment collection or payout automation.

- Do not claim payment success from frontend navigation alone.

- Do not use unofficial or unauthorised UPI collection endpoints.

- Never expose credentials in browser code, API responses, logs or reports.



## Documentation



- `IMPLEMENTATION_AUDIT.md`

- `DATABASE_SECURITY.md`

- `POSTGRESQL_TESTING.md`

- `MIGRATION_VERIFICATION.md`

- `BACKUP_RESTORE.md`

- `PHASE5B_REPORT.md`

- `PHASE5B_1_REPORT.md`

- `PHASE5C_REPORT.md`

- `GATEWAY_ARCHITECTURE.md`

- `MERCHANT_ONBOARDING.md`

- `MERCHANT_API_KEYS.md`

- `MERCHANT_PERMISSIONS.md`

- `WEBHOOK_CONFIGURATION.md`

- `GATEWAY_SECURITY.md`

