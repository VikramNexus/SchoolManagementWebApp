# School Management Web & Mobile System
## Complete Step-by-Step Client Deployment & Maintenance Handover Guide

---

### 1. Executive Overview & System Architecture
This system is built with a **Cloud-First Architecture**. The entire database, backend APIs, and frontend are hosted in the cloud (Render + Cloud MySQL).

**Key Advantages of this Setup:**
- **100% Zero-Touch Maintenance**: When you update UI, add reports, or fix bugs and push to GitHub, the client automatically gets the update on both their Laptop and Mobile without any reinstallations.
- **1-Click Laptop Desktop App**: The client gets a dedicated School Management icon on their Windows desktop that opens in a standalone window without browser distractions.
- **Live Android Mobile App**: The client gets a dedicated mobile app icon on their phone with direct access to receipts, WhatsApp alerts, student ledgers, and backup downloads.
- **Automated & Manual Safe Backups**: The client can download complete SQL backups or Class-wise Student Excel Dossiers (ZIP) anytime with a single click.

---

### 2. Step-by-Step: Setting Up Client Laptop (Windows / Mac)
Follow these 4 simple steps on the client’s laptop (Takes less than 1 minute):

1. **Step 1**: Open **Google Chrome** or **Microsoft Edge** on the client’s laptop.
2. **Step 2**: Navigate to your live production URL:  
   `https://schoolmanagementwebapp.onrender.com`
3. **Step 3**: Click the **"Install App"** button in the address bar  
   *(In Chrome: click the computer install icon in the URL bar, or click Menu `︙` > "Save and share" > "Install School Management System" / "Create Shortcut" with "Open as window" checked).*
4. **Step 4**: **Done!** An official School Management desktop icon is placed on their Windows Desktop and Start Menu. When they double-click it, the app opens full screen just like Microsoft Word or Excel.

---

### 3. Step-by-Step: Setting Up Client Mobile Phone (Android)
Follow these 3 steps to install the app on the client’s Android phone (Only done once!):

1. **Step 1**: Send the final Live-Sync APK file (`app-release.apk` or `app-debug.apk`) to the client via WhatsApp, Google Drive, or Email.
2. **Step 2**: The client taps the file on their phone and clicks **"Install"** *(If prompted, enable "Allow from this source")*.
3. **Step 3**: **Done!** The app icon appears on their home screen. When opened, it connects live to the server. All future updates happen automatically without reinstalling the APK.

---

### 4. Client Feature Guide & Daily Workflow Summary

| Feature Module | What the Client Does (Simple Language) | Outputs / Actions |
|---|---|---|
| **1. Admission Desk** | Fills student form (single student or siblings family admission), selects class, category, and fee items. | Instant admission record, student profile created, and official admission receipt generated. |
| **2. Fee Collection Desk** | Selects student, enters amount, chooses Cash or In Account (Bank/UPI), clicks Confirm. | Live dues updated, auto-allocation to oldest unpaid months, JPG receipt generated, WhatsApp button. |
| **3. WhatsApp Alerts** | Clicks the green WhatsApp button next to any receipt or pending dues balance. | Sends itemized receipt breakdown directly to the parent’s phone via linked WhatsApp Web/Gateway. |
| **4. Backup & Export** | Goes to Backup section and clicks Download SQL Backup or Export Student Dossiers. | Downloads safe SQL snapshot file or a class-wise ZIP folder containing formatted student Excel sheets. |

---

### 5. Developer Maintenance Guide (How You Manage It)
When you want to update the app, tweak UI, or add new capabilities in the future:

1. **Step 1**: Make your changes in your local code on your laptop.
2. **Step 2**: Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your update message"
   git push origin main
   ```
3. **Step 3**: Render detects the push and automatically rebuilds & deploys the web service within ~60 seconds.
4. **Step 4**: The client’s laptop desktop app and mobile phone app instantly receive the updates on next launch. **Zero work required from the client!**

---

### 6. Database Safety & Emergency Safeguards

- **Automated Cloud Snapshots**: Your MySQL database is safely snapshot in the cloud. Even if the client accidentally deletes or uninstalls their desktop icon or phone app, zero data is lost.
- **1-Click Full Restore**: The Backup & Restore section allows the admin to restore a previous SQL snapshot in seconds if needed.
- **Multi-Device Access**: The principal and fee operator can both be logged in at the same time from different laptops and mobile phones with real-time synchronized data.
