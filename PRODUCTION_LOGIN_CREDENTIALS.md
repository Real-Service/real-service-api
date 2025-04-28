# Production Login Credentials

This document contains the valid login credentials for the production database.

## Contractor Users

| ID | Username | Email | Full Name | Password |
|----|----------|-------|-----------|----------|
| 3 | `contractor7` | contractor7@expressbd.ca | contractor 7 | `password123` |
| 4 | `contractor1` | contractor1@example.com | Contractor One | `password123` |
| 5 | `contractor2` | contractor2@example.com | Contractor Two | `password123` |
| 6 | `contractor3` | contractor3@example.com | Contractor Three | `password123` |
| 7 | `contractor 10` | info@expressbd.ca | simeon johnson | `password` |
| 13 | `mikeplumber` | mike.plumber@example.com | Mike Wilson | `password123` |
| 14 | `electricianbob` | bob.electrician@example.com | Bob Smith | `password123` |
| 15 | `testuser586577` | testuser586577@example.com | Test User | `password123` |
| 16 | `testuser605623` | testuser605623@example.com | Test User | `password123` |
| 17 | `testuser818072` | testuser818072@example.com | Test User | `password123` |
| 19 | `contractor 7` | contractor7@example.com | Contractor Seven | `password123` |
| 20 | `testuser` | test@example.com | Test User | `password123` |
| 21 | `testuser_547998` | test547998@example.com | Test Complete Flow User | `password123` |
| 22 | `testuser903684` | testuser903684@example.com | Test User | `password123` |

## Landlord Users

| ID | Username | Email | Full Name | Password |
|----|----------|-------|-----------|----------|
| 1 | `landlord1` | landlord1@example.com | John Smith | `password123` |
| 2 | `landlord2` | landlord2@example.com | Jane Doe | `password123` |
| 11 | `johnlandlord` | john.landlord@example.com | John Landlord | `password123` |
| 12 | `sarahlandlord` | sarah.landlord@example.com | Sarah Johnson | `password123` |
| 18 | `testlandlord` | landlord@example.com | Test Landlord | `password123` |

## Notes

- The production database is hosted on Neon in the `us-east-1` region.
- Both bcrypt (`$2b$...`) and scrypt hashing formats are supported by the login system.
- When testing the application, make sure to use the exact username as shown above, including spaces.
- User with ID 7 (`contractor 10`) uses password `password` while all others use `password123`.
