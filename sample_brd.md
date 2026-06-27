# Business Requirement Document: User Authentication & Role Management Upgrade

## 1. Introduction
We need to upgrade our legacy authentication system to a secure OAuth2 and Role-Based Access Control (RBAC) system. The legacy database is outdated, and we need to modernise the user experience.

## 2. Actors & Roles
1. **Customer**:
   - Register a new account.
   - Log in using email and password.
   - Reset password using email.
   - Access their personalized profile dashboard.
2. **Admin**:
   - View list of all registered users.
   - Lock/unlock customer accounts.
   - Assign roles to other staff members.

## 3. Core Requirements
- Users must be able to register and login securely.
- Multi-factor authentication (MFA) must be supported via TOTP (e.g. Google Authenticator) for Admin accounts. For customer accounts, we might want to roll this out later, but it is not decided yet.
- Implement a password reset flow. When a user requests a reset, a token should be sent to their email.
- Session Management: Sessions must expire after 30 minutes of inactivity. Can we extend this for mobile users? We need to figure this out.

## 4. Technical Constraints
- Password hashing must use Argon2id.
- Social sign-in (Google/Apple) is explicitly out of scope for this release due to security compliance rules.
- Email delivery must go through SendGrid API. We need to obtain credentials from the DevOps team.
