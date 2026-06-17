# Snap-POS — Web-Based Back Office

## Overview
Snap-POS is a comprehensive Point of Sale system for retail stores. This repository contains the **web-based Back Office** application built with a modern tech stack.

## Tech Stack

### Backend (.NET Core 8)
- **Framework:** ASP.NET Core 8.0 Web API
- **ORM:** Entity Framework Core 8.0 with SQL Server
- **Authentication:** JWT Bearer + Google OAuth + MFA
- **Architecture:** Clean Architecture (Domain → Application → Infrastructure → API)
- **Payments:** Stripe integration for billing
- **Storage:** AWS S3 for file/image storage
- **Logging:** Serilog
- **Validation:** FluentValidation
- **API Docs:** Swagger/OpenAPI

### Frontend (React + TypeScript)
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 6
- **UI Framework:** TailwindCSS 4 + Material UI
- **State Management:** Redux Toolkit
- **Data Grid:** AG Grid + MUI DataGrid
- **Charts:** ApexCharts
- **Routing:** React Router 7

### Infrastructure
- **Cloud:** Microsoft Azure
- **Database:** Azure SQL Server (multi-tenant)
- **CI/CD:** GitHub Actions → Azure App Service
- **Print Agent:** Windows desktop service for local printing

## Project Structure
```
├── BackOffice.Api/              # ASP.NET Core Web API (entry point)
├── BackOffice.Application/      # Business logic & service interfaces
├── BackOffice.Domain/           # Domain entities & models
├── BackOffice.Infrastructure/   # Data access & external services
├── BackOffice.Persistence/      # Database contexts & repositories
├── BackOffice.Common/           # Shared utilities
├── BackOffice.Presentation/     # React frontend (Vite + TypeScript)
├── BackOffice.PrintAgent/       # Windows print agent service
├── SmartKartReg.Infrastructure/ # Registration/licensing system
├── Scripts/                     # SQL migration scripts
├── docs/                        # Architecture documentation
└── .github/workflows/           # CI/CD pipelines
```

## Features (Implemented)
- Dashboard with analytics
- Item/Inventory management
- Department management
- Customer management
- Vendor/Supplier management
- Purchase Orders
- Receive Orders
- Transfer management (Request/Receive)
- Return to Vendor
- Transaction history
- Reports (Sales, Profit, Tax, etc.)
- Label Designer & Printing
- User management with RBAC
- Multi-store support
- Billing & Licensing (Stripe)
- Phone Order integration
- AI Chatbot assistant
- Print Agent for local printing
- MFA (Multi-Factor Authentication)

## Deployment
Automated via GitHub Actions on push to the `QA` branch.
- API deploys to Azure App Service
- Frontend deploys to Azure Static Web App

## Development Setup
See individual project READMEs for local development instructions.
