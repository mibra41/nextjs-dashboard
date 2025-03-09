## Finale

# Financial Dashboard

A modern web application built with Next.js that helps you track and manage your finances by connecting securely to your bank accounts through Plaid integration.

## Features

- **Secure Authentication**: User accounts with email/password login
- **Bank Account Integration**: Connect your bank accounts securely via Plaid
- **Dashboard View**: Get a comprehensive overview of your financial data
- **Responsive Design**: Works seamlessly across desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 14 with React
- **Authentication**: Auth.js (NextAuth)
- **Database**: PostgreSQL with Prisma ORM
- **API Integration**: Plaid API
- **Styling**: Tailwind CSS

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up your environment variables:
   - Database connection string
   - Plaid API keys
   - Auth.js secret
4. Run the development server with `npm run dev`
5. Visit `http://localhost:3000`

## Security

This application implements industry-standard security practices:
- Secure user authentication
- Encrypted data transmission
- No storage of sensitive banking credentials
- Plaid's secure token-based integration
