# Medora API Contract

This document provides a comprehensive list of all API endpoints, their required inputs, and expected outputs for the Medora Backend.

**Base URL:** `https://medora-backend.vercel.app` (or your local environment)

---

## 🔐 Authentication Overview

Most endpoints require a JSON Web Token (JWT) provided in the `Authorization` header.

**Header Format:**
```http
Authorization: Bearer <your_jwt_token>
```

---

## 👤 Patient Authentication (`/auth`)

Endpoints for patient registration and login.

### 1. Send Signup OTP
- **Endpoint:** `POST /auth/signup/send-otp`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+919876543210",
    "name": "John Doe" // Optional if firstName/lastName provided
  }
  ```
- **Response (200 OK):**
  ```json
  { "message": "OTP sent" }
  ```

### 2. Verify Signup OTP
- **Endpoint:** `POST /auth/signup/verify-otp`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+919876543210",
    "otp": "123456",
    "name": "John Doe"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "JWT_TOKEN_STRING",
    "user": {
      "id": "UUID",
      "phone": "+919876543210",
      "name": "John Doe",
      "role": "patient",
      "created_at": "ISO_TIMESTAMP"
    }
  }
  ```

### 3. Send Signin OTP
- **Endpoint:** `POST /auth/signin/send-otp`
- **Auth:** Public
- **Request Body:**
  ```json
  { "phone": "+919876543210" }
  ```
- **Response (200 OK):**
  ```json
  { "message": "OTP sent" }
  ```

### 4. Verify Signin OTP
- **Endpoint:** `POST /auth/signin/verify-otp`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "phone": "+919876543210",
    "otp": "123456"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "JWT_TOKEN_STRING",
    "user": {
      "id": "UUID",
      "phone": "+919876543210",
      "name": "John Doe",
      "role": "patient"
    }
  }
  ```

### 5. Patient Signout
- **Endpoint:** `POST /auth/signout`
- **Auth:** Required (Patient Token)
- **Response (200 OK):**
  ```json
  {
    "message": "Patient signed out successfully",
    "note": "Please discard the token on the client side"
  }
  ```

---

## 🏥 Hospital Management (`/hospital`)

Endpoints for hospital auth, doctor/patient management, and record uploads.

### 1. Send Hospital OTP
- **Endpoint:** `POST /hospital/send-otp`
- **Auth:** Public
- **Request Body:**
  ```json
  { "phone": "+919876543210" }
  ```

### 2. Verify Hospital OTP
- **Endpoint:** `POST /hospital/verify-otp`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "phone": "+919876543210",
    "otp": "123456",
    "name": "City Hospital", // Required for new registration
    "address": "123 Main St", // Optional
    "license_no": "HOSP123" // Optional
  }
  ```
- **Response (200 OK / 201 Created):**
  ```json
  {
    "token": "JWT_TOKEN_STRING",
    "hospital": {
      "id": "UUID",
      "name": "City Hospital",
      "phone": "+919876543210",
      "role": "hospital",
      "is_new": false
    }
  }
  ```

### 3. Add Doctor to Hospital
- **Endpoint:** `POST /hospital/doctors/add`
- **Auth:** Required (Hospital Token)
- **Request Body:**
  ```json
  {
    "name": "Dr. Smith",
    "phone": "+919998887776",
    "specialization": "Cardiology",
    "license_no": "DOC789"
  }
  ```

### 4. Get Hospital Doctors
- **Endpoint:** `GET /hospital/doctors`
- **Auth:** Required (Hospital Token)
- **Response (200 OK):**
  ```json
  {
    "hospital_id": "UUID",
    "total": 5,
    "doctors": [
      {
        "id": "UUID",
        "name": "Dr. Smith",
        "phone": "+919998887776",
        "specialization": "Cardiology",
        "license_no": "DOC789",
        "status": "active",
        "created_at": "ISO_TIMESTAMP"
      }
    ]
  }
  ```

### 5. Remove Doctor from Hospital
- **Endpoint:** `DELETE /hospital/doctors/:doctor_id`
- **Auth:** Required (Hospital Token)

### 6. Add Patient to Hospital
- **Endpoint:** `POST /hospital/patients/add`
- **Auth:** Required (Hospital Token)
- **Request Body:**
  ```json
  { "phone": "+919876543210" }
  ```

### 7. Get Hospital Patients
- **Endpoint:** `GET /hospital/patients`
- **Auth:** Required (Hospital Token)
- **Response (200 OK):**
  ```json
  {
    "hospital_id": "UUID",
    "total": 10,
    "patients": [
      {
        "id": "UUID",
        "name": "John Doe",
        "phone": "+919876543210",
        "status": "active",
        "added_at": "ISO_TIMESTAMP"
      }
    ]
  }
  ```

### 8. Remove Patient from Hospital
- **Endpoint:** `DELETE /hospital/patients/:patient_id`
- **Auth:** Required (Hospital Token)

### 9. Delete Patient Documents in Hospital
- **Endpoint:** `DELETE /hospital/patients/:patient_id/documents`
- **Auth:** Required (Hospital Token)
- **Query Params:** `visit_date` (Optional, to delete specific visit records)

### 10. Upload Record for Patient
- **Endpoint:** `POST /hospital/patients/:phone/records`
- **Auth:** Required (Hospital Token)
- **Body:** `multipart/form-data`
  - `file`: (Required, PDF/Image/DOCX)
  - `visit_date`: (Optional, YYYY-MM-DD)
