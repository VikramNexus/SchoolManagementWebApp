# Database

MySQL schema and seed data for the School Student & Fee Management System.

| File          | Purpose                                                             | Day |
|---------------|---------------------------------------------------------------------|-----|
| `schema.sql`  | Relational schema — 16 normalized tables with FKs & indexes         | 2   |
| `seeders.sql` | Initial seed data — admin user, classes 1-12, sections A/B/C, settings | 2   |

Import order (see `README.md` at repo root):

```bash
mysql -u root -p school_management_db < database/schema.sql
mysql -u root -p school_management_db < database/seeders.sql
```
