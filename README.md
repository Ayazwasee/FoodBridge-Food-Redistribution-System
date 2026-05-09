<<<<<<< HEAD
# Food Redistribution Cloud Project

Beginner-friendly cloud computing project built with:
- Node.js + Express
- REST APIs
- JSON
- MongoDB
- Microservices
- Docker + Docker Compose
- AWS-ready deployment structure

## Services
- User Service: register and manage users
- Listing Service: create and manage surplus food listings
- Claim Service: NGOs claim food and mark it collected

## Run locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start MongoDB locally or use Atlas.
3. Run each service in separate terminals:
   ```bash
   npm run start:user
   npm run start:listing
   npm run start:claim
   ```
4. Open `frontend/index.html` with Live Server or any static server.

## Run with Docker
```bash
docker compose up --build
```

## Notes
- Update API URLs in `frontend/app.js` if you deploy services to AWS.
- For AWS, host frontend on S3 and backend services on EC2.
- Use Node.js 18 or higher because the claim service uses built-in `fetch`.
=======
# food-redistribution-cloud
>>>>>>> b7b079457f405313dc553f5a61e13d4876229055