- **Response (201 Created):**
  ```json
  {
    "message": "Record uploaded successfully",
    "record": {
      "id": "UUID",
      "patient_name": "John Doe",
      "patient_phone": "+919876543210",
      "file_url": "URL_STRING",
      "file_type": "application/pdf",
      "visit_date": "2023-10-27",
      "uploaded_at": "ISO_TIMESTAMP"
    }
  }
  ```

### 11. Get Full Hospital Info
- **Endpoint:** `GET /hospital/info`
- **Auth:** Required (Hospital Token)
- **Description:** Returns hospital details, staff, and patients with their visit history and records.

---

## 🩺 Doctor Access (`/doctor`)

Endpoints for doctor authentication and profile.

### 1. Send Doctor OTP
- **Endpoint:** `POST /doctor/signin/send-otp`
- **Auth:** Public
- **Request Body:**
  ```json
  { "phone": "+919998887776" }
  ```

### 2. Verify Doctor OTP
- **Endpoint:** `POST /doctor/signin/verify-otp`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "phone": "+919998887776",
    "otp": "123456"
  }
  ```

### 3. Get Doctor Profile
- **Endpoint:** `GET /doctor/profile`
- **Auth:** Required (Doctor Token)
- **Response (200 OK):**
  ```json
  {
    "doctor": {
      "id": "UUID",
      "name": "Dr. Smith",
      "phone": "+919998887776",
      "specialization": "Cardiology",
      "hospital": { "id": "UUID", "name": "City Hospital" },
      "status": "active",
      "created_at": "ISO_TIMESTAMP"
    }
  }
  ```

---

## 📂 Folders & Collections (`/folders`)

Endpoints for patients to organize their records into folders.

### 1. Create Folder
- **Endpoint:** `POST /folders/create`
- **Auth:** Required (Patient Token)
- **Request Body:**
  ```json
  { "name": "Lab Reports" }
  ```

### 2. Get All Folders
- **Endpoint:** `GET /folders`
- **Auth:** Required (Patient Token)
- **Response (200 OK):**
  ```json
  {
    "folders": [
      {
        "id": "UUID",
        "name": "Lab Reports",
        "user_id": "UUID",
        "created_at": "ISO_TIMESTAMP"
      }
    ]
  }
  ```

### 3. Delete Folder
- **Endpoint:** `DELETE /folders/:folder_id`
- **Auth:** Required (Patient Token)
- **Note:** Also deletes all associated file records and physical files.

### 4. Delete File from Folder
- **Endpoint:** `DELETE /folders/:folder_id/files/:record_id`
- **Auth:** Required (Patient Token)

---

## 📑 Medical Records (`/records`)

Generic endpoints for record management.

### 1. Upload Record (General)
- **Endpoint:** `POST /records/upload`
- **Auth:** Required (Patient or Hospital Token)
- **Body:** `multipart/form-data`
  - `file`: (Required)
  - `folder_id`: (Optional)
  - `hospital_id`: (Optional)

### 2. Get Records by User ID
- **Endpoint:** `GET /records/user/:userId`
- **Auth:** Required

### 3. Get Records by Phone
- **Endpoint:** `GET /records/user/phone/:phone`
- **Auth:** Required

### 4. Delete Record
- **Endpoint:** `DELETE /records/:record_id`
- **Auth:** Required

---

## 🤖 AI Summarization (`/ai`)

Endpoints for processing medical documents with AI.

### 1. Summarize Document
- **Endpoint:** `POST /ai/summarize`
- **Auth:** Public
- **Body:** `multipart/form-data`
  - `documents`: (Array of files, max 3)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "fileName": "report.pdf",
        "success": true,
        "jobId": "UUID_OR_CACHE_ID"
      }
    ]
  }
  ```

### 2. Summarize Summaries (Aggregate)
- **Endpoint:** `POST /ai/summarize-summaries`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "summaryData": [
      { "summary_of_report_1": "..." },
      { "summary_of_report_2": "..." }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "overall_health_picture": "...",
      "identified_patterns": ["..."],
      "summary_count": 2
    },
    "message": "Aggregated summary generated"
  }
  ```

### 3. Get AI Job Status
- **Endpoint:** `GET /ai/status/:jobId`
- **Auth:** Public
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "state": "completed",
    "progress": 100,
    "data": { "summary": "..." },
    "error": null
  }
  ```

---

## 📱 QR Code Sharing (`/qr`)

Endpoints for generating and accessing records via QR tokens.

### 1. Generate QR Token
- **Endpoint:** `POST /qr/generate`
- **Auth:** Required (Patient Token)
- **Request Body:**
  ```json
  {
    "record_ids": ["UUID1", "UUID2"],
    "expires_in": 3600 // Optional, in seconds. Default 900s.
  }
  ```

### 2. Access QR Token
- **Endpoint:** `GET /qr/:token`
- **Auth:** Public
- **Description:** Returns patient info and signed URLs for the shared records.

---

## 🛠 System & Misc

### 1. API Status
- **Endpoint:** `GET /status`
- **Auth:** Public
- **Response:**
  ```json
  {
    "status": "active",
    "uptime": 123.45,
    "timestamp": "ISO_TIMESTAMP"
  }
  ```

### 2. Root Route
- **Endpoint:** `GET /`
- **Auth:** Public
- **Response:** "Medora API is up and running!"
